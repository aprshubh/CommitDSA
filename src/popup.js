'use strict';

/**
 * @fileoverview Main logic for the Extension Popup (Dashboard & Settings).
 * Handles platform switching, data rendering from local storage, and configuration management.
 */

/* ================================================================
   PLATFORM CONFIG — add new platforms here only.
   Every other part of the code reads from this object.
================================================================ */
const PLATFORMS = {
  leetcode: {
    id:         'leetcode',
    label:      'LeetCode',
    emoji:      '🟡',
    prefix:     '',            // storage key prefix (completedDates, streak, etc.)
    rankClass:  'lc-rank',
    rankKey:    'ranking',     // field name inside solvedStats
    solveUrl:   (q) => q.link
                  ? (q.link.startsWith('http') ? q.link : `https://leetcode.com${q.link}`)
                  : `https://leetcode.com/problems/${q.titleSlug}/`,
  },
  gfg: {
    id:         'gfg',
    label:      'GFG',
    emoji:      '🟢',
    prefix:     'gfg_',
    rankClass:  'gfg-rank',
    rankKey:    'rank',
    solveUrl:   (q) => q.link
                  ? (q.link.startsWith('http') ? q.link : `https://www.geeksforgeeks.org${q.link}`)
                  : `https://www.geeksforgeeks.org/problems/${q.titleSlug}/1`,
  },
};

/* ================================================================
   STATE
================================================================ */
let activePlatform   = 'leetcode';
let countdownTimer   = null;

/* ================================================================
   UTILITIES
================================================================ */
// Helper to get formatted date string for the active platform
// LeetCode resets at midnight UTC. GFG resets at midnight IST (UTC+5:30).
function getActiveDateString(platform = 'leetcode') {
  const d = new Date();
  if (platform === 'leetcode') {
    return d.toISOString().split('T')[0]; // UTC date
  } else {
    // GFG (IST date)
    const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + (330 * 60000)); // +5:30
    const yyyy = istTime.getFullYear();
    const mm   = String(istTime.getMonth() + 1).padStart(2, '0');
    const dd   = String(istTime.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}

function getMaxStreak(dates) {
  if (!dates || !dates.length) return 0;
  const sorted = [...new Set(dates)].sort();
  let max = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000;
    cur = diff === 1 ? cur + 1 : 1;
    if (cur > max) max = cur;
  }
  return max;
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function nextReset(platform) {
  const now = new Date();
  if (platform === 'leetcode') {
    // LeetCode resets at midnight UTC — calculate next midnight UTC
    const next = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
    ));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  } else {
    // GFG resets at midnight IST = 18:30 UTC (previous calendar day)
    const next = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 18, 30
    ));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
}

