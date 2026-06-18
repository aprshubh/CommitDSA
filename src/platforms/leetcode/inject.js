// @ts-check

/**
 * @fileoverview Injected script that runs in the MAIN execution world of LeetCode.
 * Intercepts LeetCode network requests and fetches solved code directly from page state.
 */

(function() {
  const originalFetch = window.fetch;
  
  // Local cache for code submissions
  window._lastLcSubmittedCode = window._lastLcSubmittedCode || {};
  window._pendingLcSyncJobs = window._pendingLcSyncJobs || {};

  // ─── DOM Helpers ────────────────────────────────────────────────────────────

  function getTitleSlug() {
    const match = window.location.pathname.match(/\/problems\/([^/?#]+)/);
    return match ? match[1] : 'unknown-leetcode-problem';
  }

  function getTitleFromDOM() {
    const el = document.querySelector('div[class*="text-title-large"], div[data-cy="question-title"], .question-title');
    if (el) return el.textContent.trim();
    return document.title.split(' - ')[0].split(' | ')[0].trim();
  }

  function getDifficultyFromDOM() {
    const lcDiff = document.querySelector('[class*="text-difficulty-"], [class*="text-easy"], [class*="text-medium"], [class*="text-hard"]');
    if (lcDiff) {
      const txt = lcDiff.textContent.trim();
      if (['Easy', 'Medium', 'Hard'].includes(txt)) return txt;
    }
    // Fallback: search DOM for matching text, excluding common sidebar/nav areas
    const elements = document.querySelectorAll('div, span, p, a, h4');
    for (let el of elements) {
      if (el.closest('nav') || el.closest('header') || el.closest('[class*="sidebar"]') || el.closest('[class*="recommend"]')) {
        continue;
      }
      if (el.childNodes.length === 1 || el.children.length === 0) {
        const txt = (el.textContent || '').trim();
        if (['Easy', 'Medium', 'Hard'].includes(txt)) return txt;
      }
    }
    return 'Medium'; // general default
  }

  function getCodeFromMonaco() {
    if (window.monaco && window.monaco.editor) {
      try {
        const editors = window.monaco.editor.getEditors();
        for (const editor of editors) {
          const domNode = editor.getDomNode();
          if (domNode && domNode.clientWidth > 0 && domNode.clientHeight > 0) {
            const model = editor.getModel();
            if (model) {
              const val = model.getValue();
              if (val && val.trim().length > 0) return val;
            }
          }
        }
        const models = window.monaco.editor.getModels();
        if (models.length > 0) {
          let bestModel = models[0];
          for (const model of models) {
            if (model.getValue().length > bestModel.getValue().length) bestModel = model;
          }
          return bestModel.getValue();
        }
      } catch (e) {}
    }
    // Textarea fallback
    const textareas = document.querySelectorAll('textarea');
    for (let ta of textareas) {
      if (ta.value && ta.value.length > 100) return ta.value;
    }
    return '';
  }

  function getLanguageFromMonaco() {
    if (window.monaco && window.monaco.editor) {
      try {
        const editors = window.monaco.editor.getEditors();
        for (const editor of editors) {
          const domNode = editor.getDomNode();
          if (domNode && domNode.clientWidth > 0 && domNode.clientHeight > 0) {
            const model = editor.getModel();
            if (model) return model.getLanguageId ? model.getLanguageId() : '';
          }
        }
      } catch (e) {}
    }
    return '';
  }

  // ─── Network Normalizer & Sender ───────────────────────────────────────────

  /**
   * Builds the normalized payload and posts it to the content script.
   * 
   * @param {string} titleSlug
   * @param {Object} [meta] - Optional submission metadata (runtime, memory, etc.)
   */
  function dispatchSolvedSubmission(titleSlug, meta = {}) {
    let code = getCodeFromMonaco();
    let lang = getLanguageFromMonaco();

    // Recover from cache if Monaco is empty or misses latest edit
    const cached = window._lastLcSubmittedCode[titleSlug];
    if (cached && (Date.now() - cached.timestamp) < 120000) {
      code = cached.code;
      if (cached.lang) lang = cached.lang;
    }

    if (!code || code.trim().length === 0) {
      console.warn('[CommitDSA] LeetCode: Solved but no source code found. Skipping sync.');
      return;
    }

    const problemPayload = {
      platform: 'LeetCode',
      title: getTitleFromDOM(),
      titleSlug: titleSlug,
      difficulty: getDifficultyFromDOM(),
      lang: lang || 'cpp',
      code: code,
      url: `https://leetcode.com/problems/${titleSlug}/`,
      topics: [],
      metadata: meta
    };

    window.postMessage({
      type: 'CODESYNC_SUBMISSION_ACCEPTED',
      payload: problemPayload
    }, '*');
  }

  // ─── Request Interceptor ───────────────────────────────────────────────────

  function cacheLcCodeSubmission(url, body) {
    if (!body || typeof body !== 'string') return;
    try {
      const parsed = JSON.parse(body);
      const code = parsed.typed_code || parsed.code || parsed.source_code;
      const lang = parsed.lang || parsed.language;
      if (code && code.trim().length > 0) {
        const slug = getTitleSlug();
        window._lastLcSubmittedCode[slug] = {
          code: code,
          lang: lang,
          timestamp: Date.now()
        };
      }
    } catch (e) {}
  }

  window.fetch = async function(...args) {
    const rawUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
    const url = (rawUrl && !rawUrl.startsWith('http')) ? (window.location.origin + rawUrl) : rawUrl;
    const options = args[1] || (args[0] && args[0].method !== undefined ? args[0] : {});
    const method = (options.method || 'GET').toUpperCase();

    // Cache outgoing code payload
    if (method === 'POST' && (url.includes('/submit') || url.includes('/submissions') || url.includes('/graphql'))) {
      const body = options.body || (args[0] && args[0].body);
      cacheLcCodeSubmission(url, body);
    }

    const response = await originalFetch.apply(this, args);

    if (!url) return response;

    // Check check-status polling response (REST API)
    if (url.includes('/submissions/detail/') && url.includes('/check/')) {
      try {
        const idMatch = url.match(/\/submissions\/detail\/([^/]+)\//);
        const checkId = idMatch ? idMatch[1] : null;
        // Run code checks use alpha-numeric IDs; real submissions use digits
        if (checkId && /^\d+$/.test(checkId)) {
          const clone = response.clone();
          const data = await clone.json();
          if (data && (data.status_msg === 'Accepted' || data.status_code === 10 || data.state === 'SUCCESS')) {
            const slug = getTitleSlug();
            const meta = {
              runtime: data.status_runtime || '',
              memory: data.status_memory || '',
              submissionId: checkId
            };
            dispatchSolvedSubmission(slug, meta);
          }
        }
      } catch (e) {}
    } 
    
    // Check GraphQL response (New LeetCode layout submits via GraphQL)
    else if (url.includes('/graphql')) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        if (data && data.data && data.data.submissionDetails) {
          const sd = data.data.submissionDetails;
          if (sd.statusDisplay === 'Accepted' || sd.statusCode === 10) {
            const slug = getTitleSlug();
            // Prevent duplicate triggers
            if (!window._pendingLcSyncJobs[slug] || Date.now() - window._pendingLcSyncJobs[slug] > 5000) {
              window._pendingLcSyncJobs[slug] = Date.now();
              const meta = {
                runtime: sd.runtimeDisplay || '',
                memory: sd.memoryDisplay || '',
                submissionId: sd.id || ''
              };
              dispatchSolvedSubmission(slug, meta);
            }
          }
        }
      } catch (e) {}
    }

    return response;
  };
})();
