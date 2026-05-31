/**
 * @fileoverview Main Service Worker for CommitDSA.
 * Integrates Platform classes, AlarmManager, and ScriptManager to coordinate 
 * messaging, alarms, and dynamic script loading reactively.
 */

import { pushToGitHub, cleanRepoPath } from './github.js';
import { PlatformFactory } from './classes/PlatformFactory.js';
import { AlarmManager } from './classes/AlarmManager.js';
import { ScriptManager } from './classes/ScriptManager.js';
import { getActiveDateString } from './utils.js';

const CACHE_DURATION = 60 * 60 * 1000; // 1 Hour

// ==========================================
// REACTIVE CONFIG SYNC (STORAGE LISTENER)
// ==========================================

/**
 * Synchronizes alarms and content scripts according to the list of enabled platforms.
 */
async function syncEnabledPlatformsState() {
  try {
    const res = await chrome.storage.local.get(['enabledPlatforms']);
    const enabled = res.enabledPlatforms || ['leetcode', 'gfg'];
    
    // Dynamically manage alarms and content script injections
    await AlarmManager.updateAlarms(enabled);
    await ScriptManager.updateContentScripts(enabled);
  } catch (err) {
    console.error('[CommitDSA] Error syncing enabled platforms state:', err);
  }
}

// Listen to settings updates in local storage to dynamically update alarms/scripts
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.enabledPlatforms) {
    const enabled = changes.enabledPlatforms.newValue || ['leetcode', 'gfg'];
    console.log('[CommitDSA] Enabled platforms configuration updated:', enabled);
    await AlarmManager.updateAlarms(enabled);
    await ScriptManager.updateContentScripts(enabled);
  }
});