/* ================================================================
   THEME & PALETTE SYSTEM
================================================================ */
const PALETTE_COLORS = {
  classic: {
    dark: { accent: '#ffffff', glow: 'rgba(255, 255, 255, 0.15)', text: '#000000' },
    light: { accent: '#000000', glow: 'rgba(0, 0, 0, 0.15)', text: '#ffffff' }
  },
  volt: {
    dark: { accent: '#CCFF00', glow: 'rgba(204, 255, 0, 0.2)', text: '#000000' },
    light: { accent: '#059669', glow: 'rgba(5, 150, 105, 0.2)', text: '#ffffff' }
  },
  violet: {
    dark: { accent: '#A78BFA', glow: 'rgba(167, 139, 250, 0.2)', text: '#000000' },
    light: { accent: '#7C3AED', glow: 'rgba(124, 58, 237, 0.2)', text: '#ffffff' }
  },
  orange: {
    dark: { accent: '#FF6B00', glow: 'rgba(255, 107, 0, 0.2)', text: '#ffffff' },
    light: { accent: '#E25800', glow: 'rgba(226, 88, 0, 0.2)', text: '#ffffff' }
  },
  frost: {
    dark: { accent: '#38BDF8', glow: 'rgba(56, 189, 248, 0.2)', text: '#0f172a' },
    light: { accent: '#0284C7', glow: 'rgba(2, 132, 199, 0.2)', text: '#ffffff' }
  },
  rose: {
    dark: { accent: '#fb7185', glow: 'rgba(251, 113, 133, 0.2)', text: '#ffffff' },
    light: { accent: '#e11d48', glow: 'rgba(225, 29, 72, 0.2)', text: '#ffffff' }
  },
  // Legacy aliases
  indigo: {
    dark: { accent: '#A78BFA', glow: 'rgba(167, 139, 250, 0.2)', text: '#000000' },
    light: { accent: '#7C3AED', glow: 'rgba(124, 58, 237, 0.2)', text: '#ffffff' }
  },
  emerald: {
    dark: { accent: '#CCFF00', glow: 'rgba(204, 255, 0, 0.2)', text: '#000000' },
    light: { accent: '#059669', glow: 'rgba(5, 150, 105, 0.2)', text: '#ffffff' }
  },
  amber: {
    dark: { accent: '#FF6B00', glow: 'rgba(255, 107, 0, 0.2)', text: '#ffffff' },
    light: { accent: '#E25800', glow: 'rgba(226, 88, 0, 0.2)', text: '#ffffff' }
  },
  cyan: {
    dark: { accent: '#38BDF8', glow: 'rgba(56, 189, 248, 0.2)', text: '#0f172a' },
    light: { accent: '#0284C7', glow: 'rgba(2, 132, 199, 0.2)', text: '#ffffff' }
  }
};

function applyAccentColor(colorName, theme) {
  const body = document.body;
  if (!body) return;
  const colorConfig = PALETTE_COLORS[colorName] || PALETTE_COLORS.classic;
  const config = colorConfig[theme] || colorConfig.dark;

  body.style.setProperty('--accent', config.accent);
  body.style.setProperty('--accent-glow', config.glow);
  body.style.setProperty('--accent-text', config.text);
}

function initTheme() {
  chrome.storage.local.get(['theme', 'themeColor'], ({ theme, themeColor }) => {
    const activeTheme = theme || 'dark';
    const activeColor = themeColor || 'classic';
    document.body.className = `theme-${activeTheme}`;
    applyAccentColor(activeColor, activeTheme);
  });
  
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const isDark = document.body.classList.contains('theme-dark');
    const nextTheme = isDark ? 'light' : 'dark';
    document.body.className = `theme-${nextTheme}`;
    chrome.storage.local.set({ theme: nextTheme });
    
    chrome.storage.local.get(['themeColor'], ({ themeColor }) => {
      applyAccentColor(themeColor || 'classic', nextTheme);
    });
  });
}

function initPalette() {
  const paletteBtn = document.getElementById('palette-btn');
  const dropdown   = document.getElementById('palette-dropdown');
  if (!paletteBtn || !dropdown) return;

  paletteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isShown = dropdown.style.display === 'block';
    dropdown.style.display = isShown ? 'none' : 'block';
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== paletteBtn) {
      dropdown.style.display = 'none';
    }
  });

  chrome.storage.local.get(['theme', 'themeColor'], ({ theme, themeColor }) => {
    const activeColor = themeColor || 'classic';
    const activeTheme = theme || 'dark';
    
    dropdown.querySelectorAll('.color-swatch').forEach(swatch => {
      if (swatch.dataset.color === activeColor) {
        swatch.classList.add('active');
      } else {
        swatch.classList.remove('active');
      }
    });

    applyAccentColor(activeColor, activeTheme);
  });

  dropdown.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.color;
      
      dropdown.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');

      chrome.storage.local.get(['theme'], ({ theme }) => {
        const activeTheme = theme || 'dark';
        applyAccentColor(color, activeTheme);
        chrome.storage.local.set({ themeColor: color });
      });
    });
  });
}

/* ================================================================
   VIEW SWITCHING
================================================================ */
function showView(id) {
  document.querySelectorAll('.view').forEach(v => {
    v.style.display = 'none';
    v.classList.remove('visible');
  });
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'block';
    void el.offsetWidth; // Force reflow
    el.classList.add('visible');
  }
}
function showDashboard() { showView('dashboard-view'); }
function showSettings()  {
  buildPlatformCards();
  loadSettingsValues();
  showView('settings-view');
}

