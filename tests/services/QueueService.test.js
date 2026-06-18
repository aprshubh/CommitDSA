import { beforeEach, describe, it, expect, vi } from 'vitest';

// 1. Mock Chrome storage APIs
const mockStore = {};
// @ts-ignore
global.chrome = {
  runtime: { lastError: null },
  storage: {
    local: {
      get: vi.fn((keys, callback) => {
        const result = {};
        if (typeof keys === 'string') {
          result[keys] = mockStore[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach(k => {
            result[k] = mockStore[k];
          });
        }
        callback(result);
      }),
      set: vi.fn((items, callback) => {
        Object.assign(mockStore, items);
        callback();
      })
    }
  }
};

// 2. Mock SyncService pushes
vi.mock('../../src/services/SyncService.js', () => {
  return {
    SyncService: {
      pushToGitHub: vi.fn(),
      updateReadme: vi.fn().mockResolvedValue(true)
    }
  };
});

// Import mock target after mocking SyncService
import { SyncService } from '../../src/services/SyncService.js';
import { QueueService } from '../../src/services/QueueService.js';
import { QUEUE_STATUS } from '../../src/utils/constants.js';
import { InvalidTokenError, NetworkError } from '../../src/utils/errors.js';

describe('QueueService tests', () => {
  beforeEach(() => {
    // Clear mock store
    for (const key of Object.keys(mockStore)) {
      delete mockStore[key];
    }
    mockStore['githubToken'] = 'token_xyz';
    mockStore['githubRepo'] = 'user/repo';
    mockStore['githubBranch'] = 'main';
    mockStore['syncQueue'] = [];

    vi.clearAllMocks();
  });

  it('should successfully enqueue and process a solved problem in the background', async () => {
    // @ts-ignore
    SyncService.pushToGitHub.mockResolvedValue(true);

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
      solvedAt: Date.now()
    };

    await QueueService.enqueue(problem);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify enqueued item status is completed in storage
    const queue = mockStore['syncQueue'];
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe('leetcode-two-sum-cpp');
    expect(queue[0].status).toBe(QUEUE_STATUS.COMPLETED);
    
    // Verify sync push was triggered once
    expect(SyncService.pushToGitHub).toHaveBeenCalledTimes(1);

    // Verify readme update was triggered once
    expect(SyncService.updateReadme).toHaveBeenCalledTimes(1);
  });

  it('should use solvedProblem.customPath if present instead of getSyncPath', async () => {
    // @ts-ignore
    SyncService.pushToGitHub.mockResolvedValue(true);

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
      solvedAt: Date.now(),
      customPath: 'MyCustomFolder/TwoSumMain.cpp'
    };

    await QueueService.enqueue(problem);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(SyncService.pushToGitHub).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'MyCustomFolder/TwoSumMain.cpp' }),
      expect.any(Object)
    );
  });

  it('should handle deduplication and overwrite pending items', async () => {
    // Prevent immediate processing during enqueue by mock failing SyncService
    // @ts-ignore
    SyncService.pushToGitHub.mockRejectedValue(new NetworkError());

    /** @type {import('../../src/models/types.js').SolvedProblem} */
    const problem1 = {
      id: 'leetcode-two-sum-cpp',
      title: 'Two Sum',
      slug: 'two-sum',
      platform: 'LeetCode',
      language: 'cpp',
      difficulty: 'Easy',
      topics: [],
      code: 'int main() { /* old code */ }',
      url: 'https://leetcode.com/problems/two-sum/',
      solvedAt: Date.now()
    };

    /** @type {import('../../src/models/types.js').SolvedProblem} */
    const problem2 = {
      id: 'leetcode-two-sum-cpp',
      title: 'Two Sum',
      slug: 'two-sum',
      platform: 'LeetCode',
      language: 'cpp',
      difficulty: 'Easy',
      topics: [],
      code: 'int main() { /* new code */ }',
      url: 'https://leetcode.com/problems/two-sum/',
      solvedAt: Date.now()
    };

    await QueueService.enqueue(problem1);
    await QueueService.enqueue(problem2);
    await new Promise(resolve => setTimeout(resolve, 50));

    const queue = mockStore['syncQueue'];
    expect(queue.length).toBe(1); // Only 1 item due to deduplication
    expect(queue[0].payload.code).toBe('int main() { /* new code */ }'); // Updated code
  });

  it('should transition to failed and set retryable = false on non-retryable errors', async () => {
    // Mock unauthorized invalid token error
    // @ts-ignore
    SyncService.pushToGitHub.mockRejectedValue(new InvalidTokenError());

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
      solvedAt: Date.now()
    };

    await QueueService.enqueue(problem);
    await new Promise(resolve => setTimeout(resolve, 50));

    const queue = mockStore['syncQueue'];
    expect(queue[0].status).toBe(QUEUE_STATUS.FAILED);
    expect(queue[0].retryable).toBe(false); // Non-retryable error
    expect(queue[0].error.reason).toBe('INVALID_TOKEN');
  });

  it('should restore stuck processing items back to pending on startup', async () => {
    mockStore['syncQueue'] = [
      {
        id: 'leetcode-two-sum-cpp',
        status: QUEUE_STATUS.PROCESSING,
        retryCount: 0,
        createdAt: Date.now(),
        lastAttempt: 0,
        retryable: true,
        error: null,
        payload: {
          id: 'leetcode-two-sum-cpp',
          title: 'Two Sum',
          slug: 'two-sum',
          platform: 'LeetCode',
          language: 'cpp',
          difficulty: 'Easy',
          topics: [],
          code: 'int main() {}',
          url: 'https://leetcode.com/problems/two-sum/',
          solvedAt: Date.now()
        }
      }
    ];

    // Mock successful sync
    // @ts-ignore
    SyncService.pushToGitHub.mockResolvedValue(true);

    await QueueService.restoreProcessingItems();

    const queue = mockStore['syncQueue'];
    expect(queue[0].status).toBe(QUEUE_STATUS.COMPLETED); // Restored to pending, then processed to completion
  });
});
