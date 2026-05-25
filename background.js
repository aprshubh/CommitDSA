// LeetCode Daily Challenge Tracker - Service Worker

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

const REMINDER_TIMES = [
  { h: 9, m: 0 },
  { h: 12, m: 0 },
  { h: 15, m: 0 },
  { h: 18, m: 0 },
  { h: 20, m: 0 },
  { h: 22, m: 0 },
  { h: 23, m: 0 },
  { h: 23, m: 30 },
  { h: 24, m: 0 } // 12:00 AM midnight (00:00 next day)
];

// Helper to get formatted local date (YYYY-MM-DD)
function getLocalDateString(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 1. GraphQL Fetch for a specific month
async function fetchMonthChallenges(year, month) {
  const query = `
    query dailyCodingChallengeV2($year: Int, $month: Int) {
      dailyCodingChallengeV2(year: $year, month: $month) {
        challenges {
          date
          link
          userStatus
          question {
            title
            titleSlug
            difficulty
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(LEETCODE_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com'
      },
      credentials: 'include', // Sends user session cookies to check userStatus
      body: JSON.stringify({
        query,
        variables: { year, month }
      })
    });
    
    const result = await response.json();
    return result.data?.dailyCodingChallengeV2?.challenges || [];
  } catch (error) {
    console.warn(`[LeetCode Tracker] Error fetching month ${year}-${month}:`, error);
    return [];
  }
}

// 2. Fetch and Sync all challenges, completions, and streaks
async function fetchAndSyncChallenges() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Fetch current month's challenges
  const currentChallenges = await fetchMonthChallenges(currentYear, currentMonth);
  let allChallenges = [...currentChallenges];

  // If we are in the first 7 days, also fetch the previous month to support calendar back-tracking
  if (now.getDate() <= 7) {
    let prevYear = currentYear;
    let prevMonth = currentMonth - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const prevChallenges = await fetchMonthChallenges(prevYear, prevMonth);
    allChallenges = [...prevChallenges, ...allChallenges];
  }

  // Load existing storage data
  const storageData = await chrome.storage.local.get(['completedDates', 'challengesMap', 'dailyQuestion']);
  const completedDates = storageData.completedDates || [];
  const challengesMap = storageData.challengesMap || {};

  const todayStr = getLocalDateString();
  let todayQuestion = null;

  for (const c of allChallenges) {
    if (c && c.question && c.date) {
      // Map challenges
      challengesMap[c.date] = {
        date: c.date,
        link: c.link,
        title: c.question.title,
        titleSlug: c.question.titleSlug,
        difficulty: c.question.difficulty
      };

      if (c.date === todayStr) {
        todayQuestion = challengesMap[c.date];
      }

      // If userStatus indicates completed ("Finish"), log completion
      if (c.userStatus === 'Finish') {
        if (!completedDates.includes(c.date)) {
          completedDates.push(c.date);
        }
      }
    }
  }

  if (!todayQuestion) {
    todayQuestion = storageData.dailyQuestion || null;
  }

  // Recalculate streak
  const newStreak = await getActiveStreak(completedDates);

  // Update storage
  const syncData = {
    challengesMap,
    completedDates,
    streak: newStreak
  };
  if (todayQuestion) {
    syncData.dailyQuestion = todayQuestion;
  }
  await chrome.storage.local.set(syncData);

  console.log(`[LeetCode Tracker] Synced successfully. Streak: ${newStreak}, Solved dates:`, completedDates);
  return {
    dailyQuestion: todayQuestion || storageData.dailyQuestion,
    completedDates,
    streak: newStreak,
    challengesMap
  };
}

// Keep wrapper for startup/alarms compatibility
async function fetchDailyQuestion() {
  const synced = await fetchAndSyncChallenges();
  return synced.dailyQuestion;
}

// 3. Streak and History Calculations
function calculateStreak(completedDates, startingDateStr) {
  let streak = 0;
  let checkDate = new Date(startingDateStr);
  
  while (true) {
    const dateStr = getLocalDateString(checkDate);
    if (completedDates.includes(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

async function getActiveStreak(completedDates) {
  const todayStr = getLocalDateString();
  
  if (completedDates.includes(todayStr)) {
    return calculateStreak(completedDates, todayStr);
  }
  
  // If not completed today, check if yesterday was completed to keep the streak active
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);
  
  return calculateStreak(completedDates, yesterdayStr);
}

// 4. Notification Alarm Scheduler
function getNextReminderTime() {
  const now = new Date();
  const currentMs = now.getTime();
  
  for (let t of REMINDER_TIMES) {
    const target = new Date();
    if (t.h === 24) {
      target.setDate(target.getDate() + 1);
      target.setHours(0, 0, 0, 0);
    } else {
      target.setHours(t.h, t.m, 0, 0);
    }
    
    if (target.getTime() > currentMs) {
      return target;
    }
  }
  
  // Default fallback: 9:00 AM tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow;
}

function scheduleNextReminder() {
  chrome.alarms.clear('scheduled_reminder', () => {
    const nextTime = getNextReminderTime();
    const delay = nextTime.getTime() - Date.now();
    chrome.alarms.create('scheduled_reminder', { when: Date.now() + delay });
    console.log('[LeetCode Tracker] Scheduled next reminder alarm for:', nextTime.toString());
  });
}

function triggerReminderNotification() {
  chrome.storage.local.get(['dailyQuestion', 'completedDates'], (data) => {
    const todayStr = getLocalDateString();
    const completedDates = data.completedDates || [];
    
    if (completedDates.includes(todayStr)) {
      console.log('[LeetCode Tracker] Daily challenge already done. No notification needed.');
      return;
    }

    const title = data.dailyQuestion?.title || 'Daily Challenge';
    
    chrome.notifications.create('leetcode_reminder_notification', {
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'LeetCode Daily Challenge Alert!',
      message: `Your streak is burning! Today's question "${title}" is waiting. Click to solve it now.`,
      requireInteraction: true,
      priority: 2
    });
  });
}

