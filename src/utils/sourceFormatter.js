// @ts-check

import { getFileExtension } from './path.js';

/**
 * @fileoverview Pure source code formatter to generate solution files with comments and metadata header.
 */

/**
 * Generates the clean formatted code string with standard banner header.
 * 
 * @param {import('../models/types.js').SolvedProblem} solvedProblem - The solved problem payload.
 * @returns {string} Fully formatted solution code content.
 */
export function formatSourceCode(solvedProblem) {
  const { platform, slug, difficulty, code, language, url } = solvedProblem;
  const extension = getFileExtension(language);

  // Fallback to construct problem link if URL is missing
  const problemUrl = url || (platform.toLowerCase() === 'leetcode'
    ? `https://leetcode.com/problems/${slug}/`
    : `https://practice.geeksforgeeks.org/problems/${slug}/1`);

  if (extension === 'py') {
    return `"""\nProblem Link : ${problemUrl}\nPlatform     : ${platform}\nDifficulty   : ${difficulty}\n"""\n\n${code}\n`;
  }

  const commentBlock = `/**\n * Problem Link : ${problemUrl}\n * Platform     : ${platform}\n * Difficulty   : ${difficulty}\n */`;

  if (extension === 'cpp' || extension === 'c') {
    // Add default boilerplate if not already present in the user code
    const hasHeader = code.includes('#include');
    if (!hasHeader) {
      return `${commentBlock}\n\n#include <bits/stdc++.h>\nusing namespace std;\n\n${code}\n`;
    }
  }

  return `${commentBlock}\n\n${code}\n`;
}

/**
 * Generates a standard commit message for the sync commit.
 * 
 * @param {import('../models/types.js').SolvedProblem} solvedProblem
 * @returns {string} Commit message string.
 */
export function formatCommitMessage(solvedProblem) {
  const { platform, title, difficulty } = solvedProblem;
  return `Sync ${platform} - ${title.trim()} (${difficulty})`;
}
