// @ts-check

/**
 * @fileoverview Injected script that runs in the MAIN execution world of GeeksforGeeks.
 * Intercepts GFG network requests and fetches solved code from page state.
 */

(function() {
  const originalFetch = window.fetch;
  
  // Local cache for code submissions
  window._lastGfgSubmittedCode = window._lastGfgSubmittedCode || {};
  window._pendingGfgSyncJobs = window._pendingGfgSyncJobs || {};

  // ─── DOM Helpers ────────────────────────────────────────────────────────────

  function getTitleSlug() {
    const match = window.location.pathname.match(/\/problems\/([^/?#]+)/);
    return match ? match[1] : 'unknown-gfg-problem';
  }

  function getTitleFromDOM() {
    const el = document.querySelector('.problem-tab__name, .problem-title, h1[class*="title"], .problems-header h1, .problem-statement h1');
    if (el) return el.textContent.trim().replace(/\s+/g, ' ');
    return document.title.split(' - ')[0].split(' | ')[0].trim();
  }

  function getDifficultyFromDOM() {
    // 1. Try GFG new layout description
    const descEl = document.querySelector('div[class*="problems_header_description"]');
    if (descEl) {
      const spans = descEl.querySelectorAll('span');
      for (let span of spans) {
        if (span.textContent && span.textContent.includes('Difficulty:')) {
          const strong = span.querySelector('strong');
          if (strong) return strong.textContent.trim();
          const cleaned = span.textContent.replace('Difficulty:', '').trim();
          if (['School', 'Basic', 'Easy', 'Medium', 'Hard'].includes(cleaned)) return cleaned;
        }
      }
    }
    
    // 2. Try specific badge selectors
    const selectors = [
      '.problems_header_strength__e835_',
      'div[class*="problems_header_strength"]',
      '.problem-tab__difficulty',
      '.problems-header .difficulty',
      '.problems_header_strength_rating__',
      'div[class*="problems_header_strength_rating"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const txt = el.textContent.trim();
        if (['School', 'Basic', 'Easy', 'Medium', 'Hard'].includes(txt)) return txt;
      }
    }

    // 3. Search under GFG main content container
    const container = document.querySelector('.problems-header, .problems_header_content, .problem-statement, .problem-tab');
    if (container) {
      const elements = container.querySelectorAll('div, span, p, a, h4');
      for (let el of elements) {
        if (el.childNodes.length === 1 || el.children.length === 0) {
          const txt = (el.textContent || '').trim();
          if (['School', 'Basic', 'Easy', 'Medium', 'Hard'].includes(txt)) {
            return txt;
          }
        }
      }
    }

    // Fallback: search DOM for matching text, excluding common sidebar/nav areas
    const elements = document.querySelectorAll('div, span, p, a, h4');
    for (let el of elements) {
      if (el.closest('nav') || el.closest('header') || el.closest('[class*="sidebar"]') || el.closest('[class*="recommend"]')) {
        continue;
      }
      if (el.childNodes.length === 1 || el.children.length === 0) {
        const txt = (el.textContent || '').trim();
        if (['School', 'Basic', 'Easy', 'Medium', 'Hard'].includes(txt)) {
          return txt;
        }
      }
    }

    return 'Medium'; // general default fallback
  }

  function getCodeFromAce() {
    // 1. GFG Ace Editor
    if (window.ace) {
      try {
        const editorEls = document.querySelectorAll('.ace_editor');
        for (let i = 0; i < editorEls.length; i++) {
          const editor = window.ace.edit(editorEls[i]);
          if (!editor.getReadOnly()) {
            const val = editor.getValue();
            if (val && val.trim().length > 0) return val;
          }
        }
        if (editorEls.length > 0) return window.ace.edit(editorEls[0]).getValue();
      } catch (e) {}
    }
    
    // 2. CodeMirror Fallback (newer GFG UI)
    try {
      const cm = document.querySelector('.CodeMirror');
      if (cm && cm.CodeMirror) {
        const val = cm.CodeMirror.getValue();
        if (val && val.trim().length > 0) return val;
      }
    } catch(e) {}
    
    // 3. Textarea fallback
    const textareas = document.querySelectorAll('textarea');
    for (let ta of textareas) {
      if (ta.value && ta.value.length > 100) return ta.value;
    }
    return '';
  }

  function getLanguageFromAce() {
    if (window.ace) {
      try {
        const editorEls = document.querySelectorAll('.ace_editor');
        for (let i = 0; i < editorEls.length; i++) {
          const editor = window.ace.edit(editorEls[i]);
          if (!editor.getReadOnly()) {
            const modeId = editor.getSession().getMode().$id || '';
            if (modeId) return modeId.split('/').pop();
          }
        }
      } catch (e) {}
    }
    return '';
  }

  // ─── Network Normalizer & Sender ───────────────────────────────────────────

  function dispatchSolvedSubmission(titleSlug) {
    let code = getCodeFromAce();
    let lang = getLanguageFromAce();

    // Recover from cache if DOM scrapers miss the latest payload
    const cached = window._lastGfgSubmittedCode[titleSlug];
    if (cached && (Date.now() - cached.timestamp) < 120000) {
      code = cached.code;
      if (cached.lang) lang = cached.lang;
    }

    if (!code || code.trim().length === 0) {
      console.warn('[CommitDSA] GFG: Solved but no source code found. Skipping sync.');
      return;
    }

    const problemPayload = {
      platform: 'GFG',
      title: getTitleFromDOM(),
      titleSlug: titleSlug,
      difficulty: getDifficultyFromDOM(),
      lang: lang || 'cpp',
      code: code,
      url: `https://practice.geeksforgeeks.org/problems/${titleSlug}/1`,
      topics: [],
      metadata: {}
    };

    window.postMessage({
      type: 'CODESYNC_SUBMISSION_ACCEPTED',
      payload: problemPayload
    }, '*');
  }

  // Helper to determine GFG acceptance from response payload
  function isGfgAccepted(data) {
    if (!data) return false;
    const verdict = (data.verdict || data.result || '').toString().toLowerCase();
    if (verdict.includes('correct') || verdict.includes('accepted')) return true;
    if (data.percent === 100 || data.percent === '100') return true;
    if (data.passed === true || data.allTestCasesPassed === true) return true;
    if (data.view_mode === 'correct') return true;
    if (data.status === 'SUCCESS' && data.sub_status === 1) return true;
    if (data.message && typeof data.message === 'object') {
      const msgVerdict = (data.message.verdict || data.message.status || data.message.result || '').toString().toLowerCase();
      if (msgVerdict.includes('correct') || msgVerdict.includes('accepted')) return true;
    }
    if (typeof data.message === 'string') {
      const msgLower = data.message.toLowerCase();
      if (msgLower.includes('correct') || msgLower.includes('accepted')) return true;
    }
    return false;
  }

  // ─── Request Interceptor ───────────────────────────────────────────────────

  function cacheGfgCodeSubmission(url, body) {
    if (!body) return;
    try {
      let parsed = null;
      if (typeof body === 'string') {
        try { parsed = JSON.parse(body); } catch(e) {}
        if (!parsed) {
          parsed = {};
          for (const pair of body.split('&')) {
            const [k, v] = pair.split('=');
            if (k) parsed[decodeURIComponent(k)] = decodeURIComponent(v || '');
          }
        }
      } else if (body instanceof FormData) {
        parsed = {};
        for (let [key, val] of body.entries()) {
          parsed[key] = val;
        }
      }
      
      if (parsed) {
        const code = parsed.source || parsed.code || parsed.source_code || parsed.sourceCode;
        const lang = parsed.lang || parsed.language || parsed.source_code_language || parsed.langCode;
        if (code && code.trim().length > 0) {
          const slug = getTitleSlug();
          window._lastGfgSubmittedCode[slug] = {
            code: code,
            lang: lang,
            timestamp: Date.now()
          };
        }
      }
    } catch (e) {}
  }

  window.fetch = async function(...args) {
    const rawUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
    const url = (rawUrl && !rawUrl.startsWith('http')) ? (window.location.origin + rawUrl) : rawUrl;
    const options = args[1] || (args[0] && args[0].method !== undefined ? args[0] : {});
    const method = (options.method || 'GET').toUpperCase();

    if (method === 'POST' && (url.includes('/submit') || url.includes('/submissions') || url.includes('practiceapi'))) {
      const body = options.body || (args[0] && args[0].body);
      cacheGfgCodeSubmission(url, body);
    }

    const response = await originalFetch.apply(this, args);

    if (!url || !url.includes('geeksforgeeks.org')) return response;

    // Intercept GFG post submissions or GET status polling
    if (url.includes('api')) {
      if (method === 'POST') {
        try {
          const clone = response.clone();
          const data = await clone.json();
          if (isGfgAccepted(data)) {
            dispatchSolvedSubmission(getTitleSlug());
          }
        } catch (e) {}
      } else if (method === 'GET') {
        try {
          const clone = response.clone();
          const data = await clone.json();
          if (isGfgAccepted(data)) {
            const slug = getTitleSlug();
            if (!window._pendingGfgSyncJobs['_last_' + slug] || Date.now() - window._pendingGfgSyncJobs['_last_' + slug] > 5000) {
              window._pendingGfgSyncJobs['_last_' + slug] = Date.now();
              dispatchSolvedSubmission(slug);
            }
          }
        } catch (e) {}
      }
    }

    return response;
  };

  // XMLHttpRequest Interceptor (GFG legacy API support)
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url) {
    const rawUrl = typeof url === 'string' ? url : '';
    this._cdGfgUrl = (rawUrl && !rawUrl.startsWith('http')) ? (window.location.origin + rawUrl) : rawUrl;
    this._cdGfgMethod = (method || '').toUpperCase();
    return originalOpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    const url = this._cdGfgUrl;
    const method = this._cdGfgMethod;
    
    if (method === 'POST' && url && (url.includes('/submit') || url.includes('/submissions') || url.includes('practiceapi'))) {
      cacheGfgCodeSubmission(url, body);
    }

    this.addEventListener('load', function() {
      if (!url || !url.includes('geeksforgeeks.org') || !url.includes('api')) return;
      try {
        const data = JSON.parse(this.responseText);
        if (isGfgAccepted(data)) {
          const slug = getTitleSlug();
          if (!window._pendingGfgSyncJobs['_last_' + slug] || Date.now() - window._pendingGfgSyncJobs['_last_' + slug] > 5000) {
            window._pendingGfgSyncJobs['_last_' + slug] = Date.now();
            dispatchSolvedSubmission(slug);
          }
        }
      } catch (e) {}
    });

    return originalSend.apply(this, arguments);
  };
})();
