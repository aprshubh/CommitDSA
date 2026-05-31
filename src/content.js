/**
 * @fileoverview Content script injected into LeetCode and GeeksforGeeks pages.
 * Responsible for injecting the in-page script (`inject.js`) and rendering UI (e.g., the manual push modal).
 */
/**
 * Injects `inject.js` into the page's main execution environment.
 * This allows `inject.js` to intercept XHR/fetch requests.
 */
const injectScript = () => {
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('inject.js');
  s.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(s);
};
injectScript();




/**
 * Displays an in-page modal to prompt the user to manually push their solution to GitHub.
 * 
 * @param {Object} submissionData - Details about the solved problem.
 * @param {string} submissionData.title - Problem title.
 * @param {string} submissionData.difficulty - Problem difficulty.
 * @param {string} submissionData.platform - Platform name ('LeetCode' or 'GFG').
 */
const showManualSyncModal = (submissionData) => {
  // Prevent duplicate modals
  if (document.getElementById('algosync-manual-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'algosync-manual-modal';
  modal.className = 'algosync-modal-overlay';

  // Load the current theme to match the extension visual style
  chrome.storage.local.get(['theme'], (res) => {
    const activeTheme = res.theme || 'light';
    modal.classList.add(`theme-${activeTheme}`);
  });

  const card = document.createElement('div');
  card.className = 'algosync-modal-card';

  const titleEl = document.createElement('div');
  titleEl.className = 'algosync-modal-header';
  
  const logoSpan = document.createElement('span');
  logoSpan.className = 'algosync-modal-logo';
  logoSpan.textContent = 'CommitDSA';
  
  const headerTitle = document.createElement('h3');
  headerTitle.textContent = 'Push to GitHub?';
  
  titleEl.appendChild(logoSpan);
  titleEl.appendChild(headerTitle);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'algosync-modal-body';
  
  const probInfo = document.createElement('p');
  probInfo.className = 'problem-info';
  
  const strongTitle = document.createElement('strong');
  strongTitle.textContent = submissionData.title;
  probInfo.appendChild(strongTitle);
  probInfo.appendChild(document.createTextNode(` (${submissionData.difficulty})`));

  const targetInfo = document.createElement('p');
  targetInfo.className = 'target-info';
  targetInfo.appendChild(document.createTextNode('Platform: '));
  
  const spanPlatform = document.createElement('span');
  spanPlatform.textContent = submissionData.platform;
  targetInfo.appendChild(spanPlatform);
  
  targetInfo.appendChild(document.createTextNode(' | Repo: '));
  
  const spanRepo = document.createElement('span');
  spanRepo.id = 'modal-repo-path';
  spanRepo.textContent = 'Loading...';
  targetInfo.appendChild(spanRepo);

  // Status message element for detailed error feedback
  const statusEl = document.createElement('p');
  statusEl.className = 'modal-status-msg';
  statusEl.style.color = '#ef4444';
  statusEl.style.fontSize = '11px';
  statusEl.style.fontWeight = '600';
  statusEl.style.marginTop = '8px';
  statusEl.style.display = 'none';

  bodyEl.appendChild(probInfo);
  bodyEl.appendChild(targetInfo);
  bodyEl.appendChild(statusEl);

  const footerEl = document.createElement('div');
  footerEl.className = 'algosync-modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'modal-btn cancel-btn';
  cancelBtn.id = 'algosync-cancel-btn';
  cancelBtn.textContent = 'Dismiss';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'modal-btn confirm-btn';
  confirmBtn.id = 'algosync-confirm-btn';
  confirmBtn.textContent = 'Push to GitHub';

  footerEl.appendChild(cancelBtn);
  footerEl.appendChild(confirmBtn);

  card.appendChild(titleEl);
  card.appendChild(bodyEl);
  card.appendChild(footerEl);
  modal.appendChild(card);
  document.body.appendChild(modal);

  // Fetch linked repository information from background config
  chrome.runtime.sendMessage({ type: 'GET_REPO_INFO' }, (repoPath) => {
    const pathEl = document.getElementById('modal-repo-path');
    if (pathEl) {
      const cleaned = (repoPath || '').replace('https://github.com/', '').replace(/\/$/, '');
      pathEl.textContent = cleaned || 'Not Configured';
    }
  });

  // Animation triggers
  setTimeout(() => {
    modal.classList.add('show');
  }, 50);

  const closeModal = () => {
    modal.classList.remove('show');
    modal.classList.add('hide');
    setTimeout(() => {
      modal.remove();
    }, 450);
  };

  cancelBtn.addEventListener('click', closeModal);
  confirmBtn.addEventListener('click', () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Pushing...';
    statusEl.style.display = 'none';

    chrome.runtime.sendMessage({
      type: 'COMMIT_SUBMISSION',
      data: submissionData
    }, (res) => {
      if (res && res.success) {
        confirmBtn.textContent = 'Success! ✓';
        confirmBtn.style.backgroundColor = '#10b981';
        setTimeout(closeModal, 1200);
      } else {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Push to GitHub';
        confirmBtn.style.backgroundColor = '';
        
        // Show detailed error message
        statusEl.textContent = (res && res.error) ? `Error: ${res.error}` : 'Failed to push. Try again.';
        statusEl.style.display = 'block';
      }
    });
  });
};

// 3. Listen to events from the page context (MAIN world)
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data) return;


  if (event.data.type !== 'CODESYNC_SUBMISSION_ACCEPTED') return;

  const { platform, titleSlug, title, difficulty, code, lang } = event.data;
  
  // Basic security validation: ensure data structure is correct before proceeding
  if (!titleSlug || typeof titleSlug !== 'string') return;
  if (!code || typeof code !== 'string') return;
  if (!platform || typeof platform !== 'string') return;

  console.log(`[CommitDSA] Submission detected on ${platform} for: ${titleSlug}. Verifying...`);

  // Store the submission data locally so it can be pushed/retried manually from the popup dashboard
  chrome.storage.local.set({
    lastSolvedSubmission: {
      platform,
      titleSlug,
      title,
      difficulty,
      code,
      lang,
      timestamp: Date.now()
    }
  });

  // First, verify/register solved status locally for streak calculations
  chrome.runtime.sendMessage({
    type: 'REGISTER_LOCAL_SOLVE',
    platform: platform,
    titleSlug: titleSlug,
    title: title,
    difficulty: difficulty
  }, (localResponse) => {
    // Now handle GitHub integration
    chrome.runtime.sendMessage({ type: 'CHECK_SYNC_CONFIG' }, (config) => {
      if (config && config.githubEnabled) {
        if (config.syncMode === 'auto') {
          // Commit automatically in background
          chrome.runtime.sendMessage({
            type: 'COMMIT_SUBMISSION',
            data: { platform, titleSlug, title, difficulty, code, lang }
          }, (res) => {
            console.log('[CommitDSA] Auto-sync GitHub status:', res);
          });
        } else {
          // Manual mode: Show user confirmation popup modal
          showManualSyncModal({ platform, titleSlug, title, difficulty, code, lang });
        }
      }
    });
  });
});

