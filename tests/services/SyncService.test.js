import { beforeEach, describe, it, expect, vi } from 'vitest';
import { SyncService } from '../../src/services/SyncService.js';

// Setup global mock for fetch
global.fetch = vi.fn();

describe('SyncService README update tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const completedItems = [
    {
      id: 'leetcode-two-sum-cpp',
      status: 'completed',
      payload: {
        platform: 'leetcode',
        difficulty: 'Easy',
        title: '1. Two Sum',
        slug: 'two-sum',
        language: 'cpp',
        url: 'https://leetcode.com/problems/two-sum/',
        solvedAt: Date.now()
      }
    },
    {
      id: 'leetcode-add-two-numbers-java',
      status: 'completed',
      payload: {
        platform: 'leetcode',
        difficulty: 'Medium',
        title: '2. Add Two Numbers',
        slug: 'add-two-numbers',
        language: 'java',
        url: 'https://leetcode.com/problems/add-two-numbers/',
        solvedAt: Date.now()
      }
    },
    {
      id: 'gfg-find-duplicates-python3',
      status: 'completed',
      payload: {
        platform: 'gfg',
        difficulty: 'Easy',
        title: 'Find Duplicates',
        slug: 'find-duplicates',
        language: 'python3',
        url: 'https://practice.geeksforgeeks.org/problems/find-duplicates/',
        solvedAt: Date.now()
      }
    },
    {
      id: 'gfg-school-problem-cpp',
      status: 'completed',
      payload: {
        platform: 'gfg',
        difficulty: 'School',
        title: 'School Problem',
        slug: 'school-problem',
        language: 'cpp',
        url: 'https://practice.geeksforgeeks.org/problems/school-problem/',
        solvedAt: Date.now()
      }
    }
  ];

  const config = {
    githubToken: 'mock_token',
    githubRepo: 'testuser/testrepo',
    githubBranch: 'main'
  };

  it('should correctly generate portfolio markdown', () => {
    // @ts-ignore
    const md = SyncService._generatePortfolioMarkdown(completedItems);

    expect(md).toContain('<!-- COMMITDSA_START -->');
    expect(md).toContain('<!-- COMMITDSA_END -->');
    expect(md).toContain('# DSA Portfolio');
    expect(md).toContain('| LeetCode | 2 | 1 | 1 | 0 | - |');
    expect(md).toContain('| GeeksforGeeks | 2 | 1 | 0 | 0 | 1 |');
    expect(md).toContain('| **Total** | **4** | **2** | **1** | **0** | **1** |');
    expect(md).toContain('[1. Two Sum](https://leetcode.com/problems/two-sum/)');
    expect(md).toContain('[Find Duplicates](https://practice.geeksforgeeks.org/problems/find-duplicates/)');
    expect(md).toContain('[Code](./LeetCode/Easy/1_TwoSum.cpp)');
  });

  it('should fetch README, update it within markers, and PUT it back', async () => {
    const existingReadme = "Some custom introduction here.\n<!-- COMMITDSA_START -->\nold portfolio\n<!-- COMMITDSA_END -->\nSome custom footer here.";
    
    // Mock GET response returning existing README
    // @ts-ignore
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        sha: 'abc123sha',
        content: btoa(unescape(encodeURIComponent(existingReadme)))
      })
    });

    // Mock PUT response success
    // @ts-ignore
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({})
    });

    const success = await SyncService.updateReadme(completedItems, config);
    expect(success).toBe(true);

    expect(fetch).toHaveBeenCalledTimes(2);
    
    // Verify GET arguments
    expect(fetch).toHaveBeenNthCalledWith(1, 
      'https://api.github.com/repos/testuser/testrepo/contents/README.md?ref=main',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'token mock_token'
        })
      })
    );

    // Verify PUT arguments
    expect(fetch).toHaveBeenNthCalledWith(2,
      'https://api.github.com/repos/testuser/testrepo/contents/README.md',
      expect.objectContaining({
        method: 'PUT',
        body: expect.any(String)
      })
    );

    // Check that PUT body contains the updated content preserved within markers
    // @ts-ignore
    const putCallArgs = fetch.mock.calls[1];
    const requestBody = JSON.parse(putCallArgs[1].body);
    const updatedContent = decodeURIComponent(escape(atob(requestBody.content)));

    expect(updatedContent).toContain("Some custom introduction here.");
    expect(updatedContent).toContain("Some custom footer here.");
    expect(updatedContent).toContain("<!-- COMMITDSA_START -->");
    expect(updatedContent).toContain("<!-- COMMITDSA_END -->");
    expect(updatedContent).toContain("| LeetCode | 2 | 1 | 1 | 0 | - |");
    expect(requestBody.sha).toBe('abc123sha');
    expect(requestBody.branch).toBe('main');
  });

  it('should create a new README if it does not exist (404)', async () => {
    // Mock GET response returning 404 Not Found
    // @ts-ignore
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' })
    });

    // Mock PUT response success
    // @ts-ignore
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({})
    });

    const success = await SyncService.updateReadme(completedItems, config);
    expect(success).toBe(true);

    expect(fetch).toHaveBeenCalledTimes(2);

    // @ts-ignore
    const putCallArgs = fetch.mock.calls[1];
    const requestBody = JSON.parse(putCallArgs[1].body);
    const updatedContent = decodeURIComponent(escape(atob(requestBody.content)));

    expect(updatedContent).toContain("<!-- COMMITDSA_START -->");
    expect(updatedContent).toContain("<!-- COMMITDSA_END -->");
    expect(updatedContent).toContain("| LeetCode | 2 | 1 | 1 | 0 | - |");
    expect(requestBody.sha).toBeUndefined(); // No SHA since file was created
  });
});
