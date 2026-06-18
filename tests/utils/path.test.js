import { describe, it, expect } from 'vitest';
import { cleanRepoPath, getFileExtension, getFolderCategory, getSyncPath, getActiveDateString } from '../../src/utils/path.js';

describe('path.js utility tests', () => {
  describe('getActiveDateString', () => {
    it('should return UTC date for leetcode', () => {
      const todayUTC = new Date().toISOString().split('T')[0];
      expect(getActiveDateString('leetcode')).toBe(todayUTC);
    });

    it('should return IST date for gfg', () => {
      const d = new Date();
      const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000);
      const istTime = new Date(utcTime + (330 * 60000));
      const yyyy = istTime.getFullYear();
      const mm = String(istTime.getMonth() + 1).padStart(2, '0');
      const dd = String(istTime.getDate()).padStart(2, '0');
      const expectedIST = `${yyyy}-${mm}-${dd}`;
      
      expect(getActiveDateString('gfg')).toBe(expectedIST);
    });
  });

  describe('cleanRepoPath', () => {
    it('should strip https prefix and trailing slashes', () => {
      expect(cleanRepoPath('https://github.com/user/repo/')).toBe('user/repo');
      expect(cleanRepoPath('http://github.com/user/repo')).toBe('user/repo');
    });

    it('should strip git ssh prefix and trailing slashes', () => {
      expect(cleanRepoPath('git@github.com:user/repo.git')).toBe('user/repo');
    });

    it('should pass through clean username/repo paths', () => {
      expect(cleanRepoPath('user/repo')).toBe('user/repo');
    });

    it('should return empty string for null/empty values', () => {
      expect(cleanRepoPath('')).toBe('');
      // @ts-ignore
      expect(cleanRepoPath(null)).toBe('');
    });
  });

  describe('getFileExtension', () => {
    it('should resolve extensions for common languages', () => {
      expect(getFileExtension('Python3')).toBe('py');
      expect(getFileExtension('C++')).toBe('cpp');
      expect(getFileExtension('Java')).toBe('java');
      expect(getFileExtension('JavaScript')).toBe('js');
      expect(getFileExtension('TypeScript')).toBe('ts');
      expect(getFileExtension('Go')).toBe('go');
      expect(getFileExtension('Rust')).toBe('rs');
    });

    it('should fallback to cpp for unknown languages', () => {
      expect(getFileExtension('Unknown')).toBe('cpp');
    });
  });

  describe('getFolderCategory', () => {
    it('should resolve LeetCode difficulty categories', () => {
      expect(getFolderCategory('LeetCode', 'Easy')).toBe('Easy');
      expect(getFolderCategory('LeetCode', 'Medium')).toBe('Medium');
      expect(getFolderCategory('leetcode', 'hard')).toBe('Hard');
    });

    it('should resolve GFG difficulty categories', () => {
      expect(getFolderCategory('GFG', 'school')).toBe('Basic');
      expect(getFolderCategory('GFG', 'Basic')).toBe('Basic');
      expect(getFolderCategory('GFG', 'Easy')).toBe('Easy');
      expect(getFolderCategory('GFG', 'Medium')).toBe('Medium');
      expect(getFolderCategory('gfg', 'Hard')).toBe('Hard');
    });
  });

  describe('getSyncPath', () => {
    it('should generate deterministic LeetCode sync path', () => {
      const path = getSyncPath('LeetCode', 'Easy', '1. Two Sum', 'python3');
      expect(path).toBe('LeetCode/Easy/1_TwoSum.py');
    });

    it('should generate deterministic GFG sync path', () => {
      const path = getSyncPath('GFG', 'Medium', 'Dijkstra Algorithm', 'java');
      expect(path).toBe('GFG/Medium/0_DijkstraAlgorithm.java');
    });
  });
});
