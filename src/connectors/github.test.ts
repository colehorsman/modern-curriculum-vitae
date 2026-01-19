/**
 * Unit tests for GitHubConnector
 * 
 * Tests authentication, repository fetching, and error handling.
 * @see Requirements 1.1, 1.2, 1.3 - GitHub Repository Connection
 * @see Requirements 1.5 - Private repository flagging
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitHubConnector, calculateBackoffDelay } from './github.js';
import type { GitHubError, Repository } from '../types/github.js';
import { 
  getRepositoryDisplayOptions, 
  isAbstractOnly, 
  shouldIncludeRepositoryLink 
} from '../types/github.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GitHubConnector', () => {
  let connector: GitHubConnector;

  beforeEach(() => {
    // Use shorter delays for testing
    connector = new GitHubConnector({ baseDelayMs: 10, maxDelayMs: 100 });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should successfully authenticate with a valid token', async () => {
      const mockUserData = {
        login: 'testuser',
        name: 'Test User',
        bio: 'A test user',
        avatar_url: 'https://avatars.githubusercontent.com/u/123',
        html_url: 'https://github.com/testuser',
        company: 'Test Company',
        location: 'Test City',
        blog: 'https://testuser.com',
        email: 'test@example.com',
        public_repos: 10,
        followers: 100,
        following: 50,
        created_at: '2020-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'x-oauth-scopes': 'repo, user',
        }),
        json: () => Promise.resolve(mockUserData),
      });

      const result = await connector.authenticate('valid-token');

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile?.username).toBe('testuser');
      expect(result.profile?.name).toBe('Test User');
      expect(result.scopes).toEqual(['repo', 'user']);
      expect(connector.isAuthenticated()).toBe(true);
    });

    it('should fail authentication with an invalid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Bad credentials' }),
      });

      const result = await connector.authenticate('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed. Please re-authenticate with a valid token. Your stored token may have expired or been revoked.');
      expect(connector.isAuthenticated()).toBe(false);
    });

    it('should handle network errors during authentication', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await connector.authenticate('any-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error. Please check your internet connection and try again.');
    });
  });

  describe('getRepositories', () => {
    const mockUserData = {
      login: 'testuser',
      name: 'Test User',
      bio: null,
      avatar_url: 'https://avatars.githubusercontent.com/u/123',
      html_url: 'https://github.com/testuser',
      company: null,
      location: null,
      blog: null,
      email: null,
      public_repos: 5,
      followers: 10,
      following: 5,
      created_at: '2020-01-01T00:00:00Z',
    };

    beforeEach(async () => {
      // Authenticate first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'x-oauth-scopes': 'repo' }),
        json: () => Promise.resolve(mockUserData),
      });
      await connector.authenticate('valid-token');
      mockFetch.mockReset();
    });

    it('should fetch all repositories with pagination', async () => {
      const mockRepos = [
        {
          name: 'repo1',
          full_name: 'testuser/repo1',
          description: 'First repository',
          private: false,
          html_url: 'https://github.com/testuser/repo1',
          stargazers_count: 10,
          forks_count: 2,
          updated_at: '2023-06-01T00:00:00Z',
          topics: ['typescript', 'testing'],
        },
        {
          name: 'repo2',
          full_name: 'testuser/repo2',
          description: null,
          private: true,
          html_url: 'https://github.com/testuser/repo2',
          stargazers_count: 0,
          forks_count: 0,
          updated_at: '2023-05-01T00:00:00Z',
          topics: [],
        },
      ];

      const mockLanguages1 = { TypeScript: 5000, JavaScript: 2000 };
      const mockLanguages2 = { Python: 3000 };

      // First page of repos
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockRepos),
      });

      // Languages for repo1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockLanguages1),
      });

      // Languages for repo2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockLanguages2),
      });

      // Empty second page (end of pagination)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });

      const repos = await connector.getRepositories();

      expect(repos).toHaveLength(2);
      expect(repos[0].name).toBe('repo1');
      expect(repos[0].description).toBe('First repository');
      expect(repos[0].isPrivate).toBe(false);
      expect(repos[0].languages).toEqual(mockLanguages1);
      expect(repos[0].stars).toBe(10);
      expect(repos[0].forks).toBe(2);
      expect(repos[0].topics).toEqual(['typescript', 'testing']);

      expect(repos[1].name).toBe('repo2');
      expect(repos[1].isPrivate).toBe(true);
      expect(repos[1].languages).toEqual(mockLanguages2);
    });

    it('should throw error when not authenticated', async () => {
      const newConnector = new GitHubConnector();

      await expect(newConnector.getRepositories()).rejects.toMatchObject({
        type: 'unauthorized',
        message: 'Not authenticated. Please call authenticate() first.',
      });
    });

    it('should handle API errors when fetching repositories', async () => {
      // Mock 3 consecutive 500 errors (max retries)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Server error' }),
        clone: function() { return this; },
      });

      await expect(connector.getRepositories()).rejects.toMatchObject({
        type: 'server_error',
        statusCode: 500,
      });
    });
  });

  describe('getRepositoryDetails', () => {
    const mockUserData = {
      login: 'testuser',
      name: 'Test User',
      bio: null,
      avatar_url: 'https://avatars.githubusercontent.com/u/123',
      html_url: 'https://github.com/testuser',
      company: null,
      location: null,
      blog: null,
      email: null,
      public_repos: 5,
      followers: 10,
      following: 5,
      created_at: '2020-01-01T00:00:00Z',
    };

    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'x-oauth-scopes': 'repo' }),
        json: () => Promise.resolve(mockUserData),
      });
      await connector.authenticate('valid-token');
      mockFetch.mockReset();
    });

    it('should fetch repository details with README and file structure', async () => {
      const mockRepoData = {
        name: 'test-repo',
        full_name: 'testuser/test-repo',
        description: 'A test repository',
        private: false,
        html_url: 'https://github.com/testuser/test-repo',
        stargazers_count: 50,
        forks_count: 10,
        updated_at: '2023-06-15T00:00:00Z',
        topics: ['nodejs', 'api'],
        license: { spdx_id: 'MIT' },
      };

      const mockLanguages = { TypeScript: 10000, JavaScript: 5000 };
      const mockReadme = '# Test Repository\n\nThis is a test.';
      const mockContents = [
        { name: 'src', path: 'src', type: 'dir' },
        { name: 'README.md', path: 'README.md', type: 'file' },
        { name: 'package.json', path: 'package.json', type: 'file' },
      ];

      // Repo data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockRepoData),
      });

      // Languages
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockLanguages),
      });

      // README
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        text: () => Promise.resolve(mockReadme),
      });

      // Contents (file structure)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockContents),
      });

      // Contributors
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          Link: '<https://api.github.com/repos/testuser/test-repo/contributors?page=5>; rel="last"',
        }),
        json: () => Promise.resolve([{ login: 'contributor1' }]),
      });

      const details = await connector.getRepositoryDetails('test-repo');

      expect(details.name).toBe('test-repo');
      expect(details.description).toBe('A test repository');
      expect(details.readme).toBe(mockReadme);
      expect(details.license).toBe('MIT');
      expect(details.contributors).toBe(5);
      expect(details.fileStructure).toHaveLength(3);
      expect(details.fileStructure[0]).toEqual({
        name: 'src',
        path: 'src',
        type: 'directory',
      });
    });

    it('should handle repository without README', async () => {
      const mockRepoData = {
        name: 'no-readme-repo',
        full_name: 'testuser/no-readme-repo',
        description: null,
        private: true,
        html_url: 'https://github.com/testuser/no-readme-repo',
        stargazers_count: 0,
        forks_count: 0,
        updated_at: '2023-01-01T00:00:00Z',
        topics: [],
        license: null,
      };

      // Repo data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockRepoData),
      });

      // Languages
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve({}),
      });

      // README - 404
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
      });

      // Contents
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });

      // Contributors
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });

      const details = await connector.getRepositoryDetails('no-readme-repo');

      expect(details.readme).toBeNull();
      expect(details.license).toBeNull();
      expect(details.fileStructure).toEqual([]);
    });

    it('should handle full repo name with owner', async () => {
      const mockRepoData = {
        name: 'other-repo',
        full_name: 'otheruser/other-repo',
        description: 'Another user repo',
        private: false,
        html_url: 'https://github.com/otheruser/other-repo',
        stargazers_count: 100,
        forks_count: 20,
        updated_at: '2023-06-01T00:00:00Z',
        topics: [],
        license: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockRepoData),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve({}),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });

      const details = await connector.getRepositoryDetails('otheruser/other-repo');

      expect(details.name).toBe('other-repo');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/repos/otheruser/other-repo'),
        expect.any(Object)
      );
    });
  });

  describe('getUserProfile', () => {
    it('should return the authenticated user profile', async () => {
      const mockUserData = {
        login: 'testuser',
        name: 'Test User',
        bio: 'Developer',
        avatar_url: 'https://avatars.githubusercontent.com/u/123',
        html_url: 'https://github.com/testuser',
        company: 'Tech Corp',
        location: 'San Francisco',
        blog: 'https://blog.testuser.com',
        email: 'test@example.com',
        public_repos: 25,
        followers: 500,
        following: 100,
        created_at: '2019-01-15T00:00:00Z',
      };

      // Initial authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'x-oauth-scopes': 'repo, user' }),
        json: () => Promise.resolve(mockUserData),
      });

      await connector.authenticate('valid-token');
      mockFetch.mockReset();

      // Refresh profile
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockUserData),
      });

      const profile = await connector.getUserProfile();

      expect(profile.username).toBe('testuser');
      expect(profile.name).toBe('Test User');
      expect(profile.bio).toBe('Developer');
      expect(profile.company).toBe('Tech Corp');
      expect(profile.location).toBe('San Francisco');
      expect(profile.publicRepos).toBe(25);
      expect(profile.followers).toBe(500);
      expect(profile.createdAt).toEqual(new Date('2019-01-15T00:00:00Z'));
    });

    it('should throw error when not authenticated', async () => {
      const newConnector = new GitHubConnector();

      await expect(newConnector.getUserProfile()).rejects.toMatchObject({
        type: 'unauthorized',
      });
    });
  });

  describe('error handling', () => {
    const mockUserData = {
      login: 'testuser',
      name: 'Test User',
      bio: null,
      avatar_url: 'https://avatars.githubusercontent.com/u/123',
      html_url: 'https://github.com/testuser',
      company: null,
      location: null,
      blog: null,
      email: null,
      public_repos: 5,
      followers: 10,
      following: 5,
      created_at: '2020-01-01T00:00:00Z',
    };

    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'x-oauth-scopes': 'repo' }),
        json: () => Promise.resolve(mockUserData),
      });
      await connector.authenticate('valid-token');
      mockFetch.mockReset();
    });

    it('should handle 403 rate limit errors', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(resetTime),
        }),
        json: () => Promise.resolve({ message: 'API rate limit exceeded' }),
      });

      try {
        await connector.getRepositories();
        expect.fail('Should have thrown an error');
      } catch (error) {
        const gitHubError = error as GitHubError;
        expect(gitHubError.type).toBe('forbidden');
        expect(gitHubError.retryable).toBe(true);
        expect(gitHubError.retryAfter).toBeDefined();
        expect(gitHubError.message).toContain('Rate limit exceeded');
      }
    });

    it('should handle 404 not found errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Not Found' }),
      });

      try {
        await connector.getRepositoryDetails('nonexistent-repo');
        expect.fail('Should have thrown an error');
      } catch (error) {
        const gitHubError = error as GitHubError;
        expect(gitHubError.type).toBe('not_found');
        expect(gitHubError.statusCode).toBe(404);
        expect(gitHubError.retryable).toBe(false);
      }
    });

    it('should handle 500 server errors', async () => {
      // Mock 3 consecutive 500 errors (max retries)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Internal error' }),
        clone: function() { return this; },
      });

      try {
        await connector.getRepositories();
        expect.fail('Should have thrown an error');
      } catch (error) {
        const gitHubError = error as GitHubError;
        expect(gitHubError.type).toBe('server_error');
        expect(gitHubError.retryable).toBe(true);
        expect(gitHubError.message).toContain('GitHub server error');
        expect(gitHubError.message).toContain('500');
      }
    });
  });

  describe('disconnect', () => {
    it('should clear authentication state', async () => {
      const mockUserData = {
        login: 'testuser',
        name: 'Test User',
        bio: null,
        avatar_url: 'https://avatars.githubusercontent.com/u/123',
        html_url: 'https://github.com/testuser',
        company: null,
        location: null,
        blog: null,
        email: null,
        public_repos: 5,
        followers: 10,
        following: 5,
        created_at: '2020-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'x-oauth-scopes': 'repo' }),
        json: () => Promise.resolve(mockUserData),
      });

      await connector.authenticate('valid-token');
      expect(connector.isAuthenticated()).toBe(true);

      connector.disconnect();

      expect(connector.isAuthenticated()).toBe(false);
      expect(connector.getScopes()).toEqual([]);
    });
  });

  describe('retry logic', () => {
    const mockUserData = {
      login: 'testuser',
      name: 'Test User',
      bio: null,
      avatar_url: 'https://avatars.githubusercontent.com/u/123',
      html_url: 'https://github.com/testuser',
      company: null,
      location: null,
      blog: null,
      email: null,
      public_repos: 5,
      followers: 10,
      following: 5,
      created_at: '2020-01-01T00:00:00Z',
    };

    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'x-oauth-scopes': 'repo' }),
        json: () => Promise.resolve(mockUserData),
      });
      await connector.authenticate('valid-token');
      mockFetch.mockReset();
    });

    it('should retry on 500 errors and succeed on subsequent attempt', async () => {
      const mockRepos = [
        {
          name: 'repo1',
          full_name: 'testuser/repo1',
          description: 'First repository',
          private: false,
          html_url: 'https://github.com/testuser/repo1',
          stargazers_count: 10,
          forks_count: 2,
          updated_at: '2023-06-01T00:00:00Z',
          topics: [],
        },
      ];

      // First call: 500 error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Server error' }),
        clone: function() { return this; },
      });

      // Second call (retry): success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockRepos),
      });

      // Languages for repo1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve({ TypeScript: 5000 }),
      });

      // Empty second page (pagination check)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });

      const repos = await connector.getRepositories();

      expect(repos).toHaveLength(1);
      expect(repos[0].name).toBe('repo1');
      // Verify retry happened: 1 failed + 1 success + 1 languages + 1 empty page = 4 calls
      // But since we have < 100 repos, pagination stops after first page
      // So: 1 failed + 1 success + 1 languages = 3 calls minimum
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should fail after max retry attempts on persistent 500 errors', async () => {
      // All calls return 500 error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Server error' }),
        clone: function() { return this; },
      });

      await expect(connector.getRepositories()).rejects.toMatchObject({
        type: 'server_error',
        statusCode: 500,
        retryable: true,
      });

      // Should have made 3 attempts (default max)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 404 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Not Found' }),
      });

      await expect(connector.getRepositoryDetails('nonexistent-repo')).rejects.toMatchObject({
        type: 'not_found',
        statusCode: 404,
        retryable: false,
      });

      // Should have made only 1 attempt
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 401 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Bad credentials' }),
      });

      await expect(connector.getRepositoryDetails('some-repo')).rejects.toMatchObject({
        type: 'unauthorized',
        statusCode: 401,
        retryable: false,
      });

      // Should have made only 1 attempt
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should include rate limit information in 403 error message', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(resetTime),
          'x-ratelimit-limit': '5000',
        }),
        json: () => Promise.resolve({ message: 'API rate limit exceeded' }),
      });

      try {
        await connector.getRepositories();
        expect.fail('Should have thrown an error');
      } catch (error) {
        const gitHubError = error as GitHubError;
        expect(gitHubError.type).toBe('forbidden');
        expect(gitHubError.message).toContain('Rate limit exceeded');
        expect(gitHubError.message).toContain('5000');
        expect(gitHubError.message).toContain('minute');
        expect(gitHubError.retryAfter).toBeDefined();
        expect(gitHubError.retryAfter).toBeGreaterThan(0);
      }
    });
  });
});

describe('calculateBackoffDelay', () => {
  it('should calculate exponential backoff correctly', () => {
    const baseDelay = 1000;
    const maxDelay = 30000;

    // Attempt 0: baseDelay * 2^0 = 1000ms (±25% jitter)
    const delay0 = calculateBackoffDelay(0, baseDelay, maxDelay);
    expect(delay0).toBeGreaterThanOrEqual(750);
    expect(delay0).toBeLessThanOrEqual(1250);

    // Attempt 1: baseDelay * 2^1 = 2000ms (±25% jitter)
    const delay1 = calculateBackoffDelay(1, baseDelay, maxDelay);
    expect(delay1).toBeGreaterThanOrEqual(1500);
    expect(delay1).toBeLessThanOrEqual(2500);

    // Attempt 2: baseDelay * 2^2 = 4000ms (±25% jitter)
    const delay2 = calculateBackoffDelay(2, baseDelay, maxDelay);
    expect(delay2).toBeGreaterThanOrEqual(3000);
    expect(delay2).toBeLessThanOrEqual(5000);
  });

  it('should cap delay at maxDelay', () => {
    const baseDelay = 1000;
    const maxDelay = 5000;

    // Attempt 10: baseDelay * 2^10 = 1024000ms, should be capped at 5000ms
    const delay = calculateBackoffDelay(10, baseDelay, maxDelay);
    expect(delay).toBeLessThanOrEqual(maxDelay);
  });

  it('should return positive values', () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const delay = calculateBackoffDelay(attempt, 1000, 30000);
      expect(delay).toBeGreaterThan(0);
    }
  });
});


/**
 * Tests for private repository flagging
 * @see Requirements 1.5 - Private repositories flagged for abstract-only display
 */