/* ================================================================
   PLATFORM TABS — built dynamically from PLATFORMS config
================================================================ */
function updateTabHighlight() {
  const activeTab = document.querySelector('.tab-btn.active');
  const highlight = document.getElementById('tab-highlight');
  if (!activeTab || !highlight) return;

  highlight.style.width     = `${activeTab.offsetWidth}px`;
  highlight.style.transform = `translateX(${activeTab.offsetLeft}px)`;
}

function buildTabs() {
  const container = document.getElementById('platform-tabs');
  if (!container) return;
  container.textContent = '';

  chrome.storage.local.get(['enabledPlatforms'], (data) => {
    const enabledList = data.enabledPlatforms || Object.keys(PLATFORMS);
    
    // Filter platforms to only those enabled
    const enabledPlats = Object.values(PLATFORMS).filter(cfg => enabledList.includes(cfg.id));
    
    if (enabledPlats.length === 0) {
      container.textContent = 'No platforms enabled in settings.';
      return;
    }

    // Add sliding highlight
    const highlight = document.createElement('div');
    highlight.className = 'tab-highlight';
    highlight.id        = 'tab-highlight';
    container.appendChild(highlight);

    enabledPlats.forEach((cfg, i) => {
      const btn = document.createElement('button');
      btn.className   = 'tab-btn' + (cfg.id === activePlatform ? ' active' : '');
      btn.dataset.platform = cfg.id;
      btn.textContent = cfg.label;
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activePlatform = cfg.id;
        updateRankBadge();
        restartCountdown();
        loadDashboard(false);
        updateTabHighlight();
      });
      container.appendChild(btn);
    });

    // Automatically select the first enabled platform on load
    if (enabledPlats.length > 0 && !enabledList.includes(activePlatform)) {
      activePlatform = enabledPlats[0].id;
    }

    container.querySelectorAll('.tab-btn').forEach(b => {
      if (b.dataset.platform === activePlatform) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    setTimeout(updateTabHighlight, 0);
  });
}

/* ================================================================
   RANK BADGE
================================================================ */
function updateRankBadge() {
  const badge = document.getElementById('rank-badge');
  const valEl = document.getElementById('rank-val');
  if (!badge || !valEl) return;

  const cfg = PLATFORMS[activePlatform];
  badge.className = `rank-badge ${cfg.rankClass}`;

  const key = activePlatform === 'leetcode' ? 'leetcode_solvedStats' : 'gfg_solvedStats';

  chrome.storage.local.get([key], (data) => {
    const stats = data[key] || null;
    const rank  = stats ? (stats[cfg.rankKey] || stats.rank || stats.ranking) : null;
    
    const emojiEl = document.getElementById('rank-emoji');
    
    if (activePlatform === 'gfg') {
      const score = stats ? (stats.score || 0) : 0;
      valEl.textContent = score ? Number(score).toLocaleString() : '—';
      valEl.style.fontSize = '';
      valEl.title = 'GFG Score';
      if (emojiEl) {
        emojiEl.textContent = '⭐';
        emojiEl.title = 'Score';
      }
      badge.title = 'GeeksforGeeks Score';
    } else {
      valEl.textContent = rank ? Number(rank).toLocaleString() : '—';
      valEl.style.fontSize = '';
      valEl.title = 'Global Rank';
      if (emojiEl) {
        emojiEl.textContent = '🏆';
        emojiEl.title = 'Global Rank';
      }
      badge.title = 'Global Rank';
    }
  });
}

