// LeetSync - Refined Popup Script

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Local states
let localCompletedDates = [];
let localChallengesMap = {};
let localStreak = 0;
let localDailyQuestion = null;
let localSolvedStats = null;
let selectedDateStr = ''; // Whichever day is clicked/locked
let todayDateStr = '';

// Helper to get formatted local date (YYYY-MM-DD)
function getLocalDateString(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Format YYYY-MM-DD into a human-readable string (e.g. May 26, 2026)
function formatFriendlyDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Live countdown timer showing time remaining until the next LeetCode challenge rolls over (00:00 UTC)
function startCountdown() {
  const timerEl = document.getElementById('motivational-quote');
  if (!timerEl) return;

  function updateTimer() {
    const now = new Date();
    const nextReset = new Date();
    // LeetCode Daily Challenge resets at exactly midnight 00:00:00 UTC daily
    nextReset.setUTCHours(24, 0, 0, 0); 
    
    const msDiff = nextReset.getTime() - now.getTime();
    if (msDiff <= 0) {
      timerEl.textContent = 'New challenge arriving...';
      return;
    }
    
    const hours = Math.floor(msDiff / (1000 * 60 * 60));
    const minutes = Math.floor((msDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((msDiff % (1000 * 60)) / 1000);
    
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    
    timerEl.textContent = `Next challenge in ${hh}:${mm}:${ss}`;
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

// Render dynamic inspection card
function updateInspectorCard(dateStr) {
  const challenge = localChallengesMap[dateStr];
  const isCompleted = localCompletedDates.includes(dateStr);

  const card = document.getElementById('challenge-card');
  const label = document.getElementById('inspector-label');
  const titleEl = document.getElementById('question-title');
  const diffEl = document.getElementById('question-difficulty');
  const dateEl = document.getElementById('question-date');
  const solveBtn = document.getElementById('solve-btn');

  // Update inspection category tag
  if (dateStr === todayDateStr) {
    label.textContent = "Today's Challenge";
  } else {
    label.textContent = `${formatFriendlyDate(dateStr)} Challenge`;
  }

  // Update card visual class
  if (isCompleted) {
    card.classList.add('completed');
  } else {
    card.classList.remove('completed');
  }

  // Bind contents
  if (challenge) {
    titleEl.textContent = challenge.title;
    diffEl.textContent = challenge.difficulty;
    diffEl.className = `difficulty-badge ${challenge.difficulty.toLowerCase()}`;
    dateEl.textContent = formatFriendlyDate(challenge.date);

    if (isCompleted) {
      solveBtn.textContent = 'Challenge Completed';
      solveBtn.onclick = null;
    } else {
      solveBtn.textContent = 'Solve Challenge';
      solveBtn.onclick = () => {
        const url = `https://leetcode.com${challenge.link}`;
        chrome.tabs.create({ url });
      };
    }
  } else {
    titleEl.textContent = 'Challenge details not synced.';
    diffEl.textContent = 'Unknown';
    diffEl.className = 'difficulty-badge easy';
    dateEl.textContent = formatFriendlyDate(dateStr);
    
    solveBtn.textContent = 'Search LeetCode';
    solveBtn.onclick = () => {
      chrome.tabs.create({ url: 'https://leetcode.com/problemset/all/' });
    };
  }

  // Removed motivational quote update to favor countdown timer
}

// Generate the list of monthly incompleted challenges + today's challenge
function renderWeeklyTracker() {
  const weeklyRow = document.getElementById('weekly-row');
  weeklyRow.replaceChildren();

  // If user is not logged in, show login warning instead of dots
  if (!localSolvedStats) {
    const loginPrompt = document.createElement('div');
    loginPrompt.className = 'login-alert';
    loginPrompt.style.width = '100%';
    loginPrompt.style.textAlign = 'center';
    loginPrompt.textContent = 'Login to leetcode.com to see backlog';
    weeklyRow.appendChild(loginPrompt);
    return;
  }

  const todayStr = todayDateStr;
  
  // Timezone-safe calculation of yesterday relative to LeetCode's today string
  const todayDateObj = new Date(todayStr + 'T00:00:00');
  const yesterdayDateObj = new Date(todayDateObj);
  yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1);
  
  const yyyy = yesterdayDateObj.getFullYear();
  const mm = String(yesterdayDateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(yesterdayDateObj.getDate()).padStart(2, '0');
  const yesterdayStr = `${yyyy}-${mm}-${dd}`;

  const currentMonthPrefix = todayStr.substring(0, 7); // e.g. "2026-05"

  // 1. Get all synced challenges in the current month up to today (chronological order)
  const monthDates = Object.keys(localChallengesMap)
    .filter(date => date.startsWith(currentMonthPrefix) && date <= todayStr)
    .sort();

  // 2. Filter out today to get past dates
  const pastDates = monthDates.filter(date => date !== todayStr);

  // 3. Unsolved past challenges, capped at max 3 previous problems
  const unsolvedPast = pastDates.filter(date => !localCompletedDates.includes(date));
  const limitedUnsolvedPast = unsolvedPast.slice(-3);

  // 4. Solved past challenges (which now automatically includes yesterday if it was completed!)
  const solvedPast = pastDates.filter(date => localCompletedDates.includes(date));

  // 5. Last solved challenge before today
  const lastSolvedStr = solvedPast.length > 0 ? solvedPast[solvedPast.length - 1] : null;

  // Assemble display list:
  // - First, all unsolved past dates (limited to 3)
  // - Next, the last solved challenge (if exists)
  // - Finally, today's challenge (current day, labeled TD)
  const displayDates = [...limitedUnsolvedPast];
  
  if (lastSolvedStr && !displayDates.includes(lastSolvedStr)) {
    displayDates.push(lastSolvedStr);
  }

  // Add today (current day)
  if (localChallengesMap[todayStr]) {
    displayDates.push(todayStr);
  } else if (localDailyQuestion && localDailyQuestion.date === todayStr) {
    displayDates.push(todayStr);
    localChallengesMap[todayStr] = localDailyQuestion;
  } else {
    displayDates.push(todayStr);
  }

  // Render dots in the flexbox container
  displayDates.forEach((dateStr) => {
    const isToday = dateStr === todayStr;
    const isCompleted = localCompletedDates.includes(dateStr);
    const challenge = localChallengesMap[dateStr];
    
    const targetDate = new Date(dateStr);
    const dayLabel = daysOfWeek[targetDate.getDay()].slice(0, 2);
    const dayNum = targetDate.getDate();

    const dayItem = document.createElement('div');
    dayItem.className = 'day-item';

    let dotClass = 'day-dot';
    if (isCompleted) {
      dotClass += ' completed';
    } else if (dateStr !== todayStr) {
      dotClass += ' missed';
    }

    if (isToday) {
      dotClass += ' today';
    }

    if (dateStr === selectedDateStr) {
      dotClass += ' selected';
    }

    const dayDot = document.createElement('div');
    dayDot.className = dotClass;
    dayDot.textContent = isCompleted ? '✓' : dayNum;
    
    // Custom tooltip showing question title on hover
    if (challenge) {
      dayDot.title = `${formatFriendlyDate(dateStr)}: ${challenge.title} (${challenge.difficulty})`;
    } else {
      dayDot.title = formatFriendlyDate(dateStr);
    }

    // Click events to lock selection
    dayDot.addEventListener('click', () => {
      selectedDateStr = dateStr;
      
      // Update selected class in DOM
      document.querySelectorAll('.day-dot').forEach(el => {
        el.classList.remove('selected');
      });
      dayDot.classList.add('selected');
      
      updateInspectorCard(dateStr);
    });

    dayItem.appendChild(dayDot);
    
    let labelText = dayLabel;
    if (isToday) {
      labelText = 'TD';
    } else if (dateStr === lastSolvedStr) {
      labelText = 'LS';
    }

    const dayLblSpan = document.createElement('span');
    dayLblSpan.className = 'day-lbl';
    dayLblSpan.textContent = labelText;
    dayItem.insertBefore(dayLblSpan, dayDot);

    weeklyRow.appendChild(dayItem);
  });

  // If selectedDateStr is no longer in the list (e.g. if we solved a past day, it might disappear from the incomplete list),
  // fallback selectedDateStr to today's date.
  if (!displayDates.includes(selectedDateStr)) {
    selectedDateStr = todayStr;
    updateInspectorCard(selectedDateStr);
  }
}

// macOS Dock Magnification Wave Effect
function initMacDockEffect() {
  const row = document.getElementById('weekly-row');
  if (!row) return;

  row.addEventListener('mousemove', (e) => {
    const rect = row.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; // cursor X relative to row

    const dots = row.querySelectorAll('.day-dot');
    dots.forEach((dot) => {
      const dotRect = dot.getBoundingClientRect();
      const dotCenterX = (dotRect.left + dotRect.right) / 2 - rect.left;
      const dx = Math.abs(mouseX - dotCenterX);

      const maxScale = 1.35; // Maximum magnification
      const range = 45; // Influence range (in pixels)
      let scale = 1;
      
      if (dx < range) {
        const factor = 1 - dx / range;
        scale = 1 + (maxScale - 1) * factor;
      }

      const translateY = (scale - 1) * -8; // Lift dot up to 8px
      dot.style.transform = `translateY(${translateY}px) scale(${scale})`;
      dot.style.zIndex = scale > 1.05 ? '10' : '1';
    });
  });

  row.addEventListener('mouseleave', () => {
    const dots = row.querySelectorAll('.day-dot');
    dots.forEach((dot) => {
      dot.style.transform = '';
      dot.style.zIndex = '';
    });
  });
}

// Calculate max consecutive streak from completed dates
function getMaxStreak(completedDates) {
  if (!completedDates || completedDates.length === 0) return 0;
  
  // Sort dates chronologically
  const sorted = [...completedDates].sort();
  let maxStreak = 0;
  let currentStreak = 0;
  let prevDate = null;

  for (const dateStr of sorted) {
    const currentDate = new Date(dateStr + 'T00:00:00');
    if (!prevDate) {
      currentStreak = 1;
    } else {
      const diffTime = currentDate - prevDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
      } else if (diffDays > 1) {
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
        }
        currentStreak = 1;
      }
    }
    prevDate = currentDate;
  }
  return Math.max(maxStreak, currentStreak);
}

// Render overall dashboard
function renderDashboard(data) {
  localCompletedDates = data.completedDates || [];
  localChallengesMap = data.challengesMap || {};
  localStreak = data.streak || 0;
  localDailyQuestion = data.dailyQuestion;
  localSolvedStats = data.solvedStats;

  // Align todayDateStr with LeetCode's active date, fallback to system date if empty
  todayDateStr = localDailyQuestion ? localDailyQuestion.date : getLocalDateString();
  
  if (!selectedDateStr) {
    selectedDateStr = todayDateStr; // Default inspector to today
  }

  // Update Streak
  document.getElementById('streak-count').textContent = localStreak;
  const streakContainer = document.getElementById('streak-container');
  if (localStreak > 0) {
    streakContainer.style.opacity = '1';
  } else {
    streakContainer.style.opacity = '0.6';
  }

  // Update Streak Stats Badge Tooltip details
  const currentStreakEl = document.getElementById('streak-current');
  const maxStreakEl = document.getElementById('streak-max');
  const totalDaysEl = document.getElementById('streak-total-days');

  const maxStreak = getMaxStreak(localCompletedDates);
  if (currentStreakEl) currentStreakEl.textContent = localStreak;
  if (maxStreakEl) maxStreakEl.textContent = maxStreak;
  if (totalDaysEl) totalDaysEl.textContent = localCompletedDates.length;

  // Update Solved Stats Badge and Tooltip
  const solvedStats = data.solvedStats;
  const solvedCountEl = document.getElementById('solved-count');
  const solvedEasyEl = document.getElementById('solved-easy');
  const solvedMediumEl = document.getElementById('solved-medium');
  const solvedHardEl = document.getElementById('solved-hard');
  const solvedRowsEl = document.getElementById('solved-stats-rows');
  const solvedAlertEl = document.getElementById('solved-login-alert');
  
  if (solvedCountEl) {
    solvedCountEl.textContent = solvedStats ? (solvedStats.total || 0) : '--';
  }

  if (solvedStats) {
    if (solvedRowsEl) solvedRowsEl.style.display = 'block';
    if (solvedAlertEl) solvedAlertEl.style.display = 'none';
    if (solvedEasyEl) solvedEasyEl.textContent = solvedStats.easy || 0;
    if (solvedMediumEl) solvedMediumEl.textContent = solvedStats.medium || 0;
    if (solvedHardEl) solvedHardEl.textContent = solvedStats.hard || 0;
  } else {
    if (solvedRowsEl) solvedRowsEl.style.display = 'none';
    if (solvedAlertEl) solvedAlertEl.style.display = 'block';
  }

  // Update Timeline and Card
  renderWeeklyTracker();
  updateInspectorCard(selectedDateStr);
}

// Request data from background service worker
function loadDashboardData(forceRefresh = false) {
  // 1. Instant Load: Render immediately from local storage for zero-lag UI
  chrome.storage.local.get(['dailyQuestion', 'completedDates', 'streak', 'challengesMap', 'solvedStats'], (cache) => {
    if (cache && Object.keys(cache).length > 0) {
      renderDashboard(cache);
    }
  });

  // 2. Background Sync: Ask service worker to fetch/verify data
  const actionType = forceRefresh ? 'FORCE_REFRESH_DAILY' : 'GET_DASHBOARD_DATA';
  
  chrome.runtime.sendMessage({ type: actionType }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[LeetSync] Service worker communication failed:', chrome.runtime.lastError);
      return;
    }
    
    if (response) {
      // Re-render if background fetched new fresh data
      renderDashboard(response);
    }
  });
}

// Theme logic
function initTheme() {
  chrome.storage.local.get(['theme'], (res) => {
    const theme = res.theme || 'light'; // Default to light mode
    document.body.className = `theme-${theme}`;
  });

  const themeBtn = document.getElementById('theme-toggle-btn');
  themeBtn.addEventListener('click', () => {
    const isLight = document.body.classList.contains('theme-light');
    const newTheme = isLight ? 'dark' : 'light';
    document.body.className = `theme-${newTheme}`;
    chrome.storage.local.set({ theme: newTheme });
  });
}

// On Load initialization
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMacDockEffect(); // Bind the macOS Dock magnification wave listener
  startCountdown(); // Initialize footer countdown clock
  loadDashboardData(false);

  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.addEventListener('click', () => {
    // Rotation animation
    refreshBtn.style.transform = 'rotate(360deg)';
    refreshBtn.style.transition = 'transform 0.6s ease';
    
    loadDashboardData(true);
    
    setTimeout(() => {
      refreshBtn.style.transform = 'none';
      refreshBtn.style.transition = 'none';
    }, 600);
  });
});
