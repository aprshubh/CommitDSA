import { beforeEach, describe, it, expect, vi } from 'vitest';

// Define chrome global mock before importing StorageService
const mockStore = {};
// @ts-ignore
global.chrome = {
  runtime: {
    lastError: null
  },
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
        } else if (keys === null || keys === undefined) {
          Object.assign(result, mockStore);
        }
        callback(result);
      }),
      set: vi.fn((items, callback) => {
        Object.assign(mockStore, items);
        callback();
      }),
      remove: vi.fn((keys, callback) => {
        if (typeof keys === 'string') {
          delete mockStore[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach(k => {
            delete mockStore[k];
          });
        }
        callback();
      })
    }
  }
};

// Import StorageService after mocking chrome
import { StorageService } from '../../src/services/StorageService.js';

describe('StorageService tests', () => {
  beforeEach(() => {
    // Clear mock store
    for (const key of Object.keys(mockStore)) {
      delete mockStore[key];
    }
    vi.clearAllMocks();
  });

  it('should set and get values correctly', async () => {
    await StorageService.set({ username: 'test_user' });
    const res = await StorageService.get('username');
    expect(res.username).toBe('test_user');
  });

  it('should remove keys correctly', async () => {
    await StorageService.set({ username: 'test_user', token: 'xyz' });
    await StorageService.remove('token');
    const res = await StorageService.get(['username', 'token']);
    expect(res.username).toBe('test_user');
    expect(res.token).toBeUndefined();
  });

  it('should serialize concurrent updates and prevent race conditions', async () => {
    mockStore['counter'] = 0;

    const increment = async () => {
      await StorageService.update('counter', async (val) => {
        // Exaggerate async delay to trigger race conditions if serialization is absent
        await new Promise(resolve => setTimeout(resolve, 20));
        return (val || 0) + 1;
      });
    };

    // Run increments concurrently
    await Promise.all([
      increment(),
      increment(),
      increment(),
      increment()
    ]);

    // Serialized update chain ensures each read sees the previous write's updated state
    expect(mockStore['counter']).toBe(4);
  });

  it('should absorb errors and continue processing the update queue', async () => {
    mockStore['value'] = 'initial';

    const failUpdate = StorageService.update('value', () => {
      throw new Error('Update failed');
    });

    const successUpdate = StorageService.update('value', (val) => {
      return val + '_success';
    });

    // Fire both
    await Promise.allSettled([
      failUpdate,
      successUpdate
    ]);

    // The successful update should complete because the promise queue caught the failed one
    expect(mockStore['value']).toBe('initial_success');
  });
});
