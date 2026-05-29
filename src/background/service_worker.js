/**
 * @fileoverview Main Service Worker for CommitDSA.
 * Coordinates messaging, alarms, and data synchronization across platforms.
 */

import { pushToGitHub, cleanRepoPath } from './github.js';
import { fetchAndSyncChallenges, fetchUserSolvedStats } from './leetcode.js';
import { fetchGfgDailyChallenge, fetchGfgUserStats } from './gfg.js';
import { getActiveDateString } from './utils.js';

const CACHE_DURATION = 60 * 60 * 1000; // 1 Hour

// ==========================================
// MESSAGE HANDLERS
// ==========================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CHECK_SYNC_CONFIG') {
    chrome.storage.local.get(['githubEnabled', 'syncMode'], (res) => {
      sendResponse({
        githubEnabled: res.githubEnabled || false,
        syncMode: res.syncMode || 'manual'  // default 'manual' to match popup UI
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

  // Handle Dashboard requests from the popup
  if (request.type === 'GET_DASHBOARD_DATA' || request.type === 'FORCE_REFRESH_DAILY') {
    const platform = request.platform || 'leetcode';
    
    if (platform === 'leetcode') {
      const fetchFreshData = () => {
        Promise.all([
          fetchAndSyncChallenges(),
          fetchUserSolvedStats()
        ]).then(([syncedData, solvedStats]) => {
          chrome.storage.local.set({ lastSyncTime: Date.now() });
          sendResponse({
            ...syncedData,
            solvedStats: solvedStats || null
          });
        }).catch((err) => {
          console.warn('[CommitDSA] LeetCode Sync failed:', err);
          chrome.storage.local.get(['leetcode_dailyQuestion', 'leetcode_completedDates', 'leetcode_solvedStats'], (cache) => {
            sendResponse({
              dailyQuestion: cache.leetcode_dailyQuestion || null,
              completedDates: cache.leetcode_completedDates || [],
              solvedStats: cache.leetcode_solvedStats || null
            });
          });
        });
      };

      if (request.type === 'FORCE_REFRESH_DAILY') {
        fetchFreshData();
      } else {
        chrome.storage.local.get(['lastSyncTime', 'leetcode_dailyQuestion', 'leetcode_completedDates', 'leetcode_solvedStats'], (cache) => {
          const isCacheValid = cache.lastSyncTime && (Date.now() - cache.lastSyncTime < CACHE_DURATION);
          if (isCacheValid && cache.leetcode_dailyQuestion) {
            sendResponse({
              dailyQuestion: cache.leetcode_dailyQuestion || null,
              completedDates: cache.leetcode_completedDates || [],
              solvedStats: cache.leetcode_solvedStats || null
            });
          } else {
            fetchFreshData();
          }
        });
      }
    } else if (platform === 'gfg') {
      const completedKey = 'gfg_completedDates';
      const solvedKey = 'gfg_solvedStats';
      const dailyQuestionKey = 'gfg_dailyQuestion';

      chrome.storage.local.get([completedKey, solvedKey, dailyQuestionKey, 'lastGfgSyncTime'], async (data) => {
        const completedDates = data[completedKey] || [];
        
        const todayStr = getActiveDateString('gfg');
        let dailyQuestion = data[dailyQuestionKey] || null;

        // Refresh POTD if missing or forced or different date
        if (!dailyQuestion || dailyQuestion.date !== todayStr || request.type === 'FORCE_REFRESH_DAILY') {
          const freshPotd = await fetchGfgDailyChallenge();
          if (freshPotd) {
            dailyQuestion = freshPotd;
            
            const updateMap = {};
            updateMap[dailyQuestionKey] = freshPotd;
            await chrome.storage.local.set(updateMap);
          }
        }

        let solvedStats = data[solvedKey] || null;
        
        // Rate-limit cache logic for GFG to prevent IP bans
        const isCacheValid = data.lastGfgSyncTime && (Date.now() - data.lastGfgSyncTime < CACHE_DURATION);

        if (request.type === 'FORCE_REFRESH_DAILY') {
          const freshStats = await fetchGfgUserStats();
          if (freshStats) {
            solvedStats = freshStats;
            chrome.storage.local.set({ lastGfgSyncTime: Date.now() });
          }
        } else if (!isCacheValid || !solvedStats) {
          // Await fresh stats so the response is not stale
          const freshStats = await fetchGfgUserStats();
          if (freshStats) {
            solvedStats = freshStats;
            chrome.storage.local.set({ lastGfgSyncTime: Date.now() });
          }
        }

        sendResponse({
          dailyQuestion: dailyQuestion,
          completedDates: completedDates,
          solvedStats: solvedStats
        });
      });
    }
    return true; // Keep message channel open for async response
  }
});

// ==========================================
// ALARMS & STARTUP
// ==========================================

function triggerLeetcodeFetch() { fetchAndSyncChallenges(); }
function triggerGfgFetch()     { fetchGfgDailyChallenge(); }

// Create daily alarms and open welcome page
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
  chrome.alarms.create("fetchDailyChallenge", { periodInMinutes: 1440 });
  chrome.alarms.create("fetchGfgDailyChallenge", { periodInMinutes: 1440 });
  triggerLeetcodeFetch();
  triggerGfgFetch();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "fetchDailyChallenge") triggerLeetcodeFetch();
  if (alarm.name === "fetchGfgDailyChallenge") triggerGfgFetch();
});

chrome.runtime.onStartup.addListener(() => {
  triggerLeetcodeFetch();
  triggerGfgFetch();
});
