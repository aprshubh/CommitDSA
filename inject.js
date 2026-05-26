(function() {
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    const url = args[0];
    
    // LeetCode's submission check endpoint follows the structure:
    // https://leetcode.com/submissions/detail/<id>/check/
    if (typeof url === 'string' && url.includes('/submissions/detail/') && url.includes('/check/')) {
      try {
        // Clone response to avoid consuming the original stream
        const clone = response.clone();
        const data = await clone.json();
        
        // status_msg "Accepted" signifies a correct solution
        if (data && (data.status_msg === 'Accepted' || data.status_code === 10 || data.state === 'SUCCESS')) {
          // Extract the question's title slug from the current URL path
          // Example: /problems/two-sum/submissions/ -> 'two-sum'
          const match = window.location.pathname.match(/\/problems\/([^/]+)/);
          const titleSlug = match ? match[1] : null;
          
          window.postMessage({
            type: 'LEETCODE_SUBMISSION_ACCEPTED',
            titleSlug: titleSlug,
            submissionId: url.match(/\/detail\/([^/]+)/)?.[1] || null
          }, '*');
        }
      } catch (e) {
        console.warn('[LeetSync] Error intercepting submission details:', e);
      }
    }
    return response;
  };
  
  console.log('[LeetSync] API interceptor injected successfully.');
})();
