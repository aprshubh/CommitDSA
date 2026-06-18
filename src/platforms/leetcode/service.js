// @ts-check

import { StorageService } from '../../services/StorageService.js';
import { Logger } from '../../utils/Logger.js';

const log = Logger.prototype.child ? new Logger().child('LeetCodeService') : new Logger('LeetCodeService');

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql/';
const LC_HEADERS = {
  'Content-Type': 'application/json',
  'Referer': 'https://leetcode.com'
};

export const LeetCodeService = {
  storagePrefix: 'leetcode',

  /**
   * Fetches the active daily LeetCode challenge (Problem of the Day).
   * 
   * @returns {Promise<{ dailyQuestion: Object|null, completedDates: Array<string> }>}
   */
  async fetchDailyChallenge() {
    const query = `
      query questionOfToday {
        activeDailyCodingChallengeQuestion {
          date
          link
          question {
            title
            titleSlug
            difficulty
          }
        }
      }
    `;

    try {
      const response = await fetch(LEETCODE_GRAPHQL_URL, {
        method: 'POST',
        headers: LC_HEADERS,
        body: JSON.stringify({ query })
      });
      
      const result = await response.json();
      const activeQuestion = result.data?.activeDailyCodingChallengeQuestion || null;
      
      let todayQuestion = null;
      if (activeQuestion && activeQuestion.question && activeQuestion.date) {
        todayQuestion = {
          date: activeQuestion.date,
          link: activeQuestion.link,
          title: activeQuestion.question.title,
          titleSlug: activeQuestion.question.titleSlug,
          difficulty: activeQuestion.question.difficulty
        };
      }

      const storageData = await StorageService.get(['leetcode_completedDates', 'leetcode_dailyQuestion']);
      const completedDates = storageData.leetcode_completedDates || [];
      
      if (todayQuestion) {
        await StorageService.set({ leetcode_dailyQuestion: todayQuestion });
      } else {
        todayQuestion = storageData.leetcode_dailyQuestion || null;
      }

      log.info('LeetCode daily challenge synced successfully.');
      return {
        dailyQuestion: todayQuestion,
        completedDates
      };
    } catch (error) {
      log.warn('Error fetching LeetCode daily question:', error);
      const storageData = await StorageService.get(['leetcode_completedDates', 'leetcode_dailyQuestion']);
      return {
        dailyQuestion: storageData.leetcode_dailyQuestion || null,
        completedDates: storageData.leetcode_completedDates || []
      };
    }
  },

  /**
   * Fetches solved statistics for a LeetCode user.
   * Note: LeetCode queries the active session cookies.
   * 
   * @param {string} [username] - LeetCode username (optional for LC session checks)
   * @returns {Promise<Object|null>} Solved statistics object or null.
   */
  async fetchUserStats(username) {
    const userStatusQuery = `
      query globalData {
        userStatus {
          username
          isSignedIn
        }
      }
    `;

    try {
      const statusResponse = await fetch(LEETCODE_GRAPHQL_URL, {
        method: 'POST',
        headers: LC_HEADERS,
        credentials: 'include',
        body: JSON.stringify({ query: userStatusQuery })
      });
      
      const statusResult = await statusResponse.json();
      const userStatus = statusResult.data?.userStatus;
      
      if (userStatus && userStatus.isSignedIn && userStatus.username) {
        const activeUsername = userStatus.username;
        
        const statsQuery = `
          query userProblemsSolved($username: String!) {
            matchedUser(username: $username) {
              profile { ranking }
              submitStats {
                acSubmissionNum {
                  difficulty
                  count
                }
              }
            }
          }
        `;
        
        const statsResponse = await fetch(LEETCODE_GRAPHQL_URL, {
          method: 'POST',
          headers: LC_HEADERS,
          credentials: 'include',
          body: JSON.stringify({
            query: statsQuery,
            variables: { username: activeUsername }
          })
        });
        
        const statsResult = await statsResponse.json();
        const matchedUser = statsResult.data?.matchedUser;
        const acSubmissions = matchedUser?.submitStats?.acSubmissionNum || [];
        const ranking = matchedUser?.profile?.ranking || 0;
        
        let total = 0, easy = 0, medium = 0, hard = 0;
        for (const item of acSubmissions) {
          if (item.difficulty === 'All') total = item.count;
          else if (item.difficulty === 'Easy') easy = item.count;
          else if (item.difficulty === 'Medium') medium = item.count;
          else if (item.difficulty === 'Hard') hard = item.count;
        }
        
        const solvedStats = {
          username: activeUsername,
          total,
          easy,
          medium,
          hard,
          ranking,
          lastUpdated: Date.now()
        };
        
        await StorageService.set({ leetcode_solvedStats: solvedStats });
        log.info('LeetCode stats synced:', solvedStats);
        return solvedStats;
      }
    } catch (error) {
      log.warn('Error fetching LeetCode user stats:', error);
    }
    return null;
  }
};
