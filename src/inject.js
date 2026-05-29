/**
 * @fileoverview Injected script that runs in the main execution world of the browser tab.
 * Intercepts `fetch` and `XMLHttpRequest` to capture submitted code and detect successful submissions.
 */
(function() {
  const originalFetch = window.fetch;
  
  // Cache to store the exact submitted code and language
  window._lastSubmittedCode = window._lastSubmittedCode || {};
  // Dedup timestamp map for GFG GET polling (prevents double-trigger on same problem)
  window._pendingGfgJobs = window._pendingGfgJobs || {};
  // Track LeetCode dedup timestamps (separate namespace from GFG jobs)
  window._pendingLcJobs = window._pendingLcJobs || {};

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Caches the submitted code and language from the outgoing network request body.
   * 
   * @param {string} url - The endpoint URL being fetched.
   * @param {string|FormData} body - The request body containing the code.
   */
  function cacheSubmittedCode(url, body) {
    if (!body) return;
    try {
      let parsed = null;
      if (typeof body === 'string') {
        try { parsed = JSON.parse(body); } catch(e) {}
        // Also try URL-encoded form data
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
        // LeetCode uses typed_code; GFG uses source or code
        const code = parsed.typed_code || parsed.source || parsed.code || 
                     parsed.source_code || parsed.sourceCode;
        const lang = parsed.lang || parsed.language || parsed.source_code_language || 
                     parsed.langCode || parsed.languageCode || '';
        
        if (code && code.trim().length > 0) {
          // Extract titleSlug from URL or current path
          const match = url.match(/\/problems\/([^/?#]+)/) || 
                        window.location.pathname.match(/\/problems\/([^/?#]+)/);
          const titleSlug = match ? match[1] : 'unknown';
          window._lastSubmittedCode[titleSlug] = {
            code: code,
            lang: lang,
            timestamp: Date.now()
          };
          console.log('[CommitDSA] Cached submitted code for:', titleSlug, '| lang:', lang, '| chars:', code.length);
        }
      }
    } catch (e) {
      console.warn('[CommitDSA] Error caching submitted code:', e);
    }
  }

  /**
   * Retrieves code from the visible Monaco (LeetCode) or Ace (GFG) editor 
   * as a fallback when network request interception misses the payload.
   * 
   * @returns {string|null} The source code string, or null if not found.
   */
  function getCodeFromPage() {
    // 1. Monaco Editor (LeetCode)
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
        // Fallback: largest model
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
    
    // 2. Ace Editor (GeeksforGeeks)
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
    
    // 3. CodeMirror (GFG newer pages)
    try {
      const cm = document.querySelector('.CodeMirror');
      if (cm && cm.CodeMirror) {
        const val = cm.CodeMirror.getValue();
        if (val && val.trim().length > 0) return val;
      }
    } catch(e) {}
    
    // 4. Large textarea fallback
    const textareas = document.querySelectorAll('textarea');
    for (let ta of textareas) {
      if (ta.value && ta.value.length > 50) return ta.value;
    }
    return '';
  }

  function getLanguageFromPage() {
    // Monaco
    if (window.monaco && window.monaco.editor) {
      try {
        const editors = window.monaco.editor.getEditors();
        for (const editor of editors) {
          const domNode = editor.getDomNode();
          if (domNode && domNode.clientWidth > 0 && domNode.clientHeight > 0) {
            const model = editor.getModel();
            if (model) return model.getLanguageId ? model.getLanguageId() : (model.getModeId ? model.getModeId() : '');
          }
        }
        const models = window.monaco.editor.getModels();
        if (models.length > 0) return models[0].getLanguageId ? models[0].getLanguageId() : '';
      } catch (e) {}
    }
    
    // Ace
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

  function getDifficultyFromDOM() {
    const elements = document.querySelectorAll('div, span, p, a, h4');
    for (let el of elements) {
      if (el.childNodes.length === 1 || el.children.length === 0) {
        const txt = (el.textContent || '').trim();
        if (txt === 'Easy' || txt === 'Medium' || txt === 'Hard' || txt === 'School' || txt === 'Basic') {
          return txt;
        }
      }
    }
    // LeetCode selector
    const lcDiff = document.querySelector('[class*="text-difficulty-"], [class*="text-easy"], [class*="text-medium"], [class*="text-hard"]');
    if (lcDiff) return lcDiff.textContent.trim();
    // GFG selector
    const gfgDiff = document.querySelector('.problem-tab__difficulty, .difficulty, [class*="difficulty"]');
    if (gfgDiff) return gfgDiff.textContent.trim();
    return 'Medium';
  }

  function getTitleFromDOM(platform) {
    if (platform === 'LeetCode') {
      const el = document.querySelector('div[class*="text-title-large"], div[data-cy="question-title"], .question-title');
      if (el) return el.textContent.trim();
    } else if (platform === 'GFG') {
      const el = document.querySelector('.problem-tab__name, .problem-title, h1[class*="title"], .problems-header h1, .problem-statement h1');
      if (el) return el.textContent.trim().replace(/\s+/g, ' ');
    }
    return document.title.split(' - ')[0].split(' | ')[0].trim();
  }

  function getTitleSlug() {
    const match = window.location.pathname.match(/\/problems\/([^/?#]+)/);
    return match ? match[1] : 'problem';
  }

  /**
   * Shared GFG acceptance check covering all known GFG API response shapes.
   * GFG has changed its API multiple times — this handles all variants including
   * the newer practiceapiorigin responses with view_mode/sub_status fields.
   */
  function isGfgAccepted(data) {
    if (!data) return false;
    // Classic string verdict fields
    const verdict = (data.verdict || data.result || '').toString().toLowerCase();
    if (verdict.includes('correct') || verdict.includes('accepted')) return true;
    // Numeric/boolean fields
    if (data.percent === 100 || data.percent === '100') return true;
    if (data.passed === true || data.allTestCasesPassed === true) return true;
    // Newer GFG API (practiceapiorigin): view_mode + sub_status
    if (data.view_mode === 'correct') return true;
    if (data.status === 'SUCCESS' && data.sub_status === 1) return true;
    // Nested message object (GFG sometimes wraps verdict here)
    if (data.message && typeof data.message === 'object') {
      const msgVerdict = (data.message.verdict || data.message.status || data.message.result || '').toString().toLowerCase();
      if (msgVerdict.includes('correct') || msgVerdict.includes('accepted')) return true;
    }
    // String message field
    if (typeof data.message === 'string') {
      const msgLower = data.message.toLowerCase();
      if (msgLower.includes('correct') || msgLower.includes('accepted')) return true;
    }
    return false;
  }

  function buildAndSendSubmission(platform, titleSlug) {
    let code = getCodeFromPage();
    let lang = getLanguageFromPage();
    
    // Prefer cached submitted code (exact code sent to server)
    const cached = window._lastSubmittedCode[titleSlug];
    if (cached && (Date.now() - cached.timestamp) < 120000) { // within 2 minutes
      code = cached.code;
      if (cached.lang) lang = cached.lang;
    }
    
    if (!code || code.trim().length === 0) {
      console.warn('[CommitDSA] No code found for submission, skipping.');
      return;
    }

    window.postMessage({
      type: 'CODESYNC_SUBMISSION_ACCEPTED',
      platform: platform,
      titleSlug: titleSlug,
      title: getTitleFromDOM(platform),
      difficulty: getDifficultyFromDOM(),
      code: code,
      lang: lang
    }, '*');
  }

  // ─── Fetch Interceptor ──────────────────────────────────────────────────────
  window.fetch = async function(...args) {
    const rawUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
    // Normalize relative URLs to absolute so domain-based checks work correctly.
    // LeetCode & GFG often use relative paths like /submissions/detail/123/check/
    const url = (rawUrl && !rawUrl.startsWith('http')) ? (window.location.origin + rawUrl) : rawUrl;
    const options = args[1] || (args[0] && args[0].method !== undefined ? args[0] : {});
    const method = (options.method || 'GET').toUpperCase();

    // Intercept POST bodies to cache submitted code
    if (method === 'POST') {
      const body = options.body || (args[0] && args[0].body);
      if (url.includes('/submit') || url.includes('/submissions') || 
          url.includes('/run') || url.includes('practiceapi')) {
        cacheSubmittedCode(url, body);
      }
    }

    const response = await originalFetch.apply(this, args);

    if (!url) return response;

    // 1. LeetCode: check polling endpoint or New UI GraphQL
    if (url.includes('leetcode.com')) {
      if (url.includes('/submissions/detail/') && url.includes('/check/')) {
        try {
          // LeetCode Run Code uses non-numeric interpret IDs: /submissions/detail/interpret_abc.../check/
          // Real submissions use purely numeric IDs:          /submissions/detail/12345678/check/
          // This single regex check is enough to distinguish them — no cross-request tracking needed.
          const idMatch = url.match(/\/submissions\/detail\/([^/]+)\//);
          const checkId = idMatch ? idMatch[1] : null;
          if (checkId && !/^\d+$/.test(checkId)) return response; // non-numeric → Run Code, skip

          const clone = response.clone();
          const data = await clone.json();
          // status_code 10 = Accepted; state==='SUCCESS' is safe here because Run Code
          // is already filtered above by the numeric ID check.
          if (data && (data.status_msg === 'Accepted' || data.status_code === 10 || data.state === 'SUCCESS')) {
            buildAndSendSubmission('LeetCode', getTitleSlug());
          }
        } catch (e) {}
      } else if (url.includes('/graphql')) {
        try {
          const clone = response.clone();
          const data = await clone.json();
          if (data && data.data && data.data.submissionDetails) {
            const sd = data.data.submissionDetails;
            if (sd.statusDisplay === 'Accepted' || sd.statusCode === 10) {
              const slug = getTitleSlug();
              if (!window._pendingLcJobs[slug] || Date.now() - window._pendingLcJobs[slug] > 5000) {
                window._pendingLcJobs[slug] = Date.now();
                buildAndSendSubmission('LeetCode', slug);
              }
            }
          }
        } catch (e) {}
      }
    }

    // 2. GFG: Intercept submission POST response
    // Async GFG verdicts are detected by intercepting GFG's own GET polling below.
    else if (url.includes('geeksforgeeks.org') && url.includes('api') && method === 'POST') {
      try {
        const clone = response.clone();
        const data = await clone.json();
        // Check for immediate verdict (some problems return it directly in the POST response)
        if (isGfgAccepted(data)) {
          buildAndSendSubmission('GFG', getTitleSlug());
        }
      } catch (e) {
        // Ignore JSON parse errors (e.g. non-JSON responses)
      }
    }

    // 3. GFG: Intercept GET job status responses (for any polling done by GFG's own frontend)
    else if (url.includes('geeksforgeeks.org') && url.includes('api') && method === 'GET') {
      try {
        const clone = response.clone();
        const data = await clone.json();
        
        const isAccepted = isGfgAccepted(data);
        
        if (isAccepted) {
          const titleSlug = getTitleSlug();
          // Avoid duplicate triggers
          if (!window._pendingGfgJobs['_last_' + titleSlug] || 
              Date.now() - window._pendingGfgJobs['_last_' + titleSlug] > 5000) {
            window._pendingGfgJobs['_last_' + titleSlug] = Date.now();
            buildAndSendSubmission('GFG', titleSlug);
          }
        }
      } catch (e) {}
    }

    return response;
  };

  // ─── XMLHttpRequest Interceptor (legacy GFG) ────────────────────────────────
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url) {
    const rawUrl = typeof url === 'string' ? url : '';
    // Normalize relative URLs to absolute so domain-based checks work correctly
    this._cdUrl = (rawUrl && !rawUrl.startsWith('http')) ? (window.location.origin + rawUrl) : rawUrl;
    this._cdMethod = (method || '').toUpperCase();
    return originalOpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    const url = this._cdUrl;
    const method = this._cdMethod;
    
    if (method === 'POST') {
      if (url.includes('/submit') || url.includes('/submissions') || 
          url.includes('practiceapi')) {
        cacheSubmittedCode(url, body);
      }
    }

    this.addEventListener('load', function() {
      if (!url) return;
      try {
        const data = JSON.parse(this.responseText);

        // GFG POST response with immediate verdict
        if (method === 'POST' && url.includes('geeksforgeeks.org') && url.includes('api')) {
          if (isGfgAccepted(data)) {
            buildAndSendSubmission('GFG', getTitleSlug());
            return;
          }
          // Async GFG results are detected by intercepting GFG's own GET polling below
        }

        // GFG GET polling by GFG's own frontend
        if (method === 'GET' && url.includes('geeksforgeeks.org') && url.includes('api')) {
          const isAccepted = isGfgAccepted(data);
          if (isAccepted) {
            const titleSlug = getTitleSlug();
            if (!window._pendingGfgJobs['_last_' + titleSlug] || 
                Date.now() - window._pendingGfgJobs['_last_' + titleSlug] > 5000) {
              window._pendingGfgJobs['_last_' + titleSlug] = Date.now();
              buildAndSendSubmission('GFG', titleSlug);
            }
          }
        }
      } catch (e) {}
    });

    return originalSend.apply(this, arguments);
  };


})();
