// @ts-check

/**
 * @fileoverview Pure utility functions for clean paths, file extensions, and repo folder categorization.
 */

/**
 * Validates and cleans a GitHub repository path string.
 * Strips URLs, 'git@github.com', trailing slashes, and '.git' suffixes.
 * 
 * @param {string} repo - The raw repository string.
 * @returns {string} The cleaned 'username/repo' string.
 */
export function cleanRepoPath(repo) {
  if (!repo) return '';
  let cleaned = repo.trim();
  cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '');
  cleaned = cleaned.replace(/^git@github\.com:/i, '');
  cleaned = cleaned.replace(/\.git$/i, '');
  cleaned = cleaned.replace(/\/$/, '');
  return cleaned;
}

/**
 * Determines the appropriate file extension based on the programming language name.
 * 
 * @param {string} lang - The programming language name (e.g., 'python3', 'cpp').
 * @returns {string} The file extension (e.g., 'py', 'cpp').
 */
export function getFileExtension(lang) {
  if (!lang) return 'txt';
  const l = lang.toLowerCase().trim();
  if (l.includes('python') || l === 'py') return 'py';
  if (l.includes('java') && !l.includes('javascript')) return 'java';
  if (l.includes('javascript') || l === 'js') return 'js';
  if (l.includes('typescript') || l === 'ts') return 'ts';
  if (l.includes('c++') || l === 'cpp') return 'cpp';
  if (l === 'c') return 'c';
  if (l === 'csharp' || l === 'c#') return 'cs';
  if (l === 'ruby') return 'rb';
  if (l === 'swift') return 'swift';
  if (l === 'go' || l === 'golang') return 'go';
  if (l === 'kotlin' || l === 'kt') return 'kt';
  if (l === 'rust' || l === 'rs') return 'rs';
  if (l === 'php') return 'php';
  if (l === 'sql') return 'sql';
  if (l === 'scala') return 'scala';
  return 'cpp'; // default fallback
}

/**
 * Determines the appropriate folder category based on platform and difficulty.
 * 
 * @param {string} platform - The platform ('LeetCode' or 'GFG').
 * @param {string} difficulty - The raw difficulty level.
 * @returns {string} The normalized subfolder name (e.g., 'Basic', 'Easy', 'Medium', 'Hard').
 */
export function getFolderCategory(platform, difficulty) {
  if (!difficulty) return 'Medium';
  const diffNormalized = difficulty.trim().toLowerCase();
  const platformNormalized = platform.toLowerCase();
  
  if (platformNormalized === 'leetcode') {
    if (diffNormalized.includes('easy')) return 'Easy';
    if (diffNormalized.includes('hard')) return 'Hard';
    return 'Medium';
  } else if (platformNormalized === 'gfg') {
    if (diffNormalized.includes('school') || diffNormalized.includes('basic')) return 'Basic';
    if (diffNormalized.includes('easy')) return 'Easy';
    if (diffNormalized.includes('hard')) return 'Hard';
    return 'Medium';
  }
  return 'Medium';
}

/**
 * Generates the clean target repository path for a solved challenge.
 * 
 * @param {string} platform - The platform name.
 * @param {string} difficulty - Problem difficulty.
 * @param {string} title - Problem title.
 * @param {string} lang - Programming language.
 * @returns {string} Formatted relative repository file path.
 */
export function getSyncPath(platform, difficulty, title, lang) {
  let problemNumber = '0';
  let cleanTitle = title.trim();
  const numMatch = cleanTitle.match(/^(\d+)[\.\s]+(.*)$/);
  if (numMatch) {
    problemNumber = numMatch[1];
    cleanTitle = numMatch[2];
  }

  // Convert clean title to PascalCase / CamelCase (no underscores or special characters)
  const camelCaseTitle = cleanTitle
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .split(/[\s-_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  const extension = getFileExtension(lang);
  const filename = `${problemNumber}_${camelCaseTitle}.${extension}`;
  const category = getFolderCategory(platform, difficulty);
  
  // Normalize platform casing for path consistency
  const platformFolder = platform.toLowerCase() === 'leetcode' ? 'LeetCode' : 'GFG';
  
  return `${platformFolder}/${category}/${filename}`;
}

/**
 * Resolves the active date string based on the platform.
 * LeetCode resets at midnight UTC, while GFG resets at midnight IST (UTC+5:30).
 * 
 * @param {string} [platform] - The platform name ('leetcode' or 'gfg').
 * @returns {string} The active date string (yyyy-mm-dd).
 */
export function getActiveDateString(platform = 'leetcode') {
  const d = new Date();
  if (platform.toLowerCase() === 'leetcode') {
    return d.toISOString().split('T')[0];
  } else {
    const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + (330 * 60000));
    const yyyy = istTime.getFullYear();
    const mm = String(istTime.getMonth() + 1).padStart(2, '0');
    const dd = String(istTime.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}

