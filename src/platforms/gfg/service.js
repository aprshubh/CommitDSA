// @ts-check

import { StorageService } from '../../services/StorageService.js';
import { getActiveDateString } from '../../utils/path.js';
import { Logger } from '../../utils/Logger.js';

const log = Logger.prototype.child ? new Logger().child('GfgService') : new Logger('GfgService');

export const GfgService = {
  storagePrefix: 'gfg',

  /**
   * Fetches GFG Problem of the Day challenge.
   * 
   * @returns {Promise<{ dailyQuestion: Object|null, completedDates: Array<string> }>}
   */
  async fetchDailyChallenge() {
    try {
      const res = await fetch('https://practiceapi.geeksforgeeks.org/api/v1/problems-of-day/problem/today/');
      if (res.ok) {
        const data = await res.json();
        if (data && data.problem_name) {
          let titleSlug = 'practice';
          try {
            const parts = data.problem_url.split('/problems/');
            if (parts.length > 1) {
              titleSlug = parts[1].split('/')[0];
            } else {
              titleSlug = data.problem_name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
            }
          } catch (e) {}

          const todayQuestion = {
            date: getActiveDateString('gfg'),
            title: data.problem_name,
            titleSlug: titleSlug,
            difficulty: data.difficulty || 'Medium',
            link: data.problem_url
          };

          const storageData = await StorageService.get(['gfg_completedDates']);
          const completedDates = storageData.gfg_completedDates || [];
          
          await StorageService.set({ gfg_dailyQuestion: todayQuestion });

          log.info('GFG POTD synced successfully.');
          return {
            dailyQuestion: todayQuestion,
            completedDates
          };
        }
      }
    } catch (e) {
      log.warn('Error fetching GFG POTD:', e);
    }
    
    const storageData = await StorageService.get(['gfg_completedDates', 'gfg_dailyQuestion']);
    return {
      dailyQuestion: storageData.gfg_dailyQuestion || null,
      completedDates: storageData.gfg_completedDates || []
    };
  },

  /**
   * Scrapes profile and queries submissions API to parse user stats.
   * 
   * @param {string} [username] - GFG user handle (optional if already cached in storage)
   * @returns {Promise<Object|null>} Solved statistics object or null.
   */
  async fetchUserStats(username) {
    try {
      const existingData = await StorageService.get(['gfg_solvedStats', 'gfg_username']);
      const local = existingData.gfg_solvedStats || {};
      const activeUsername = username || existingData.gfg_username || local.username || null;

      if (!activeUsername) {
        log.warn('GFG Username not found. Please visit GeeksForGeeks while logged in to sync.');
        return null;
      }

      let easy = 0, medium = 0, hard = 0, basic = 0, totalSolved = 0, score = 0, rank = 0;
      let apiSuccess = false;

      // 1. Scraping profile for score and rank
      try {
        const profileRes = await fetch(`https://www.geeksforgeeks.org/profile/${encodeURIComponent(activeUsername)}?tab=activity`);
        if (profileRes.ok) {
          const html = await profileRes.text();
          
          const scoreMatch = html.match(/\\?"score\\?"\s*:\s*(\d+)/);
          if (scoreMatch && scoreMatch[1]) {
            score = parseInt(scoreMatch[1], 10);
            apiSuccess = true;
          }
          
          const rankMatch = html.match(/\\?"pod_solved_global_rank\\?"\s*:\s*(\d+)/) || 
                            html.match(/\\?"rank\\?"\s*:\s*(\d+)/);
          if (rankMatch && rankMatch[1]) {
            rank = parseInt(rankMatch[1], 10);
          }
        }
      } catch (e) {
        log.warn('Error scraping GFG profile html:', e);
      }

      // 2. Fetch difficulty breakdown from submissions API
      try {
        const res = await fetch('https://practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ handle: activeUsername })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.result) {
            totalSolved = data.count || 0;
            easy = data.result.Easy ? Object.keys(data.result.Easy).length : 0;
            medium = data.result.Medium ? Object.keys(data.result.Medium).length : 0;
            hard = data.result.Hard ? Object.keys(data.result.Hard).length : 0;
            basic = (data.result.School ? Object.keys(data.result.School).length : 0) + 
                    (data.result.Basic ? Object.keys(data.result.Basic).length : 0);
            apiSuccess = true;
          }
        }
      } catch (e) {
        log.warn('Error fetching GFG stats from submissions API:', e);
      }

      if (!apiSuccess) return null; // Fallback to cached data if both calls fail

      const gfgStats = {
        username: activeUsername,
        total: totalSolved,
        easy,
        medium,
        hard,
        basic,
        rank,
        score,
        lastUpdated: Date.now()
      };
      
      await StorageService.set({ gfg_solvedStats: gfgStats });
      log.info('GFG stats merged:', gfgStats);
      return gfgStats;
      
    } catch (e) {
      log.warn('Error in fetchUserStats:', e);
    }
    return null;
  }
};