// ==========================================
// MESSAGE HANDLERS
// ==========================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CHECK_SYNC_CONFIG') {
    chrome.storage.local.get(['githubEnabled', 'syncMode'], (res) => {
      sendResponse({
        githubEnabled: res.githubEnabled || false,
        syncMode: res.syncMode || 'manual' // default 'manual' to match popup UI
      });
    });
    return true;
  }

  // Get current GitHub repo
  if (request.type === 'GET_REPO_INFO') {
    chrome.storage.local.get(['githubRepo'], (res) => {
      sendResponse(res.githubRepo || '');
    });
    return true;
  }

  // Handle a new submission to be committed
  if (request.type === 'COMMIT_SUBMISSION') {
    chrome.storage.local.get(['githubToken', 'githubRepo'], (config) => {
      if (!config.githubToken || !cleanRepoPath(config.githubRepo)) {
        sendResponse({ success: false, error: 'GitHub not configured.' });
        return;
      }
      pushToGitHub(request.data, config)
        .then(result => {
          if (result) sendResponse({ success: true });
          else sendResponse({ success: false, error: 'Push failed' });
        })
        .catch(err => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }

  // Register a successful solve to update local streaks and stats
  if (request.type === 'REGISTER_LOCAL_SOLVE') {
    const { platform, titleSlug, title, difficulty } = request;
    const activePlatform = (platform || 'leetcode').toLowerCase();
    
    // LeetCode uses UTC date, GFG uses IST date for its daily challenge mapping
    const todayStr = getActiveDateString(activePlatform === 'leetcode' ? 'leetcode' : 'gfg');
    
    const completedKey = `${activePlatform}_completedDates`;
    const solvedSlugsKey = `${activePlatform}_solvedSlugs`;
    const solvedKey = `${activePlatform}_solvedStats`;
    const dailyQuestionKey = `${activePlatform}_dailyQuestion`;

    chrome.storage.local.get([completedKey, solvedSlugsKey, solvedKey, dailyQuestionKey], async (data) => {
      const completedDates = data[completedKey] || [];
      const solvedSlugs = data[solvedSlugsKey] || [];
      const solvedStats = data[solvedKey] || { total: 0, easy: 0, medium: 0, hard: 0 };
      
      // POTD completion tracking:
      let shouldMarkCompleted = true;
      if (activePlatform === 'gfg') {
        const todayPotd = data[dailyQuestionKey];
        // For GFG: only mark today as completed if the solved problem IS today's POTD.
        if (todayPotd && todayPotd.titleSlug && todayPotd.titleSlug !== titleSlug) {
          shouldMarkCompleted = false;
          console.log(`[CommitDSA] GFG: solved "${titleSlug}" — not today's POTD ("${todayPotd.titleSlug}"), skipping POTD mark.`);
        }
      }

      if (shouldMarkCompleted && !completedDates.includes(todayStr)) {
        completedDates.push(todayStr);
      }

      // Increment stats if not already solved (only done manually for GFG right now, LC fetches from API)
      if (activePlatform !== 'leetcode' && !solvedSlugs.includes(titleSlug)) {
        solvedSlugs.push(titleSlug);
        
        const diff = (difficulty || 'Easy').toLowerCase().trim();
        let category = 'easy';
        if (diff === 'medium') category = 'medium';
        else if (diff === 'hard') category = 'hard';
        else if (diff === 'basic' || diff === 'school') category = 'basic';
        
        solvedStats[category] = (solvedStats[category] || 0) + 1;
        solvedStats.total = (solvedStats.total || 0) + 1;
        solvedStats.lastUpdated = Date.now();
      }

      const updateData = {};
      updateData[completedKey] = completedDates;
      if (activePlatform !== 'leetcode') {
        updateData[solvedSlugsKey] = solvedSlugs;
        updateData[solvedKey] = solvedStats;
      }

      await chrome.storage.local.set(updateData);
      
      sendResponse({ success: true, solvedStats: activePlatform !== 'leetcode' ? solvedStats : null });
    });
    return true;
  }

  // Handle Dashboard requests from the popup (Unified Polymorphic Flow)
  if (request.type === 'GET_DASHBOARD_DATA' || request.type === 'FORCE_REFRESH_DAILY') {
    const platform = request.platform || 'leetcode';
    
    try {
      const platformInstance = PlatformFactory.getPlatform(platform);
      const prefix = platformInstance.storagePrefix;

      const completedKey = `${prefix}_completedDates`;
      const statsKey = platform === 'leetcode' ? 'leetcode_solvedStats' : `${prefix}_solvedStats`;
      const dailyQuestKey = platform === 'leetcode' ? 'leetcode_dailyQuestion' : `${prefix}_dailyQuestion`;
      const lastSyncTimeKey = platform === 'leetcode' ? 'lastSyncTime' : 'lastGfgSyncTime';

      const fetchFreshData = () => {
        // Fetch daily POTD challenge
        platformInstance.fetchDailyChallenge().then(async (challengeData) => {
          // Check for user config to fetch stats
          const config = await chrome.storage.local.get([`${prefix}_username`]);
          const username = config[`${prefix}_username`];
          
          let solvedStats = null;
          if (username) {
            solvedStats = await platformInstance.fetchUserStats(username);
          } else {
            // Load current cached stats if username is missing
            const cache = await chrome.storage.local.get([statsKey]);
            solvedStats = cache[statsKey] || null;
          }

          await chrome.storage.local.set({ [lastSyncTimeKey]: Date.now() });

          sendResponse({
            dailyQuestion: challengeData.dailyQuestion,
            completedDates: challengeData.completedDates,
            solvedStats: solvedStats
          });
        }).catch((err) => {
          console.warn(`[CommitDSA] ${platform} fresh sync failed:`, err);
          // Return cache on fail with error message
          chrome.storage.local.get([completedKey, statsKey, dailyQuestKey], (cache) => {
            sendResponse({
              dailyQuestion: cache[dailyQuestKey] || null,
              completedDates: cache[completedKey] || [],
              solvedStats: cache[statsKey] || null,
              error: err.message || 'Sync failed'
            });
          });
        });
      };

      if (request.type === 'FORCE_REFRESH_DAILY') {
        fetchFreshData();
      } else {
        chrome.storage.local.get([lastSyncTimeKey, completedKey, statsKey, dailyQuestKey], (cache) => {
          const isCacheValid = cache[lastSyncTimeKey] && (Date.now() - cache[lastSyncTimeKey] < CACHE_DURATION);
          if (isCacheValid && cache[dailyQuestKey]) {
            sendResponse({
              dailyQuestion: cache[dailyQuestKey] || null,
              completedDates: cache[completedKey] || [],
              solvedStats: cache[statsKey] || null
            });
          } else {
            fetchFreshData();
          }
        });
      }
    } catch (e) {
      console.error(`[CommitDSA] Error in Dashboard coordinator for ${platform}:`, e);
      sendResponse({ error: e.message });
    }
    return true; // Keep message channel open for async response
  }
});

// ==========================================
// ALARMS & STARTUP
// ==========================================

async function triggerDailyAlarms(alarmName) {
  try {
    if (alarmName === "fetchDailyChallenge") {
      const leetcode = PlatformFactory.getPlatform('leetcode');
      await leetcode.fetchDailyChallenge();
    }
    if (alarmName === "fetchGfgDailyChallenge") {
      const gfg = PlatformFactory.getPlatform('gfg');
      await gfg.fetchDailyChallenge();
    }
  } catch (err) {
    console.error(`[CommitDSA] Daily fetch execution failed for alarm ${alarmName}:`, err);
  }
}

// Create daily alarms and open welcome page
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }

  // Initialize enabled platforms state in local storage if not already configured
  const res = await chrome.storage.local.get(['enabledPlatforms']);
  if (!res.enabledPlatforms) {
    await chrome.storage.local.set({ enabledPlatforms: ['leetcode', 'gfg'] });
  }

  await syncEnabledPlatformsState();
  
  // Force initial fetches for active alarms
  await triggerDailyAlarms("fetchDailyChallenge");
  await triggerDailyAlarms("fetchGfgDailyChallenge");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  triggerDailyAlarms(alarm.name);
});

chrome.runtime.onStartup.addListener(async () => {
  await syncEnabledPlatformsState();
  await triggerDailyAlarms("fetchDailyChallenge");
  await triggerDailyAlarms("fetchGfgDailyChallenge");
});