// 5. Listen for alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log('[LeetCode Tracker] Alarm fired:', alarm.name);
  
  if (alarm.name === 'scheduled_reminder') {
    triggerReminderNotification();
    scheduleNextReminder();
  } else if (alarm.name === 'reminder_first_6h') {
    triggerReminderNotification();
  } else if (alarm.name === 'fetch_daily_periodic') {
    fetchAndSyncChallenges();
  }
});

// 6. Handle notification click
chrome.notifications.onClicked.addListener((id) => {
  if (id === 'leetcode_reminder_notification') {
    chrome.storage.local.get(['dailyQuestion'], (data) => {
      const link = data.dailyQuestion?.link;
      const url = link ? `https://leetcode.com${link}` : 'https://leetcode.com/problemset/all/';
      chrome.tabs.create({ url });
    });
  }
});

// 7. Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'VERIFY_SUBMISSION') {
    const submittedSlug = request.titleSlug;
    
    chrome.storage.local.get(['dailyQuestion', 'completedDates'], async (data) => {
      let dailyQuestion = data.dailyQuestion;
      const todayStr = getLocalDateString();
      
      // Re-fetch if dailyQuestion is empty or outdated (i.e. is from a previous day)
      if (!dailyQuestion || dailyQuestion.date !== todayStr) {
        const synced = await fetchAndSyncChallenges();
        dailyQuestion = synced.dailyQuestion;
      }
      
      if (dailyQuestion && dailyQuestion.titleSlug === submittedSlug) {
        const completedDates = data.completedDates || [];
        
        if (!completedDates.includes(todayStr)) {
          completedDates.push(todayStr);
          const newStreak = await getActiveStreak(completedDates);
          
          await chrome.storage.local.set({
            completedDates,
            streak: newStreak,
            lastCompletedDate: todayStr
          });
          
          sendResponse({
            isDailyCompleted: true,
            dailyData: dailyQuestion,
            streak: newStreak
          });
          
          // Clear any active notification & reschedule alarms
          chrome.notifications.clear('leetcode_reminder_notification');
          scheduleNextReminder();
          return;
        }
      }
      
      sendResponse({ isDailyCompleted: false });
    });
    
    return true; // Keep message channel open for async response
  }
  
  if (request.type === 'GET_DASHBOARD_DATA' || request.type === 'FORCE_REFRESH_DAILY') {
    fetchAndSyncChallenges().then((syncedData) => {
      sendResponse(syncedData);
    }).catch((err) => {
      console.warn('[LeetCode Tracker] Sync failed in message listener:', err);
      // Fallback response from cache
      chrome.storage.local.get(['dailyQuestion', 'completedDates', 'streak', 'challengesMap'], (cache) => {
        sendResponse({
          dailyQuestion: cache.dailyQuestion || null,
          completedDates: cache.completedDates || [],
          streak: cache.streak || 0,
          challengesMap: cache.challengesMap || {}
        });
      });
    });
    
    return true; // Keep message channel open for async response
  }
});

// 8. Initialize extension
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[LeetCode Tracker] Extension installed.');
  
  // Set up storage defaults
  chrome.storage.local.get(['completedDates', 'streak'], (data) => {
    if (!data.completedDates) {
      chrome.storage.local.set({ completedDates: [], streak: 0 });
    }
  });

  // Fetch daily question right away
  fetchAndSyncChallenges();

  // Create periodic alarm to fetch daily question every 4 hours to stay in sync
  chrome.alarms.create('fetch_daily_periodic', { periodInMinutes: 240 });

  // Set up initial reminders
  // Reminder 1: First reminder in 6 hours
  chrome.alarms.create('reminder_first_6h', { delayInMinutes: 360 });

  // Reminder 2: Scheduled specific time slot alerts
  scheduleNextReminder();
});

chrome.runtime.onStartup.addListener(() => {
  fetchAndSyncChallenges();
  scheduleNextReminder();
});
