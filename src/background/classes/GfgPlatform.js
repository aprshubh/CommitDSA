import { CodingPlatform } from './CodingPlatform.js';
import { getActiveDateString } from '../utils.js';

export class GfgPlatform extends CodingPlatform {
  constructor() {
    super('GFG', 'gfg');
  }

  async fetchDailyChallenge() {
    try {
      const res = await fetch("https://practiceapi.geeksforgeeks.org/api/v1/problems-of-day/problem/today/");
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

          const completedDates = await this.getFromLocalStorage('completedDates', []);
          await this.saveToLocalStorage('dailyQuestion', todayQuestion);
          await this.saveToLocalStorage('completedDates', completedDates);

          console.log(`[CommitDSA] GFG POTD synced successfully.`);
          return {
            dailyQuestion: todayQuestion,
            completedDates
          };
        }
      }
    } catch (e) {
      console.warn('[CommitDSA] Error fetching GFG POTD:', e);
    }
    
    // Fallbacks
    const completedDates = await this.getFromLocalStorage('completedDates', []);
    const dailyQuestion = await this.getFromLocalStorage('dailyQuestion', null);
    return { dailyQuestion, completedDates };
  }

  async fetchUserStats(username) {
    try {
      // 1. Get username from local storage (saved from previous sessions or content script)
      const existingData = await chrome.storage.local.get(['gfg_solvedStats', 'gfg_username']);
      const local = existingData.gfg_solvedStats || {};
      const activeUsername = username || existingData.gfg_username || local.username || null;

      if (!activeUsername) {
        console.warn('[CommitDSA] GFG Username not found. Please visit GeeksForGeeks while logged in to sync.');
        return null;
      }

      let easy = 0, medium = 0, hard = 0, basic = 0, totalSolved = 0, score = 0, rank = 0;
      let apiSuccess = false;

      // 2. Fetch score and rank by scraping the profile HTML
      try {
        const profileRes = await fetch(`https://www.geeksforgeeks.org/profile/${encodeURIComponent(activeUsername)}?tab=activity`);
        if (profileRes.ok) {
          const html = await profileRes.text();
          
          // Direct regex for robust extraction supporting escaped and unescaped JSON variables
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
      } catch(e) {}

      // 3. Fetch difficulty breakdown from the internal submissions API
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
        console.warn('[CommitDSA] Error fetching GFG stats from submissions API:', e);
      }

      if (!apiSuccess) return null; // Keep old data if both APIs fail

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
      
      await this.saveToLocalStorage('solvedStats', gfgStats);
      console.log('[CommitDSA] GFG stats merged:', gfgStats);
      return gfgStats;
      
    } catch (e) {
      console.warn('[CommitDSA] Error in fetchGfgUserStats:', e);
    }
    return null;
  }

  getSolveUrl(question) {
    return question.link
      ? (question.link.startsWith('http') ? question.link : `https://www.geeksforgeeks.org${question.link}`)
      : `https://www.geeksforgeeks.org/problems/${question.titleSlug}/1`;
  }
}
