/**
 * @fileoverview LeetCode integration module.
 * Interacts with the LeetCode GraphQL API to fetch Daily Coding Challenges and User Stats.
 */

import { getActiveDateString } from './utils.js';

const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql/";

const LC_HEADERS = {
  'Content-Type': 'application/json',
  'Referer': 'https://leetcode.com'
};

/**
 * Fetches the active daily coding challenge via the LeetCode GraphQL API.
 * 
 * @returns {Promise<Object|null>} A promise resolving to the challenge object.
 */
export async function fetchDailyQuestion() {
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
    return result.data?.activeDailyCodingChallengeQuestion || null;
  } catch (error) {
    console.warn('[CommitDSA] Error fetching LeetCode daily question:', error);
    return null;
  }
}

/**
 * Fetches the logged-in user's global solved statistics from LeetCode.
 * Uses two separate GraphQL queries (one for username, one for stats).
 * 
 * @returns {Promise<Object|null>} An object containing total, easy, medium, hard counts and ranking, or null.
 */
export async function fetchUserSolvedStats() {
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
      const username = userStatus.username;
      
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
          variables: { username }
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
        username,
        total,
        easy,
        medium,
        hard,
        ranking,
        lastUpdated: Date.now()
      };
      
      await chrome.storage.local.set({ leetcode_solvedStats: solvedStats });
      console.log('[CommitDSA] LeetCode stats synced:', solvedStats);
      return solvedStats;
    }
  } catch (error) {
    console.warn('[CommitDSA] Error fetching LeetCode user stats:', error);
  }
  return null;
}

/**
 * Main coordinator function for LeetCode syncing.
 * Fetches today's question, updates the local storage map.
 * 
 * @returns {Promise<Object>} An object containing dailyQuestion and completedDates.
 */
export async function fetchAndSyncChallenges() {
  const activeQuestion = await fetchDailyQuestion();

  // Load existing storage data
  const storageData = await chrome.storage.local.get(['leetcode_completedDates', 'leetcode_dailyQuestion']);
  const completedDates = storageData.leetcode_completedDates || [];

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

  if (!todayQuestion) {
    todayQuestion = storageData.leetcode_dailyQuestion || null;
  }

  // Update storage
  const syncData = {
    leetcode_completedDates: completedDates
  };
  if (todayQuestion) {
    syncData.leetcode_dailyQuestion = todayQuestion;
  }
  await chrome.storage.local.set(syncData);

  console.log(`[CommitDSA] LeetCode synced successfully.`);
  return {
    dailyQuestion: todayQuestion || storageData.leetcode_dailyQuestion,
    completedDates
  };
}
