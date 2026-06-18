// @ts-check

import { StorageService } from '../services/StorageService.js';
import { QueueService } from '../services/QueueService.js';
import { LeetCodeService } from '../platforms/leetcode/service.js';
import { GfgService } from '../platforms/gfg/service.js';
import { Logger } from '../utils/Logger.js';
import { getActiveDateString, getSyncPath } from '../utils/path.js';

const log = Logger.prototype.child ? new Logger().child('App') : new Logger('App');

// Mapping of platform identifiers to their background service fetchers
const platforms = {
  leetcode: LeetCodeService,
  gfg: GfgService
};

// ─── Dynamic Scripting & Alarms Helper ──────────────────────────────────────

const PLATFORM_MATCHES = {
  leetcode: [
    'https://leetcode.com/problems/*',
    'https://*.leetcode.com/problems/*'
  ],
  gfg: [
    'https://www.geeksforgeeks.org/problems/*',
    'https://practice.geeksforgeeks.org/problems/*'
  ]
};

let contentScriptUpdateQueue = Promise.resolve();

async function getRegisteredScriptIds() {
  const registered = await chrome.scripting.getRegisteredContentScripts();
  return registered.map(script => script.id);
}

async function registerContentScriptIfMissing(scriptConfig, label) {
  const registeredIds = await getRegisteredScriptIds();
  if (registeredIds.includes(scriptConfig.id)) return;

  try {
    await chrome.scripting.registerContentScripts([scriptConfig]);
    log.info(`Registered ${label}`);
  } catch (err) {
    if (err && typeof err.message === 'string' && err.message.includes('Duplicate script ID')) {
      log.debug(`Content script already registered: ${scriptConfig.id}`);
      return;
    }
    throw err;
  }
}

/**
 * Dynamically registers or unregisters content and injection scripts for enabled platforms.
 * 
 * @param {Array<string>} enabled - List of enabled platform IDs.
 */
async function updateContentScripts(enabled) {
  contentScriptUpdateQueue = contentScriptUpdateQueue
    .catch(() => {})
    .then(() => applyContentScripts(enabled));
  return contentScriptUpdateQueue;
}

async function applyContentScripts(enabled) {
  try {
    for (const platformId of Object.keys(PLATFORM_MATCHES)) {
      const scriptId = `script_${platformId}`;
      const injectId = `inject_${platformId}`;
      const matches = PLATFORM_MATCHES[platformId];

      if (enabled.includes(platformId)) {
        await registerContentScriptIfMissing({
            id: scriptId,
            js: ['content/content.js'],
            css: ['content/content.css'],
            matches: matches,
            runAt: 'document_idle',
            world: 'ISOLATED'
          },
          `ISOLATED content script for platform: ${platformId}`
        );

        await registerContentScriptIfMissing({
            id: injectId,
            js: [`platforms/${platformId}/inject.js`],
            matches: matches,
            runAt: 'document_start',
            world: 'MAIN'
          },
          `MAIN world injection script for platform: ${platformId}`
        );
      } else {
        const registeredIds = await getRegisteredScriptIds();
        // Clean up scripts for disabled platforms
        const toClean = [];
        if (registeredIds.includes(scriptId)) toClean.push(scriptId);
        if (registeredIds.includes(injectId)) toClean.push(injectId);
        if (toClean.length > 0) {
          await chrome.scripting.unregisterContentScripts({ ids: toClean });
          log.info(`Unregistered scripting context for disabled platform: ${platformId}`);
        }
      }
    }
  } catch (err) {
    log.error('Error in updateContentScripts:', err);
  }
}

/**
 * Synchronizes background alarms based on enabled platforms.
 * 
 * @param {Array<string>} enabled - List of enabled platform IDs.
 */
async function updateAlarms(enabled) {
  try {
    for (const platformId of Object.keys(PLATFORM_MATCHES)) {
      const alarmName = `fetch_${platformId}_DailyChallenge`;
      if (enabled.includes(platformId)) {
        const existing = await chrome.alarms.get(alarmName);
        if (!existing) {
          chrome.alarms.create(alarmName, { periodInMinutes: 1440 }); // Daily
          log.info(`Created daily alarm for platform: ${platformId}`);
        }
      } else {
        const cleared = await chrome.alarms.clear(alarmName);
        if (cleared) log.info(`Cleared daily alarm for disabled platform: ${platformId}`);
      }
    }
  } catch (err) {
    log.error('Error in updateAlarms:', err);
  }
}

// ─── Storage Migrations ──────────────────────────────────────────────────────

