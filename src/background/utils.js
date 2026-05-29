/**
 * @fileoverview Utility functions for the CommitDSA extension.
 * Provides platform-aware date string generation for streak and POTD tracking.
 */

/**
 * Returns a formatted date string tailored for the active platform.
 * LeetCode resets at midnight UTC, so it returns the current UTC date.
 * GFG resets at midnight IST (UTC+5:30), so it returns the current IST date.
 * 
 * @param {string} platform - The active platform ('leetcode' or 'gfg').
 * @returns {string} The active date string in 'YYYY-MM-DD' format.
 */
export function getActiveDateString(platform = 'leetcode') {
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
