import { describe, it, expect } from 'vitest';
import { formatSourceCode, formatCommitMessage } from '../../src/utils/sourceFormatter.js';

describe('sourceFormatter.js utility tests', () => {
  describe('formatSourceCode', () => {
    it('should format Python code with triple quotes banner', () => {
      /** @type {import('../../src/models/types.js').SolvedProblem} */
      const problem = {
        id: 'leetcode-two-sum-py',
        title: 'Two Sum',
        slug: 'two-sum',
        platform: 'LeetCode',
        language: 'python3',
        difficulty: 'Easy',
        topics: [],
        code: 'print("hello")',
        url: 'https://leetcode.com/problems/two-sum/',
        solvedAt: 12345
      };

      const result = formatSourceCode(problem);
      expect(result).toContain('"""');
      expect(result).toContain('Problem Link : https://leetcode.com/problems/two-sum/');
      expect(result).toContain('Platform     : LeetCode');
      expect(result).toContain('Difficulty   : Easy');
      expect(result).toContain('print("hello")');
    });

    it('should format CPP code with slash star banner and boilerplate inclusion', () => {
      /** @type {import('../../src/models/types.js').SolvedProblem} */
      const problem = {
        id: 'leetcode-two-sum-cpp',
        title: 'Two Sum',
        slug: 'two-sum',
        platform: 'LeetCode',
        language: 'cpp',
        difficulty: 'Easy',
        topics: [],
        code: 'int main() {}',
        url: 'https://leetcode.com/problems/two-sum/',
        solvedAt: 12345
      };

      const result = formatSourceCode(problem);
      expect(result).toContain('/**');
      expect(result).toContain('Problem Link : https://leetcode.com/problems/two-sum/');
      expect(result).toContain('#include <bits/stdc++.h>');
      expect(result).toContain('using namespace std;');
      expect(result).toContain('int main() {}');
    });

    it('should not add duplicate CPP header if already present in code', () => {
      /** @type {import('../../src/models/types.js').SolvedProblem} */
      const problem = {
        id: 'leetcode-two-sum-cpp',
        title: 'Two Sum',
        slug: 'two-sum',
        platform: 'LeetCode',
        language: 'cpp',
        difficulty: 'Easy',
        topics: [],
        code: '#include <iostream>\nint main() {}',
        url: 'https://leetcode.com/problems/two-sum/',
        solvedAt: 12345
      };

      const result = formatSourceCode(problem);
      // count occurrences of '#include' in result
      const count = (result.match(/#include/g) || []).length;
      expect(count).toBe(1);
    });
  });

  describe('formatCommitMessage', () => {
    it('should generate standard formatted commit messages', () => {
      /** @type {import('../../src/models/types.js').SolvedProblem} */
      const problem = {
        id: 'leetcode-two-sum-cpp',
        title: 'Two Sum',
        slug: 'two-sum',
        platform: 'LeetCode',
        language: 'cpp',
        difficulty: 'Easy',
        topics: [],
        code: 'int main() {}',
        url: 'https://leetcode.com/problems/two-sum/',
        solvedAt: 12345
      };

      const msg = formatCommitMessage(problem);
      expect(msg).toBe('Sync LeetCode - Two Sum (Easy)');
    });
  });
});
