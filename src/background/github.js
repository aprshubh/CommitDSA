/**
 * @fileoverview GitHub integration module.
 * Handles formatting solutions and pushing them to a user's GitHub repository.
 */

/**
 * Validates and cleans a GitHub repository path string.
 * Strips URLs, 'git@github.com', trailing slashes, and '.git' suffixes.
 * 
 * @param {string} repo - The raw repository string provided by the user.
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
  const l = lang.toLowerCase();
  if (l.includes('python')) return 'py';
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
 * Pushes a solved coding challenge to the configured GitHub repository via the GitHub API.
 * 
 * @param {Object} data - The problem and solution data.
 * @param {string} data.platform - The platform ('LeetCode' or 'GFG').
 * @param {string} data.titleSlug - The URL slug of the problem.
 * @param {string} data.title - The display title of the problem.
 * @param {string} data.difficulty - The difficulty (e.g., 'Easy').
 * @param {string} data.code - The raw source code of the solution.
 * @param {string} data.lang - The programming language used.
 * @param {Object} config - The user's GitHub configuration.
 * @param {string} config.githubToken - The personal access token.
 * @param {string} config.githubRepo - The target repository ('username/repo').
 * @returns {Promise<boolean>} True if the push was successful or skipped cleanly.
 */
export async function pushToGitHub(data, config) {
  const { platform, titleSlug, title, difficulty, code, lang } = data;
  let { githubToken, githubRepo } = config;
  
  githubRepo = cleanRepoPath(githubRepo);

  // 1. Format file path based on platform
  let problemNumber = "0";
  let cleanTitle = title.trim();
  const numMatch = cleanTitle.match(/^(\d+)[\.\s]+(.*)$/);
  if (numMatch) {
    problemNumber = numMatch[1];
    cleanTitle = numMatch[2];
  }

  // Convert clean title to PascalCase / CamelCase (no underscores)
  const camelCaseTitle = cleanTitle
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .split(/[\s-_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  const extension = getFileExtension(lang);
  const filename = `${problemNumber}_${camelCaseTitle}.${extension}`;
  
  // Organize directly by platform name (e.g. LeetCode, GFG)
  const path = `${platform}/${filename}`;

  // 2. Format file content with header
  const problemUrl = platform === 'LeetCode' 
    ? `https://leetcode.com/problems/${titleSlug}/`
    : `https://practice.geeksforgeeks.org/problems/${titleSlug}/1`;

  let fileContent = "";
  if (extension === 'py') {
    fileContent = `"""\nProblem Link : ${problemUrl}\nPlatform     : ${platform}\nDifficulty   : ${difficulty}\n"""\n\n${code}\n`;
  } else if (extension === 'cpp' || extension === 'c') {
    fileContent = `/**\n * Problem Link : ${problemUrl}\n * Platform     : ${platform}\n * Difficulty   : ${difficulty}\n */\n\n#include <bits/stdc++.h>\nusing namespace std;\n\n${code}\n`;
  } else {
    fileContent = `/**\n * Problem Link : ${problemUrl}\n * Platform     : ${platform}\n * Difficulty   : ${difficulty}\n */\n\n${code}\n`;
  }

  // 3. Send PUT request to GitHub API
  const url = `https://api.github.com/repos/${githubRepo}/contents/${path}`;
  const authHeader = `token ${githubToken}`;

  try {
    // Check if file already exists to get its SHA (required for updating)
    const getRes = await fetch(url, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    let sha = null;
    if (getRes.ok) {
      const getJson = await getRes.json();
      sha = getJson.sha;
    }

    const body = {
      message: `Sync ${platform} - ${cleanTitle} (${difficulty})`,
      content: btoa(unescape(encodeURIComponent(fileContent))), // Base64 encode handling unicode
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!putRes.ok) {
      const errorJson = await putRes.json();
      console.error('[CommitDSA] GitHub Push Error:', errorJson);
      return false;
    }

    console.log(`[CommitDSA] Successfully pushed ${path} to GitHub`);
    return true;

  } catch (err) {
    console.error('[CommitDSA] Error in pushToGitHub:', err);
    return false;
  }
}
