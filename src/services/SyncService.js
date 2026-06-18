// @ts-check

import { NetworkError, InvalidTokenError, RepoNotFoundError, RateLimitError } from '../utils/errors.js';
import { Logger } from '../utils/Logger.js';
import { getSyncPath } from '../utils/path.js';

const log = new Logger('SyncService');

export class SyncService {
  /**
   * Pushes a file payload directly to GitHub.
   * Strictly acts as a network caller; formatting/casing is delegated to utilities.
   * 
   * @param {Object} payload - Pre-formatted solution payload.
   * @param {string} payload.path - Relative target repository path (e.g. 'LeetCode/Easy/1_TwoSum.py').
   * @param {string} payload.content - Formatted file content string.
   * @param {string} payload.commitMessage - Commit message text.
   * @param {Object} config - Config settings.
   * @param {string} config.githubToken - GitHub Personal Access Token.
   * @param {string} config.githubRepo - target repository 'username/repo'.
   * @param {string} [config.githubBranch] - Optional target branch name (defaults to 'main').
   * @returns {Promise<boolean>} Resolves to true on successful push.
   * @throws {InvalidTokenError | RepoNotFoundError | RateLimitError | NetworkError | Error}
   */
  static async pushToGitHub(payload, config) {
    const { path, content, commitMessage } = payload;
    const { githubToken, githubRepo, githubBranch = 'main' } = config;

    const authHeader = `token ${githubToken}`;
    const baseUrl = `https://api.github.com/repos/${githubRepo}/contents/${path}`;
    
    // Add branch ref to the GET request if checking existence
    const getUrl = githubBranch ? `${baseUrl}?ref=${encodeURIComponent(githubBranch)}` : baseUrl;

    log.debug(`Syncing solution to GitHub path: ${path} | Branch: ${githubBranch}`);

    let getRes;
    try {
      getRes = await fetch(getUrl, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
    } catch (err) {
      log.warn('GitHub API fetch failed (network offline):', err);
      throw new NetworkError();
    }

    // Handle initial auth or path issues
    if (!getRes.ok && getRes.status !== 404) {
      await this._handleHttpError(getRes);
    }

    let sha = null;
    if (getRes.ok) {
      try {
        const getJson = await getRes.json();
        sha = getJson.sha;
      } catch (e) {
        log.warn('Failed to parse GET content JSON:', e);
      }
    }

    // Construct the commit request body
    const body = {
      message: commitMessage,
      content: btoa(unescape(encodeURIComponent(content))), // Unicode safe base64
    };
    if (sha) body.sha = sha;
    if (githubBranch) body.branch = githubBranch;

    let putRes;
    try {
      putRes = await fetch(baseUrl, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
    } catch (err) {
      log.warn('GitHub API PUT failed (network offline):', err);
      throw new NetworkError();
    }

    if (!putRes.ok) {
      await this._handleHttpError(putRes);
    }

    log.info(`Pushed solution: ${path} successfully to branch: ${githubBranch}`);
    return true;
  }

  /**
   * Helper to map HTTP status codes to custom Operational Errors.
   * 
   * @private
   * @param {Response} response
   * @throws {InvalidTokenError | RepoNotFoundError | RateLimitError | Error}
   */
  static async _handleHttpError(response) {
    const status = response.status;
    let errorMsg = `GitHub API error (Status: ${status})`;
    try {
      const errorJson = await response.json();
      if (errorJson && errorJson.message) {
        errorMsg = errorJson.message;
      }
    } catch (e) {}

    if (status === 401 || status === 403) {
      throw new InvalidTokenError(errorMsg);
    }
    if (status === 404) {
      throw new RepoNotFoundError(errorMsg);
    }
    if (status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const delaySeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
      throw new RateLimitError(errorMsg, delaySeconds);
    }

    throw new Error(errorMsg);
  }

  /**
   * Updates the repository's README.md file with the solved problems portfolio.
   * 
   * @param {Array<Object>} completedItems - List of completed QueueItems.
   * @param {Object} config - Config settings.
   * @param {string} config.githubToken - GitHub Personal Access Token.
   * @param {string} config.githubRepo - target repository 'username/repo'.
   * @param {string} [config.githubBranch] - Optional target branch name (defaults to 'main').
   * @returns {Promise<boolean>}
   */
  static async updateReadme(completedItems, config) {
    const { githubToken, githubRepo, githubBranch = 'main' } = config;
    if (!githubToken || !githubRepo) return false;

    const authHeader = `token ${githubToken}`;
    const baseUrl = `https://api.github.com/repos/${githubRepo}/contents/README.md`;
    const getUrl = githubBranch ? `${baseUrl}?ref=${encodeURIComponent(githubBranch)}` : baseUrl;

    log.debug(`Fetching README.md from repo to update portfolio...`);

    let getRes;
    let existingContent = '';
    let sha = null;

    try {
      getRes = await fetch(getUrl, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (getRes.ok) {
        const getJson = await getRes.json();
        sha = getJson.sha;
        // Decode base64 to string safely
        existingContent = decodeURIComponent(escape(atob(getJson.content)));
      } else if (getRes.status !== 404) {
        // Log error and proceed, don't throw to avoid breaking main sync flow
        log.warn(`Failed to fetch README.md (Status: ${getRes.status})`);
        return false;
      }
    } catch (err) {
      log.warn('Failed to fetch README.md due to network/CORS error:', err);
      return false;
    }

    // Generate the portfolio markdown
    const portfolioMarkdown = this._generatePortfolioMarkdown(completedItems);

    const startMarker = '<!-- COMMITDSA_START -->';
    const endMarker = '<!-- COMMITDSA_END -->';

    let updatedContent = '';
    if (existingContent.includes(startMarker) && existingContent.includes(endMarker)) {
      // Replace existing content between markers
      const startIndex = existingContent.indexOf(startMarker);
      const endIndex = existingContent.indexOf(endMarker) + endMarker.length;
      
      updatedContent = existingContent.substring(0, startIndex) +
                       portfolioMarkdown +
                       existingContent.substring(endIndex);
    } else {
      // Append or create new README
      if (existingContent.trim()) {
        updatedContent = existingContent.trim() + '\n\n' + portfolioMarkdown + '\n';
      } else {
        updatedContent = portfolioMarkdown + '\n';
      }
    }

    // Push the updated README.md back to GitHub
    const body = {
      message: 'docs: update DSA portfolio README [skip ci]',
      content: btoa(unescape(encodeURIComponent(updatedContent))),
    };
    if (sha) body.sha = sha;
    if (githubBranch) body.branch = githubBranch;

    try {
      const putRes = await fetch(baseUrl, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!putRes.ok) {
        log.warn(`Failed to commit README.md update (Status: ${putRes.status})`);
        return false;
      }

      log.info('README.md portfolio updated successfully.');
      return true;
    } catch (err) {
      log.warn('Failed to commit README.md update due to network/CORS error:', err);
      return false;
    }
  }

  /**
   * Generates the markdown string for the portfolio.
   * 
   * @private
   * @param {Array<Object>} completedItems - List of completed QueueItems.
   * @returns {string}
   */
  static _generatePortfolioMarkdown(completedItems) {
    // 1. Calculate Statistics
    let leetcode = { total: 0, easy: 0, medium: 0, hard: 0 };
    let gfg = { total: 0, easy: 0, medium: 0, hard: 0, basic: 0, school: 0 };

    completedItems.forEach(item => {
      const p = item.payload;
      const platform = p.platform.toLowerCase();
      const diff = p.difficulty.toLowerCase().trim();

      if (platform === 'leetcode') {
        leetcode.total++;
        if (diff === 'easy') leetcode.easy++;
        else if (diff === 'medium') leetcode.medium++;
        else if (diff === 'hard') leetcode.hard++;
      } else if (platform === 'gfg') {
        gfg.total++;
        if (diff === 'easy') gfg.easy++;
        else if (diff === 'medium') gfg.medium++;
        else if (diff === 'hard') gfg.hard++;
        else if (diff === 'basic') gfg.basic++;
        else if (diff === 'school') gfg.school++;
      }
    });

    const totalStats = {
      total: leetcode.total + gfg.total,
      easy: leetcode.easy + gfg.easy,
      medium: leetcode.medium + gfg.medium,
      hard: leetcode.hard + gfg.hard,
      other: (gfg.basic || 0) + (gfg.school || 0)
    };

    // Sort completedItems by platform and difficulty
    const difficultyWeight = {
      'easy': 1,
      'medium': 2,
      'hard': 3,
      'basic': 4,
      'school': 5
    };

    const sortedItems = [...completedItems].sort((a, b) => {
      const platA = a.payload.platform.toLowerCase();
      const platB = b.payload.platform.toLowerCase();
      if (platA !== platB) {
        return platA === 'leetcode' ? -1 : 1;
      }

      const diffA = a.payload.difficulty.toLowerCase();
      const diffB = b.payload.difficulty.toLowerCase();
      const weightA = difficultyWeight[diffA] || 99;
      const weightB = difficultyWeight[diffB] || 99;
      if (weightA !== weightB) {
        return weightA - weightB;
      }

      return a.payload.title.localeCompare(b.payload.title);
    });

    // Build markdown content
    let md = '<!-- COMMITDSA_START -->\n';
    md += '# DSA Portfolio\n\n';
    md += 'Welcome to my DSA solutions portfolio! This repository contains my solved problems on LeetCode and GeeksforGeeks, synchronized automatically using [CommitDSA](https://github.com/aprshubh/CommitDSA).\n\n';
    md += '## Statistics\n\n';
    md += '| Platform | Total Solved | Easy | Medium | Hard |' + (totalStats.other > 0 ? ' Basic/School |' : '') + '\n';
    md += '| --- | --- | --- | --- | --- |' + (totalStats.other > 0 ? ' --- |' : '') + '\n';
    
    // LeetCode Stats Row
    md += `| LeetCode | ${leetcode.total} | ${leetcode.easy} | ${leetcode.medium} | ${leetcode.hard} |` + (totalStats.other > 0 ? ' - |' : '') + '\n';
    
    // GFG Stats Row
    md += `| GeeksforGeeks | ${gfg.total} | ${gfg.easy} | ${gfg.medium} | ${gfg.hard} |` + (totalStats.other > 0 ? ` ${gfg.basic + gfg.school} |` : '') + '\n';
    
    // Combined Total Row
    md += `| **Total** | **${totalStats.total}** | **${totalStats.easy}** | **${totalStats.medium}** | **${totalStats.hard}** |` + (totalStats.other > 0 ? ` **${totalStats.other}** |` : '') + '\n\n';

    md += '## Solved Problems\n\n';
    md += '| # | Problem | Platform | Difficulty | Language | Code |\n';
    md += '| --- | --- | --- | --- | --- | --- |\n';

    sortedItems.forEach((item, index) => {
      const p = item.payload;
      const platName = p.platform.toLowerCase() === 'leetcode' ? 'LeetCode' : 'GeeksforGeeks';
      const path = p.customPath || getSyncPath(p.platform, p.difficulty, p.title, p.language);
      const codeLink = `[Code](./${path})`;
      
      // Escape pipe characters in problem title to avoid breaking markdown tables
      const escapedTitle = p.title.replace(/\|/g, '\\|');
      
      md += `| ${index + 1} | [${escapedTitle}](${p.url}) | ${platName} | ${p.difficulty} | ${p.language.toUpperCase()} | ${codeLink} |\n`;
    });

    md += '<!-- COMMITDSA_END -->';
    return md;
  }
}