const LATEST_STORAGE_VERSION = 2;

const migrations = {
  1: async () => {
    log.info('Running migration: v1 -> v2');
    const data = await StorageService.get(['syncQueue', 'enabledPlatforms']);
    const updates = {};
    if (!data.syncQueue) updates.syncQueue = [];
    if (!data.enabledPlatforms) updates.enabledPlatforms = ['leetcode', 'gfg'];
    if (Object.keys(updates).length > 0) {
      await StorageService.set(updates);
    }
  }
};

async function runMigrations() {
  const data = await StorageService.get('storageVersion');
  const currentVersion = data.storageVersion || 1;
  log.info(`Current storage version: ${currentVersion} | Target: ${LATEST_STORAGE_VERSION}`);

  for (let v = currentVersion; v < LATEST_STORAGE_VERSION; v++) {
    if (migrations[v]) {
      await migrations[v]();
    }
  }
  await StorageService.set({ storageVersion: LATEST_STORAGE_VERSION });
  log.info(`Storage migrated to version ${LATEST_STORAGE_VERSION} successfully.`);
}

// ─── Synchronous Listeners Registration ──────────────────────────────────────

export function registerListeners() {
  // 1. Storage Change Listener
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local' && changes.enabledPlatforms) {
      const active = changes.enabledPlatforms.newValue || ['leetcode', 'gfg'];
      log.info('Platform configurations changed. Re-synchronizing script rules.');
      await updateContentScripts(active);
      await updateAlarms(active);
    }
  });

  // 2. Alarms Listener
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    log.info(`Alarm fired: ${alarm.name}`);
    for (const platformId of Object.keys(platforms)) {
      if (alarm.name === `fetch_${platformId}_DailyChallenge`) {
        try {
          await platforms[platformId].fetchDailyChallenge();
        } catch (e) {
          log.error(`Failed to fetch daily challenge for: ${platformId}`, e);
        }
      }
    }
  });

  // 3. OnInstalled Listener
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      chrome.tabs.create({ url: chrome.runtime.getURL('ui/welcome/welcome.html') });
    }
    const res = await StorageService.get('enabledPlatforms');
    if (!res.enabledPlatforms) {
      await StorageService.set({ enabledPlatforms: ['leetcode', 'gfg'] });
    }
  });

  // 4. Message Dispatcher
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const type = request.type;

    if (type === 'CHECK_SYNC_CONFIG') {
      StorageService.get(['githubEnabled', 'syncMode']).then(res => {
        sendResponse({
          githubEnabled: res.githubEnabled || false,
          syncMode: 'manual'
        });
      });
      return true; // async reply
    }

    if (type === 'GET_REPO_INFO') {
      StorageService.get('githubRepo').then(res => {
        sendResponse(res.githubRepo || '');
      });
      return true;
    }

    if (type === 'ENRICH_SUBMISSION_DETAILS') {
      const solvedProblem = request.data;
      if (solvedProblem.platform.toLowerCase() === 'leetcode') {
        const query = `
          query questionTitle($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
              questionFrontendId
              title
              difficulty
            }
          }
        `;
        fetch('https://leetcode.com/graphql/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Referer': 'https://leetcode.com'
          },
          body: JSON.stringify({
            query,
            variables: { titleSlug: solvedProblem.slug }
          })
        })
          .then(res => res.json())
          .then(result => {
            const question = result.data?.question;
            if (question && question.questionFrontendId) {
              solvedProblem.title = `${question.questionFrontendId}. ${question.title}`;
              solvedProblem.difficulty = question.difficulty;
            }
            sendResponse(solvedProblem);
          })
          .catch(err => {
            log.warn(`Failed to enrich LeetCode details for slug ${solvedProblem.slug}:`, err);
            sendResponse(solvedProblem);
          });
      } else {
        sendResponse(solvedProblem);
      }
      return true; // async response
    }

    if (type === 'FORCE_RUN_QUEUE') {
      QueueService.processQueue()
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (type === 'GET_SYNC_PATH') {
      const p = request.data;
      const syncPath = getSyncPath(p.platform, p.difficulty, p.title, p.language);
      sendResponse(syncPath);
      return false; // synchronous reply
    }

    if (type === 'COMMIT_SUBMISSION') {
      QueueService.enqueue(request.data)
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (type === 'REGISTER_LOCAL_SOLVE') {
      const solvedProblem = request.data;
      const platformId = solvedProblem.platform.toLowerCase();
      const todayStr = getActiveDateString(platformId);

      const completedKey = `${platformId}_completedDates`;
      const solvedSlugsKey = `${platformId}_solvedSlugs`;
      const solvedKey = `${platformId}_solvedStats`;
      const dailyQuestionKey = `${platformId}_dailyQuestion`;

      StorageService.get([completedKey, solvedSlugsKey, solvedKey, dailyQuestionKey]).then(async (data) => {
        const completedDates = data[completedKey] || [];
        const solvedSlugs = data[solvedSlugsKey] || [];
        const solvedStats = data[solvedKey] || { total: 0, easy: 0, medium: 0, hard: 0 };

        let shouldMarkCompleted = true;
        const todayPotd = data[dailyQuestionKey];
        if (todayPotd && todayPotd.titleSlug && todayPotd.titleSlug !== solvedProblem.slug) {
          shouldMarkCompleted = false;
        }

        if (shouldMarkCompleted && !completedDates.includes(todayStr)) {
          completedDates.push(todayStr);
        }

        if (platformId !== 'leetcode' && !solvedSlugs.includes(solvedProblem.slug)) {
          solvedSlugs.push(solvedProblem.slug);
          
          const diff = solvedProblem.difficulty.toLowerCase().trim();
          let category = 'easy';
          if (diff === 'medium') category = 'medium';
          else if (diff === 'hard') category = 'hard';
          else if (diff === 'basic' || diff === 'school') category = 'basic';

          solvedStats[category] = (solvedStats[category] || 0) + 1;
          solvedStats.total = (solvedStats.total || 0) + 1;
          solvedStats.lastUpdated = Date.now();
        }

        const updates = { [completedKey]: completedDates };
        if (platformId !== 'leetcode') {
          updates[solvedSlugsKey] = solvedSlugs;
          updates[solvedKey] = solvedStats;
        }

        await StorageService.set(updates);
        sendResponse({ success: true });
      });
      return true;
    }

    if (type === 'GET_DASHBOARD_DATA' || type === 'FORCE_REFRESH_DAILY') {
      const platformId = request.platform || 'leetcode';
      const service = platforms[platformId.toLowerCase()];
      if (!service) {
        sendResponse({ error: `Unsupported platform: ${platformId}` });
        return;
      }

      const completedKey = `${service.storagePrefix}_completedDates`;
      const statsKey = `${service.storagePrefix}_solvedStats`;
      const dailyQuestKey = `${service.storagePrefix}_dailyQuestion`;
      const lastSyncTimeKey = platformId === 'leetcode' ? 'lastSyncTime' : 'lastGfgSyncTime';

      const fetchFreshData = () => {
        service.fetchDailyChallenge().then(async (challengeData) => {
          const config = await StorageService.get([`${service.storagePrefix}_username`]);
          const username = config[`${service.storagePrefix}_username`];

          let solvedStats = null;
          if (username || platformId.toLowerCase() === 'leetcode') {
            solvedStats = await service.fetchUserStats(username);
          } else {
            const cache = await StorageService.get(statsKey);
            solvedStats = cache[statsKey] || null;
          }

          await StorageService.set({ [lastSyncTimeKey]: Date.now() });
          sendResponse({
            dailyQuestion: challengeData.dailyQuestion,
            completedDates: challengeData.completedDates,
            solvedStats: solvedStats
          });
        }).catch(err => {
          log.warn(`Fresh sync failed for: ${platformId}`, err);
          StorageService.get([completedKey, statsKey, dailyQuestKey]).then(cache => {
            sendResponse({
              dailyQuestion: cache[dailyQuestKey] || null,
              completedDates: cache[completedKey] || [],
              solvedStats: cache[statsKey] || null,
              error: err.message || 'Sync failed'
            });
          });
        });
      };

      if (type === 'FORCE_REFRESH_DAILY') {
        fetchFreshData();
      } else {
        const CACHE_DURATION = 60 * 60 * 1000;
        StorageService.get([lastSyncTimeKey, completedKey, statsKey, dailyQuestKey]).then(cache => {
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
      return true;
    }
  });
}

// ─── Asynchronous App Bootstrapper ──────────────────────────────────────────

export async function initializeApp() {
  log.info('Initializing CommitDSA runtime...');
  
  // 1. Run migrations first
  await runMigrations();

  // 2. Restore active queue processing states
  await QueueService.restoreProcessingItems();

  // 3. Set initial state of alarms and content scripts
  const settings = await StorageService.get('enabledPlatforms');
  const enabled = settings.enabledPlatforms || ['leetcode', 'gfg'];
  await updateContentScripts(enabled);
  await updateAlarms(enabled);

  log.info('CommitDSA initialization finished.');
}