/* ================================================================
   LEFT COLUMN — Daily Challenge
================================================================ */
function renderChallenge(dailyQuestion, completedDates) {
  const card    = document.getElementById('chal-card');
  const diffEl  = document.getElementById('chal-diff');
  const dateEl  = document.getElementById('chal-date');
  const titleEl = document.getElementById('chal-title');
  const solveBtn = document.getElementById('solve-btn');
  if (!card) return;

  if (!dailyQuestion || !dailyQuestion.title) {
    if (diffEl)  diffEl.textContent  = '—';
    if (dateEl)  dateEl.textContent  = '—';
    if (titleEl) titleEl.textContent = 'No challenge available';
    if (solveBtn) { solveBtn.style.display = 'none'; }
    return;
  }

  if (solveBtn) solveBtn.style.display = '';

  // Difficulty badge
  const diff = (dailyQuestion.difficulty || 'Medium').toLowerCase();
  if (diffEl) {
    diffEl.textContent = dailyQuestion.difficulty || '—';
    diffEl.className   = `diff-badge ${diff}`;
  }

  // Date
  if (dateEl) {
    const d = dailyQuestion.date
      ? new Date(dailyQuestion.date + 'T00:00:00')
      : new Date();
    dateEl.textContent = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Title
  if (titleEl) titleEl.textContent = dailyQuestion.title;

  // Completed?
  const today       = dailyQuestion.date || getActiveDateString(activePlatform);
  const isCompleted = Array.isArray(completedDates) && completedDates.includes(today);

  if (isCompleted) {
    card.classList.add('completed');
    if (solveBtn) {
      solveBtn.textContent = 'Solved ✓';
      solveBtn.className   = 'solve-btn solved';
      solveBtn.onclick     = null;
    }
  } else {
    card.classList.remove('completed');
    if (solveBtn) {
      solveBtn.textContent = 'Solve →';
      solveBtn.className   = 'solve-btn';
      solveBtn.onclick     = () => {
        const cfg = PLATFORMS[activePlatform];
        chrome.tabs.create({ url: cfg.solveUrl(dailyQuestion) });
      };
    }
  }
}

/* ================================================================
   RIGHT COLUMN — Stats
================================================================ */
function renderStats(solvedStats) {
  const totalEl = document.getElementById('stat-total');
  if (totalEl) totalEl.textContent = solvedStats?.total ?? '—';

  const diffList = document.getElementById('diff-list');
  if (!diffList) return;
  diffList.textContent = ''; // Clear previous

  // Determine difficulty categories based on platform
  const categories = [];
  if (activePlatform === 'gfg') {
    categories.push({ id: 'basic', label: 'Basic', css: 'basic' });
  }
  categories.push({ id: 'easy', label: 'Easy', css: 'easy' });
  categories.push({ id: 'medium', label: 'Med', css: 'medium' });
  categories.push({ id: 'hard', label: 'Hard', css: 'hard' });

  categories.forEach(cat => {
    const row = document.createElement('div');
    row.className = 'diff-row';

    const dot = document.createElement('span');
    dot.className = `diff-dot ${cat.css}`;

    const name = document.createElement('span');
    name.className = 'diff-name';
    name.textContent = cat.label;

    const val = document.createElement('span');
    val.className = 'diff-val';
    val.id = `stat-${cat.id}`;
    val.textContent = solvedStats ? (solvedStats[cat.id] ?? '—') : '—';

    row.appendChild(dot);
    row.appendChild(name);
    row.appendChild(val);
    diffList.appendChild(row);
  });
}

function showSyncError(errMsg) {
  const el = document.getElementById('countdown-text');
  if (!el) return;
  if (countdownTimer) clearInterval(countdownTimer);
  el.textContent = 'Sync Failed: Check connection ⚠️';
  el.style.color = 'var(--hard)';
  setTimeout(() => {
    el.style.color = '';
    restartCountdown();
  }, 3000);
}

/* ================================================================
   COUNTDOWN
================================================================ */
function restartCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  const el = document.getElementById('countdown-text');
  if (!el) return;
  const tick = () => {
    const next = nextReset(activePlatform);
    if (!next) { el.textContent = 'Next challenge in —'; return; }
    el.textContent = `Next challenge in ${formatCountdown(next - Date.now())}`;
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

/* ================================================================
   GITHUB PUSH TOGGLE
================================================================ */
function updateGitHubStatus() {
  const dot = document.getElementById('gh-status-dot');
  if (!dot) return;

  chrome.storage.local.get(['githubToken', 'githubRepo', 'githubEnabled'], ({ githubToken, githubRepo, githubEnabled }) => {
    const hasToken = !!(githubToken && githubToken.trim().length > 0);
    const hasRepo = !!(githubRepo && githubRepo.trim().length > 0);

    if (githubEnabled && hasToken && hasRepo) {
      dot.className = 'status-pulse connected';
      dot.title = 'GitHub Connected & Active';
    } else if (hasToken || hasRepo) {
      dot.className = 'status-pulse warning';
      dot.title = 'Configuration Incomplete / Disabled';
    } else {
      dot.className = 'status-pulse';
      dot.title = 'GitHub Sync Not Configured';
    }
  });
}

function initPushToggle() {
  const toggle  = document.getElementById('push-toggle');
  const hint    = document.getElementById('no-gh-hint');
  const hintBtn = document.getElementById('no-gh-link');

  if (hintBtn) hintBtn.addEventListener('click', showSettings);

  // Load saved state
  chrome.storage.local.get(['githubEnabled', 'githubToken'], ({ githubEnabled, githubToken }) => {
    if (toggle) toggle.checked = !!githubEnabled;
    if (hint)   hint.style.display = (githubEnabled && !githubToken) ? 'block' : 'none';
    updateGitHubStatus();
  });

  if (!toggle) return;
  toggle.addEventListener('change', () => {
    const want = toggle.checked;
    chrome.storage.local.get(['githubToken'], ({ githubToken }) => {
      if (want && !githubToken) {
        // Block enable — no token configured
        toggle.checked = false;
        if (hint) hint.style.display = 'block';
        updateGitHubStatus();
        return;
      }
      chrome.storage.local.set({ githubEnabled: want }, () => {
        updateGitHubStatus();
      });
      if (hint) hint.style.display = 'none';
    });
  });
}

/* ================================================================
   LOAD DASHBOARD DATA
================================================================ */
function setDashboardLoading(isLoading) {
  const elements = [
    document.getElementById('chal-diff'),
    document.getElementById('chal-date'),
    document.getElementById('chal-title'),
    document.getElementById('stat-total'),
    document.getElementById('solve-btn')
  ];
  document.querySelectorAll('.diff-val').forEach(el => elements.push(el));

  elements.forEach(el => {
    if (!el) return;
    if (isLoading) {
      el.classList.add('skeleton');
    } else {
      el.classList.remove('skeleton');
    }
  });
}

function loadDashboard(forceRefresh = false) {
  const cfg    = PLATFORMS[activePlatform];
  const prefix = cfg.prefix;

  // Storage keys
  const completedKey   = activePlatform === 'leetcode' ? 'leetcode_completedDates' : prefix + 'completedDates';
  const statsKey       = activePlatform === 'leetcode' ? 'leetcode_solvedStats' : prefix + 'solvedStats';
  const dailyQuestKey  = activePlatform === 'leetcode' ? 'leetcode_dailyQuestion' : prefix + 'dailyQuestion';

  // Start skeleton loading shimmer
  setDashboardLoading(true);

  // Helper: read from storage and render
  function renderFromStorage(callback) {
    chrome.storage.local.get([completedKey, statsKey, dailyQuestKey], (data) => {
      const completedDates = data[completedKey] || [];
      const solvedStats    = data[statsKey]     || null;
      const dailyQuestion  = data[dailyQuestKey] || null;

      renderChallenge(dailyQuestion, completedDates);
      renderStats(solvedStats);
      updateRankBadge();

      // If we have cached content, turn off skeleton loading
      if (solvedStats && dailyQuestion) {
        setDashboardLoading(false);
      }
      if (callback) callback();
    });
  }

  // 1. Instant render from cache
  renderFromStorage(() => {
    // 2. Ask background to refresh, then re-read storage for freshest data
    const msgType = forceRefresh ? 'FORCE_REFRESH_DAILY' : 'GET_DASHBOARD_DATA';
    chrome.runtime.sendMessage({ type: msgType, platform: activePlatform }, (res) => {
      if (chrome.runtime.lastError) {
        console.warn('[CommitDSA] Background msg error:', chrome.runtime.lastError.message);
        setDashboardLoading(false);
        return;
      }
      if (res && res.error && forceRefresh) {
        showSyncError(res.error);
      }
      // Re-read from storage and turn off skeleton loading
      renderFromStorage(() => {
        setDashboardLoading(false);
      });
    });
  });
}

/* ================================================================
   SETTINGS — Platform Cards (built from PLATFORMS config)
================================================================ */
function buildPlatformCards() {
  const container = document.getElementById('platform-cards-container');
  if (!container) return;
  container.textContent = '';

  chrome.storage.local.get(['enabledPlatforms'], (data) => {
    const enabledList = data.enabledPlatforms || Object.keys(PLATFORMS);

    Object.values(PLATFORMS).forEach(cfg => {
      const isPlatEnabled  = enabledList.includes(cfg.id);

      const card = document.createElement('div');
      card.className = `platform-card ${cfg.id}-card` + (isPlatEnabled ? ' active-card' : '');
      const header = document.createElement('div');
      header.className = 'pc-header';
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'pc-name';
      nameSpan.textContent = `${cfg.emoji} ${cfg.label}`;
      header.appendChild(nameSpan);

      const platToggle = document.createElement('label');
      platToggle.className = 'toggle-switch sm';
      
      const platInput = document.createElement('input');
      platInput.type = 'checkbox';
      platInput.id = `plat-toggle-${cfg.id}`;
      if (isPlatEnabled) platInput.checked = true;
      
      platInput.addEventListener('change', () => {
        if (platInput.checked) {
          card.classList.add('active-card');
        } else {
          card.classList.remove('active-card');
        }
      });
      
      const platSlider = document.createElement('span');
      platSlider.className = 'toggle-slider';
      
      platToggle.appendChild(platInput);
      platToggle.appendChild(platSlider);
      header.appendChild(platToggle);

      card.appendChild(header);
      container.appendChild(card);
    });
  });
}

/* ================================================================
   SETTINGS — Load + Save
================================================================ */
function updateGitHubButtonsState() {
  const generateTokenBtn = document.getElementById('generate-token-btn');
  const newTokenBtn      = document.getElementById('new-token-btn');
  const createRepoBtn    = document.getElementById('create-repo-btn');
  const newRepoBtn       = document.getElementById('new-repo-btn');

  chrome.storage.local.get(['githubToken', 'githubRepo'], ({ githubToken, githubRepo }) => {
    if (generateTokenBtn && newTokenBtn) {
      const hasToken = !!(githubToken && githubToken.trim().length > 0);
      generateTokenBtn.disabled = hasToken;
      newTokenBtn.disabled = !hasToken;
    }
    if (createRepoBtn && newRepoBtn) {
      const hasRepo = !!(githubRepo && githubRepo.trim().length > 0);
      createRepoBtn.disabled = hasRepo;
      newRepoBtn.disabled = !hasRepo;
    }
  });
}

function showInlineConfirm(targetElement, message, onConfirm) {
  const parent = targetElement.closest('.field-row');
  if (!parent || parent.querySelector('.inline-confirm-box')) return;

  const confirmBox = document.createElement('div');
  confirmBox.className = 'inline-confirm-box';

  const msgSpan = document.createElement('span');
  msgSpan.className = 'confirm-msg';
  msgSpan.textContent = message;

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'confirm-actions';

  const yesBtn = document.createElement('button');
  yesBtn.type = 'button';
  yesBtn.className = 'inline-confirm-btn yes-btn';
  yesBtn.textContent = 'Reset';

  const noBtn = document.createElement('button');
  noBtn.type = 'button';
  noBtn.className = 'inline-confirm-btn no-btn';
  noBtn.textContent = 'Cancel';

  actionsDiv.appendChild(noBtn);
  actionsDiv.appendChild(yesBtn);
  confirmBox.appendChild(msgSpan);
  confirmBox.appendChild(actionsDiv);

  const labelRow = parent.querySelector('.field-label-row');
  if (labelRow) {
    labelRow.after(confirmBox);
  } else {
    parent.appendChild(confirmBox);
  }

  noBtn.addEventListener('click', () => {
    confirmBox.style.animation = 'slideUp var(--speed) var(--ease) forwards';
    setTimeout(() => confirmBox.remove(), 200);
  });

  yesBtn.addEventListener('click', () => {
    confirmBox.remove();
    onConfirm();
  });
}

function loadSettingsValues() {
  chrome.storage.local.get(['githubToken', 'githubRepo', 'syncMode', 'gfg_username', 'leetcode_username', 'leetcode_solvedStats'], (data) => {
    const tokenEl  = document.getElementById('github-token');
    const repoEl   = document.getElementById('github-repo');
    const gfgEl    = document.getElementById('gfg-handle');
    const lcEl     = document.getElementById('lc-handle');
    const manualEl = document.getElementById('sync-manual');
    const autoEl   = document.getElementById('sync-auto');

    if (tokenEl)  tokenEl.value  = data.githubToken || '';
    if (repoEl)   repoEl.value   = data.githubRepo  || '';
    if (gfgEl)    gfgEl.value    = data.gfg_username || '';
    
    // For LeetCode, if they haven't typed a manual one, show the auto-fetched one as a hint/pre-fill
    const autoLcUser = data.leetcode_solvedStats ? data.leetcode_solvedStats.username : '';
    if (lcEl)     lcEl.value     = data.leetcode_username || autoLcUser || '';

    const mode = data.syncMode || 'manual';
    if (manualEl && mode === 'manual') manualEl.checked = true;
    if (autoEl   && mode === 'auto')   autoEl.checked   = true;

    updateGitHubButtonsState();
  });
}

function saveSettings() {
  const token  = (document.getElementById('github-token')?.value  || '').trim();
  let repo     = (document.getElementById('github-repo')?.value   || '').trim();
  
  // Clean the repo string
  repo = repo.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '')
             .replace(/^git@github\.com:/i, '')
             .replace(/\.git$/i, '')
             .replace(/\/$/, '');
             
  // Update the UI immediately so the user sees the cleaned version
  const repoEl = document.getElementById('github-repo');
  if (repoEl) repoEl.value = repo;

  const gfgHandle = (document.getElementById('gfg-handle')?.value || '').trim();
  const lcHandle  = (document.getElementById('lc-handle')?.value || '').trim();
  const isAuto = document.getElementById('sync-auto')?.checked;

  // Read platform toggles
  const enabledPlatforms = [];
  Object.values(PLATFORMS).forEach(cfg => {
    const pToggle = document.getElementById(`plat-toggle-${cfg.id}`);
    if (pToggle && pToggle.checked) {
      enabledPlatforms.push(cfg.id);
    }
  });

  chrome.storage.local.set({
    githubToken:      token,
    githubRepo:       repo,
    gfg_username:     gfgHandle,
    leetcode_username: lcHandle,
    syncMode:         isAuto ? 'auto' : 'manual',
    githubEnabled:    !!(token && repo),
    enabledPlatforms,
  }, () => {
    const stat = document.getElementById('settings-status');
    if (stat) {
      stat.textContent = 'Configuration Saved!';
      stat.className   = 'status-msg success';
      stat.style.display = 'block';
      setTimeout(() => stat.style.display = 'none', 3000);
    }
    
    // Refresh the UI to immediately reflect platform changes
    buildTabs();
    updateGitHubButtonsState();
    updateGitHubStatus();
  });
}

/* ================================================================
   INIT
================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initPalette();

  // Build tabs from PLATFORMS config
  buildTabs();

  // Boot dashboard
  showDashboard();
  initPushToggle();
  restartCountdown();
  loadDashboard(false);

  // ── Settings button
  document.getElementById('settings-btn')
    ?.addEventListener('click', showSettings);

  // ── Back to Dashboard
  document.getElementById('back-btn')
    ?.addEventListener('click', () => { showDashboard(); loadDashboard(false); });

  // ── Save config
  document.getElementById('save-config-btn')
    ?.addEventListener('click', saveSettings);

  // ── GitHub Token buttons
  const tokenInput = document.getElementById('github-token');

  const generateTokenBtn = document.getElementById('generate-token-btn');
  if (generateTokenBtn) {
    generateTokenBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://github.com/settings/tokens/new?scopes=repo&description=CommitDSA' });
    });
  }

  const newTokenBtn = document.getElementById('new-token-btn');
  if (newTokenBtn) {
    newTokenBtn.addEventListener('click', () => {
      showInlineConfirm(newTokenBtn, 'Reset GitHub Token?', () => {
        if (tokenInput) tokenInput.value = '';
        
        chrome.storage.local.set({
          githubToken: '',
          githubEnabled: false
        }, () => {
          updateGitHubButtonsState();
          
          const pushToggle = document.getElementById('push-toggle');
          if (pushToggle) pushToggle.checked = false;
          const hint = document.getElementById('no-gh-hint');
          if (hint) hint.style.display = 'none';

          chrome.tabs.create({ url: 'https://github.com/settings/tokens/new?scopes=repo&description=CommitDSA' });
        });
      });
    });
  }

  // ── GitHub Repository buttons
  const repoInput = document.getElementById('github-repo');

  const createRepoBtn = document.getElementById('create-repo-btn');
  if (createRepoBtn) {
    createRepoBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://github.com/new' });
    });
  }

  const newRepoBtn = document.getElementById('new-repo-btn');
  if (newRepoBtn) {
    newRepoBtn.addEventListener('click', () => {
      showInlineConfirm(newRepoBtn, 'Reset Repository?', () => {
        if (repoInput) repoInput.value = '';

        chrome.storage.local.set({
          githubRepo: '',
          githubEnabled: false
        }, () => {
          updateGitHubButtonsState();

          const pushToggle = document.getElementById('push-toggle');
          if (pushToggle) pushToggle.checked = false;
          const hint = document.getElementById('no-gh-hint');
          if (hint) hint.style.display = 'none';

          chrome.tabs.create({ url: 'https://github.com/new' });
        });
      });
    });
  }

  // ── Refresh button with Cooldown
  const refreshBtn = document.getElementById('refresh-btn');
  let isCooldown = false;

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (isCooldown) return;

      const svg = refreshBtn.querySelector('svg');
      if (svg) {
        svg.style.transition = 'transform 0.55s ease';
        svg.style.transform  = 'rotate(360deg)';
      }
      
      refreshBtn.style.opacity = '0.5';
      refreshBtn.style.cursor = 'not-allowed';
      isCooldown = true;

      loadDashboard(true);

      // 60-second cooldown
      setTimeout(() => {
        isCooldown = false;
        refreshBtn.style.opacity = '1';
        refreshBtn.style.cursor = 'pointer';
        if (svg) {
          svg.style.transition = '';
          svg.style.transform  = 'none';
        }
      }, 60000);
    });
  }

  // ── Setup Guide
  document.getElementById('setup-guide-btn')
    ?.addEventListener('click', () =>
      chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') })
    );

  // ── Rate Us
  document.getElementById('rate-us-btn')
    ?.addEventListener('click', () =>
      chrome.tabs.create({ url: 'https://chromewebstore.google.com/detail/commitdsa/hnkhnpgnfccaeicaaekcooopbpncnkgm/reviews' })
    );

  // ── Report Bug
  document.getElementById('report-bug-btn')
    ?.addEventListener('click', () =>
      chrome.tabs.create({ url: 'https://github.com/aprShubh/CommitDSA/issues/new' })
    );

  // ── Password visibility toggles
  document.querySelectorAll('.toggle-password-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = document.getElementById(btn.dataset.target);
      if (!inp) return;
      const isPass = inp.type === 'password';
      inp.type     = isPass ? 'text' : 'password';
      btn.textContent = isPass ? '🙈' : '👁️';
    });
  });
});
