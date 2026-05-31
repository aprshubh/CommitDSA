import { CodingPlatform } from './CodingPlatform.js';

const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql/";
const LC_HEADERS = {
  'Content-Type': 'application/json',
  'Referer': 'https://leetcode.com'
};

export class LeetCodePlatform extends CodingPlatform {
  constructor() {
    super('LeetCode', 'leetcode');
  }

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

      const completedDates = await this.getFromLocalStorage('completedDates', []);
      
      if (todayQuestion) {
        await this.saveToLocalStorage('dailyQuestion', todayQuestion);
      } else {
        todayQuestion = await this.getFromLocalStorage('dailyQuestion', null);
      }

      await this.saveToLocalStorage('completedDates', completedDates);

      console.log(`[CommitDSA] LeetCode daily challenge synced successfully.`);
      return {
        dailyQuestion: todayQuestion,
        completedDates
      };
    } catch (error) {
      console.warn('[CommitDSA] Error fetching LeetCode daily question:', error);
      const completedDates = await this.getFromLocalStorage('completedDates', []);
      const dailyQuestion = await this.getFromLocalStorage('dailyQuestion', null);
      return { dailyQuestion, completedDates };
    }
  }

  async fetchUserStats(username) {
    // Note: username is optional for LeetCode as it queries active session cookies
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
        
        await this.saveToLocalStorage('solvedStats', solvedStats);
        console.log('[CommitDSA] LeetCode stats synced:', solvedStats);
        return solvedStats;
      }
    } catch (error) {
      console.warn('[CommitDSA] Error fetching LeetCode user stats:', error);
    }
    return null;
  }

  getSolveUrl(question) {
    return question.link
      ? (question.link.startsWith('http') ? question.link : `https://leetcode.com${question.link}`)
      : `https://leetcode.com/problems/${question.titleSlug}/`;
  }
}