describe('Private Repository Flagging', () => {
  describe('getRepositoryDisplayOptions', () => {
    it('should flag private repositories for abstract-only display', () => {
      const privateRepo: Pick<Repository, 'isPrivate'> = { isPrivate: true };
      const options = getRepositoryDisplayOptions(privateRepo);

      expect(options.abstractOnly).toBe(true);
      expect(options.includeRepositoryLink).toBe(false);
      expect(options.includeCodeSnippets).toBe(false);
      expect(options.includeFilePaths).toBe(false);
    });

    it('should allow full display for public repositories', () => {
      const publicRepo: Pick<Repository, 'isPrivate'> = { isPrivate: false };
      const options = getRepositoryDisplayOptions(publicRepo);

      expect(options.abstractOnly).toBe(false);
      expect(options.includeRepositoryLink).toBe(true);
      expect(options.includeCodeSnippets).toBe(true);
      expect(options.includeFilePaths).toBe(true);
    });

    it('should return consistent options for the same privacy status', () => {
      const privateRepo1: Pick<Repository, 'isPrivate'> = { isPrivate: true };
      const privateRepo2: Pick<Repository, 'isPrivate'> = { isPrivate: true };
      
      const options1 = getRepositoryDisplayOptions(privateRepo1);
      const options2 = getRepositoryDisplayOptions(privateRepo2);

      expect(options1).toEqual(options2);
    });
  });

  describe('isAbstractOnly', () => {
    it('should return true for private repositories', () => {
      const privateRepo: Pick<Repository, 'isPrivate'> = { isPrivate: true };
      expect(isAbstractOnly(privateRepo)).toBe(true);
    });

    it('should return false for public repositories', () => {
      const publicRepo: Pick<Repository, 'isPrivate'> = { isPrivate: false };
      expect(isAbstractOnly(publicRepo)).toBe(false);
    });
  });

  describe('shouldIncludeRepositoryLink', () => {
    it('should return false for private repositories', () => {
      const privateRepo: Pick<Repository, 'isPrivate'> = { isPrivate: true };
      expect(shouldIncludeRepositoryLink(privateRepo)).toBe(false);
    });

    it('should return true for public repositories', () => {
      const publicRepo: Pick<Repository, 'isPrivate'> = { isPrivate: false };
      expect(shouldIncludeRepositoryLink(publicRepo)).toBe(true);
    });
  });

  describe('GitHubConnector private repository handling', () => {
    let connector: GitHubConnector;
    const mockFetch = vi.fn();

    beforeEach(() => {
      global.fetch = mockFetch;
      connector = new GitHubConnector({ baseDelayMs: 10, maxDelayMs: 100 });
      mockFetch.mockReset();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should correctly flag private repositories when fetching repository list', async () => {
      const mockUserData = {
        login: 'testuser',
        name: 'Test User',
        bio: null,
        avatar_url: 'https://avatars.githubusercontent.com/u/123',
        html_url: 'https://github.com/testuser',
        company: null,
        location: null,
        blog: null,
        email: null,
        public_repos: 5,
        followers: 10,
        following: 5,
        created_at: '2020-01-01T00:00:00Z',
      };

      // Authenticate first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'x-oauth-scopes': 'repo' }),
        json: () => Promise.resolve(mockUserData),
      });
      await connector.authenticate('valid-token');
      mockFetch.mockReset();

      const mockRepos = [
        {
          name: 'public-repo',
          full_name: 'testuser/public-repo',
          description: 'A public repository',
          private: false,
          html_url: 'https://github.com/testuser/public-repo',
          stargazers_count: 10,
          forks_count: 2,
          updated_at: '2023-06-01T00:00:00Z',
          topics: ['typescript'],
        },
        {
          name: 'private-repo',
          full_name: 'testuser/private-repo',
          description: 'A private repository',
          private: true,
          html_url: 'https://github.com/testuser/private-repo',
          stargazers_count: 0,
          forks_count: 0,
          updated_at: '2023-05-01T00:00:00Z',
          topics: [],
        },
      ];

      // First page of repos
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockRepos),
      });

      // Languages for public-repo
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve({ TypeScript: 5000 }),
      });

      // Languages for private-repo
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve({ Python: 3000 }),
      });

      // Empty second page (end of pagination)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([]),
      });

      const repos = await connector.getRepositories();

      expect(repos).toHaveLength(2);
      
      // Verify public repo is not flagged as private
      const publicRepo = repos.find(r => r.name === 'public-repo');
      expect(publicRepo).toBeDefined();
      expect(publicRepo!.isPrivate).toBe(false);
      expect(isAbstractOnly(publicRepo!)).toBe(false);
      expect(shouldIncludeRepositoryLink(publicRepo!)).toBe(true);

      // Verify private repo is correctly flagged
      const privateRepo = repos.find(r => r.name === 'private-repo');
      expect(privateRepo).toBeDefined();
      expect(privateRepo!.isPrivate).toBe(true);
      expect(isAbstractOnly(privateRepo!)).toBe(true);
      expect(shouldIncludeRepositoryLink(privateRepo!)).toBe(false);
    });

    it('should correctly flag private repository when fetching repository details', async () => {
      const mockUserData = {
        login: 'testuser',
        name: 'Test User',
        bio: null,
        avatar_url: 'https://avatars.githubusercontent.com/u/123',
        html_url: 'https://github.com/testuser',
        company: null,
        location: null,
        blog: null,
        email: null,
        public_repos: 5,
        followers: 10,
        following: 5,
        created_at: '2020-01-01T00:00:00Z',
      };

      // Authenticate first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'x-oauth-scopes': 'repo' }),
        json: () => Promise.resolve(mockUserData),
      });
      await connector.authenticate('valid-token');
      mockFetch.mockReset();

      const mockPrivateRepoData = {
        name: 'private-project',
        full_name: 'testuser/private-project',
        description: 'A private internal project',
        private: true,
        html_url: 'https://github.com/testuser/private-project',
        stargazers_count: 0,
        forks_count: 0,
        updated_at: '2023-06-15T00:00:00Z',
        topics: ['internal', 'confidential'],
        license: null,
      };

      // Repo data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockPrivateRepoData),
      });

      // Languages
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve({ TypeScript: 10000 }),
      });

      // README
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        text: () => Promise.resolve('# Private Project\n\nInternal documentation.'),
      });

      // Contents (file structure)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([
          { name: 'src', path: 'src', type: 'dir' },
          { name: 'README.md', path: 'README.md', type: 'file' },
        ]),
      });

      // Contributors
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([{ login: 'testuser' }]),
      });

      const details = await connector.getRepositoryDetails('private-project');

      // Verify the repository is correctly flagged as private
      expect(details.isPrivate).toBe(true);
      expect(details.name).toBe('private-project');
      
      // Verify display options for private repository
      const displayOptions = getRepositoryDisplayOptions(details);
      expect(displayOptions.abstractOnly).toBe(true);
      expect(displayOptions.includeRepositoryLink).toBe(false);
      expect(displayOptions.includeCodeSnippets).toBe(false);
      expect(displayOptions.includeFilePaths).toBe(false);
    });

    it('should still retrieve metadata for private repositories', async () => {
      const mockUserData = {
        login: 'testuser',
        name: 'Test User',
        bio: null,
        avatar_url: 'https://avatars.githubusercontent.com/u/123',
        html_url: 'https://github.com/testuser',
        company: null,
        location: null,
        blog: null,
        email: null,
        public_repos: 5,
        followers: 10,
        following: 5,
        created_at: '2020-01-01T00:00:00Z',
      };

      // Authenticate first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'x-oauth-scopes': 'repo' }),
        json: () => Promise.resolve(mockUserData),
      });
      await connector.authenticate('valid-token');
      mockFetch.mockReset();

      const mockPrivateRepoData = {
        name: 'secret-project',
        full_name: 'testuser/secret-project',
        description: 'Top secret project',
        private: true,
        html_url: 'https://github.com/testuser/secret-project',
        stargazers_count: 5,
        forks_count: 1,
        updated_at: '2023-07-01T00:00:00Z',
        topics: ['ai', 'ml', 'internal'],
        license: { spdx_id: 'UNLICENSED' },
      };

      const mockLanguages = { Python: 15000, TypeScript: 5000 };

      // Repo data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockPrivateRepoData),
      });

      // Languages
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(mockLanguages),
      });

      // README
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        text: () => Promise.resolve('# Secret Project\n\nConfidential information.'),
      });

      // Contents
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve([
          { name: 'src', path: 'src', type: 'dir' },
          { name: 'models', path: 'models', type: 'dir' },
        ]),
      });

      // Contributors
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          Link: '<https://api.github.com/repos/testuser/secret-project/contributors?page=3>; rel="last"',
        }),
        json: () => Promise.resolve([{ login: 'testuser' }]),
      });

      const details = await connector.getRepositoryDetails('secret-project');

      // Verify all metadata is still retrieved for private repos
      expect(details.isPrivate).toBe(true);
      expect(details.name).toBe('secret-project');
      expect(details.description).toBe('Top secret project');
      expect(details.languages).toEqual(mockLanguages);
      expect(details.stars).toBe(5);
      expect(details.forks).toBe(1);
      expect(details.topics).toEqual(['ai', 'ml', 'internal']);
      expect(details.license).toBe('UNLICENSED');
      expect(details.readme).toBe('# Secret Project\n\nConfidential information.');
      expect(details.fileStructure).toHaveLength(2);
      expect(details.contributors).toBe(3);

      // But it should be flagged for abstract-only display
      expect(isAbstractOnly(details)).toBe(true);
      expect(shouldIncludeRepositoryLink(details)).toBe(false);
    });
  });
});
