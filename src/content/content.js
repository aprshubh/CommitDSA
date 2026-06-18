// @ts-check

/**
 * @fileoverview Main content script for CommitDSA.
 * Runs in the ISOLATED world on coding platform pages.
 * Listens to submission accepted events from the page context (MAIN world),
 * displays the manual sync confirmation modal, and relays messages to the background worker.
 */



const ALLOWED_PLATFORM_ORIGINS = {
  leetcode: ['leetcode.com'],
  gfg: ['geeksforgeeks.org']
};

function safeString(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function isAllowedPlatformHost(platform, host) {
  const normalizedPlatform = platform.toLowerCase();
  const allowedHosts = ALLOWED_PLATFORM_ORIGINS[normalizedPlatform] || [];
  return allowedHosts.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
}

function parseSafeProblemUrl(rawUrl, platform) {
  try {
    const url = new URL(rawUrl || window.location.href);
    if (url.protocol !== 'https:') return '';
    if (!isAllowedPlatformHost(platform, url.hostname)) return '';
    return url.toString();
  } catch (e) {
    return '';
  }
}

function normalizeAcceptedSubmission(rawProblem) {
  if (!rawProblem || typeof rawProblem !== 'object') return null;

  const platform = safeString(rawProblem.platform, 20);
  const normalizedPlatform = platform.toLowerCase();
  if (!['leetcode', 'gfg'].includes(normalizedPlatform)) return null;
  if (!isAllowedPlatformHost(normalizedPlatform, window.location.hostname)) return null;

  const titleSlug = safeString(rawProblem.titleSlug, 160);
  const lang = safeString(rawProblem.lang, 60);
  const code = typeof rawProblem.code === 'string' ? rawProblem.code : '';
  if (!titleSlug || !/^[a-zA-Z0-9-_]+$/.test(titleSlug)) return null;
  if (!lang || !/^[a-zA-Z0-9+#._-]+$/.test(lang)) return null;
  if (!code.trim() || code.length > 1_000_000) return null;

  const title = safeString(rawProblem.title, 220) || titleSlug;
  const difficulty = safeString(rawProblem.difficulty, 40) || 'Medium';
  const topics = Array.isArray(rawProblem.topics)
    ? rawProblem.topics.filter(topic => typeof topic === 'string').map(topic => safeString(topic, 80)).filter(Boolean).slice(0, 30)
    : [];

  return {
    id: `${normalizedPlatform}-${titleSlug}-${lang.toLowerCase().trim()}`,
    title,
    slug: titleSlug,
    platform,
    language: lang,
    difficulty,
    topics,
    code,
    url: parseSafeProblemUrl(rawProblem.url, normalizedPlatform),
    solvedAt: Date.now(),
    metadata: rawProblem.metadata && typeof rawProblem.metadata === 'object' ? rawProblem.metadata : {}
  };
}

/**
 * Renders the in-page confirmation modal prompting manual solution upload.
 * 
 * @param {import('../models/types.js').SolvedProblem} solvedProblem
 */
const showManualSyncModal = (solvedProblem) => {
  if (document.getElementById('algosync-manual-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'algosync-manual-modal';
  modal.className = 'algosync-modal-overlay';

  // Fetch theme preference dynamically from extension storage
  chrome.storage.local.get(['theme'], (res) => {
    const activeTheme = res.theme || 'light';
    modal.classList.add(`theme-${activeTheme}`);
  });

  const card = document.createElement('div');
  card.className = 'algosync-modal-card';

  const bodyEl = document.createElement('div');
  bodyEl.className = 'algosync-modal-body';
  
  // Title (Difficulty) in old style
  const probInfo = document.createElement('p');
  probInfo.className = 'problem-info';
  
  const titleSpan = document.createElement('span');
  titleSpan.className = 'modal-prob-title';
  titleSpan.textContent = solvedProblem.title;
  
  const diffSpan = document.createElement('span');
  const normalizedDiff = solvedProblem.difficulty.toLowerCase().trim();
  diffSpan.className = `diff-text ${normalizedDiff}`;
  diffSpan.textContent = solvedProblem.difficulty.toUpperCase();
  
  probInfo.appendChild(titleSpan);
  probInfo.appendChild(diffSpan);

  // Platform and Repo info in old style
  const targetInfo = document.createElement('p');
  targetInfo.className = 'target-info';
  
  const platText = document.createElement('span');
  const normalizedPlat = solvedProblem.platform.toLowerCase().trim();
  platText.className = `plat-text ${normalizedPlat}`;
  platText.textContent = solvedProblem.platform.toUpperCase();
  
  const repoText = document.createElement('span');
  repoText.id = 'modal-repo-path';
  repoText.className = 'repo-text';
  repoText.textContent = 'Loading...';
  
  targetInfo.appendChild(platText);
  targetInfo.appendChild(document.createTextNode(' | '));
  targetInfo.appendChild(repoText);

  // Path container (Editable folder destination)
  const pathRow = document.createElement('div');
  pathRow.className = 'path-row';

  const pathLabel = document.createElement('label');
  pathLabel.className = 'path-label';
  pathLabel.textContent = 'DESTINATION PATH (EDITABLE)';

  const pathInputContainer = document.createElement('div');
  pathInputContainer.className = 'path-input-container';

  const folderIcon = document.createElement('span');
  folderIcon.className = 'path-folder-icon';
  folderIcon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.85; color: var(--accent); flex-shrink: 0; display: block;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';

  const pathInput = document.createElement('input');
  pathInput.type = 'text';
  pathInput.id = 'algosync-path-input';
  pathInput.className = 'path-input-field';
  pathInput.value = 'Calculating...';

  pathInputContainer.appendChild(folderIcon);
  pathInputContainer.appendChild(pathInput);
  pathRow.appendChild(pathLabel);
  pathRow.appendChild(pathInputContainer);

  const statusEl = document.createElement('p');
  statusEl.className = 'modal-status-msg';
  statusEl.style.display = 'none';

  bodyEl.appendChild(probInfo);
  bodyEl.appendChild(targetInfo);
  bodyEl.appendChild(pathRow);
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

  card.appendChild(bodyEl);
  card.appendChild(footerEl);
  modal.appendChild(card);
  document.body.appendChild(modal);

  // Retrieve current repository setting from background
  chrome.runtime.sendMessage({ type: 'GET_REPO_INFO' }, (repoPath) => {
    const cleaned = (repoPath || '').replace('https://github.com/', '').replace(/\/$/, '');
    if (repoText) {
      repoText.textContent = cleaned || 'Not Configured';
    }
  });

  // Calculate and retrieve default sync path from background
  chrome.runtime.sendMessage({ type: 'GET_SYNC_PATH', data: solvedProblem }, (syncPath) => {
    const inputEl = document.getElementById('algosync-path-input');
    if (inputEl) {
      inputEl.value = syncPath || '';
    }
  });

  // Fade-in animation
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
    statusEl.className = 'modal-status-msg';

    const inputEl = document.getElementById('algosync-path-input');
    const customPath = inputEl ? inputEl.value.trim() : '';
    const payload = {
      ...solvedProblem,
      customPath: customPath || undefined
    };

    // Dispatch commit to queue service in the background page
    chrome.runtime.sendMessage({
      type: 'COMMIT_SUBMISSION',
      data: payload
    }, (res) => {
      if (res && res.success) {
        confirmBtn.textContent = 'Success! ✓';
        confirmBtn.style.backgroundColor = '#10b981';
        setTimeout(closeModal, 1200);
      } else {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Push to GitHub';
        confirmBtn.style.backgroundColor = '';
        
        statusEl.className = 'modal-status-msg error-state';
        statusEl.textContent = (res && res.error) ? `Error: ${res.error}` : 'Failed to push. Try again.';
        statusEl.style.display = 'block';
      }
    });
  });
};

// Listen to submission accepted events dispatched by the MAIN world injected script
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data) return;
  if (event.origin !== window.location.origin) return;

  if (event.data.type !== 'CODESYNC_SUBMISSION_ACCEPTED') return;

  /** @type {import('../models/types.js').SolvedProblem} */
  const solvedProblem = normalizeAcceptedSubmission(event.data.payload);
  if (!solvedProblem) return;

  console.log(`[CommitDSA] Solution accepted event received: ${solvedProblem.id}. enriching details...`);

  // Enrich details via background GraphQL fetch to prevent DOM scraping failures
  chrome.runtime.sendMessage({
    type: 'ENRICH_SUBMISSION_DETAILS',
    data: solvedProblem
  }, (enrichedProblem) => {
    const activeProblem = enrichedProblem || solvedProblem;
    Object.freeze(activeProblem);

    // Cache last submission in case user wants to manually retry from the popup dashboard
    chrome.storage.local.set({ lastSolvedSubmission: activeProblem });

    // 1. Register local solve (streak stats)
    chrome.runtime.sendMessage({
      type: 'REGISTER_LOCAL_SOLVE',
      data: activeProblem
    }, () => {
      // 2. Fetch configuration to decide between manual prompt vs background auto-queueing
      chrome.runtime.sendMessage({ type: 'CHECK_SYNC_CONFIG' }, (config) => {
        if (config && config.githubEnabled) {
          showManualSyncModal(activeProblem);
        }
      });
    });
  });
});
