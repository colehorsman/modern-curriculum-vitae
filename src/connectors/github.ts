/**
 * GitHub Connector
 * 
 * Handles authentication and data retrieval from GitHub API.
 * @see Requirements 1.1, 1.2, 1.3 - GitHub Repository Connection
 */

import {
  Repository,
  RepositoryDetails,
  GitHubProfile,
  AuthResult,
  GitHubError,
  GitHubErrorType,
  FileNode,
} from '../types/github.js';

/**
 * GitHub API base URL
 */
const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Default number of items per page for pagination
 */
const DEFAULT_PER_PAGE = 100;

/**
 * Retry configuration for exponential backoff
 * @see Requirements 1.4 - Retry options for API errors
 */
interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay in milliseconds for exponential backoff */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Network timeout configuration
 */
const NETWORK_TIMEOUT_MS = 30000;

/**
 * Calculates exponential backoff delay
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay cap
 * @returns Delay in milliseconds with jitter
 */
function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  const delayWithJitter = exponentialDelay + jitter;
  // Cap at maximum delay
  return Math.min(delayWithJitter, maxDelayMs);
}

/**
 * Delays execution for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * GitHubConnector class for interacting with GitHub API
 * 
 * Provides methods for authentication, fetching repositories,
 * repository details, and user profile information.
 */
export class GitHubConnector {
  private token: string | null = null;
  private authenticatedProfile: GitHubProfile | null = null;
  private scopes: string[] = [];
  private retryConfig: RetryConfig;

  /**
   * Creates a new GitHubConnector instance
   * @param retryConfig - Optional retry configuration for exponential backoff
   */
  constructor(retryConfig: Partial<RetryConfig> = {}) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Authenticates with GitHub using an OAuth token
   * 
   * @param token - GitHub OAuth token or personal access token
   * @returns AuthResult indicating success or failure
   * @see Requirements 1.1 - Authenticate and establish connection to GitHub API
   */
  async authenticate(token: string): Promise<AuthResult> {
    try {
      // Validate token by fetching user profile
      const response = await this.makeRequest('/user', token);
      
      if (!response.ok) {
        const error = await this.handleErrorResponse(response);
        return {
          success: false,
          error: error.message,
        };
      }

      // Extract scopes from response headers
      const scopesHeader = response.headers.get('x-oauth-scopes');
      this.scopes = scopesHeader ? scopesHeader.split(', ').filter(Boolean) : [];

      const userData = await response.json() as GitHubApiUser;
      this.authenticatedProfile = this.mapUserToProfile(userData);
      this.token = token;

      return {
        success: true,
        profile: this.authenticatedProfile,
        scopes: this.scopes,
      };
    } catch (error) {
      const gitHubError = this.createNetworkError(error);
      return {
        success: false,
        error: gitHubError.message,
      };
    }
  }

  /**
   * Fetches all accessible repositories for the authenticated user
   * Handles pagination to retrieve all repositories.
   * Uses retry logic with exponential backoff for server errors.
   * 
   * @returns Array of Repository objects
   * @throws GitHubError if not authenticated or API error occurs
   * @see Requirements 1.2 - Retrieve list of all accessible repositories
   * @see Requirements 1.3 - Capture repository metadata
   * @see Requirements 1.4 - Retry options for API errors
   */
  async getRepositories(): Promise<Repository[]> {
    this.ensureAuthenticated();

    const repositories: Repository[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.makeAuthenticatedRequestWithRetry(
        `/user/repos?per_page=${DEFAULT_PER_PAGE}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`
      );

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const repos = await response.json() as GitHubApiRepository[];
      
      if (repos.length === 0) {
        hasMore = false;
      } else {
        // Fetch languages for each repository and map to our interface
        const mappedRepos = await Promise.all(
          repos.map(async (repo: GitHubApiRepository) => {
            const languages = await this.fetchLanguages(repo.full_name);
            return this.mapRepoToRepository(repo, languages);
          })
        );
        repositories.push(...mappedRepos);
        page++;
        
        // Check if we've received fewer items than requested (last page)
        if ((repos as GitHubApiRepository[]).length < DEFAULT_PER_PAGE) {
          hasMore = false;
        }
      }
    }

    return repositories;
  }

  /**
   * Fetches detailed information for a single repository
   * Uses retry logic with exponential backoff for server errors.
   * 
   * @param repoName - Repository name (can be "owner/repo" or just "repo" for authenticated user)
   * @returns RepositoryDetails with extended metadata
   * @throws GitHubError if not authenticated or repository not found
   * @see Requirements 1.3 - Capture repository metadata
   * @see Requirements 1.4 - Retry options for API errors
   */
  async getRepositoryDetails(repoName: string): Promise<RepositoryDetails> {
    this.ensureAuthenticated();

    // If repoName doesn't include owner, prepend authenticated user's username
    const fullRepoName = repoName.includes('/')
      ? repoName
      : `${this.authenticatedProfile!.username}/${repoName}`;

    // Fetch repository data with retry
    const repoResponse = await this.makeAuthenticatedRequestWithRetry(`/repos/${fullRepoName}`);
    if (!repoResponse.ok) {
      throw await this.handleErrorResponse(repoResponse);
    }
    const repoData = await repoResponse.json() as GitHubApiRepository;

    // Fetch languages
    const languages = await this.fetchLanguages(fullRepoName);

    // Fetch README content
    const readme = await this.getReadmeContent(fullRepoName);

    // Fetch file structure (root level)
    const fileStructure = await this.fetchFileStructure(fullRepoName);

    // Fetch contributors count
    const contributorsCount = await this.fetchContributorsCount(fullRepoName);

    const baseRepo = this.mapRepoToRepository(repoData, languages);

    return {
      ...baseRepo,
      readme,
      fileStructure,
      contributors: contributorsCount,
      license: repoData.license?.spdx_id || null,
    };
  }

  /**
   * Fetches README content for a repository
   * 
   * @param repoName - Full repository name (owner/repo)
   * @returns README content as string, or null if not found
   */
  async getReadmeContent(repoName: string): Promise<string | null> {
    this.ensureAuthenticated();

    const fullRepoName = repoName.includes('/')
      ? repoName
      : `${this.authenticatedProfile!.username}/${repoName}`;

    try {
      const response = await this.makeAuthenticatedRequest(
        `/repos/${fullRepoName}/readme`,
        {
          headers: {
            Accept: 'application/vnd.github.raw+json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw await this.handleErrorResponse(response);
      }

      return await response.text();
    } catch (error) {
      // Check if it's a GitHubError with not_found type
      if (
        error !== null &&
        typeof error === 'object' &&
        'type' in error &&
        (error as { type: string }).type === 'not_found'
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetches the authenticated user's profile information
   * Uses retry logic with exponential backoff for server errors.
   * 
   * @returns GitHubProfile with user data
   * @throws GitHubError if not authenticated
   * @see Requirements 1.1 - Establish connection to GitHub API
   * @see Requirements 1.4 - Retry options for API errors
   */
  async getUserProfile(): Promise<GitHubProfile> {
    this.ensureAuthenticated();

    if (this.authenticatedProfile) {
      // Refresh profile data with retry
      const response = await this.makeAuthenticatedRequestWithRetry('/user');
      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }
      const userData = await response.json() as GitHubApiUser;
      this.authenticatedProfile = this.mapUserToProfile(userData);
    }

    return this.authenticatedProfile!;
  }

  /**
   * Checks if the connector is currently authenticated
   */
  isAuthenticated(): boolean {
    return this.token !== null;
  }

  /**
   * Clears the current authentication
   */
  disconnect(): void {
    this.token = null;
    this.authenticatedProfile = null;
    this.scopes = [];
  }

  /**
   * Gets the current OAuth scopes
   */
  getScopes(): string[] {
    return [...this.scopes];
  }

  // Private helper methods

  /**
   * Ensures the connector is authenticated before making API calls
   */
  private ensureAuthenticated(): void {
    if (!this.token) {
      const error: GitHubError = {
        type: 'unauthorized',
        statusCode: 401,
        message: 'Not authenticated. Please call authenticate() first.',
        retryable: false,
      };
      throw error;
    }
  }

  /**
   * Makes an HTTP request to the GitHub API
   */
  private async makeRequest(
    endpoint: string,
    token?: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const existingHeaders = (options.headers as Record<string, string>) || {};
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...existingHeaders,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

    try {
      const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      // Re-throw with more context for timeout errors
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error('Request timed out');
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      throw error;
    }
  }

  /**
   * Makes an authenticated request with retry logic for server errors
   * Implements exponential backoff for 500+ errors
   * @see Requirements 1.4 - Retry options for API errors
   */
  private async makeAuthenticatedRequestWithRetry(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    let lastError: GitHubError | null = null;
    let lastResponse: Response | null = null;

    for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
      try {
        const response = await this.makeAuthenticatedRequest(endpoint, options);
        
        // If successful or non-retryable error, return immediately
        if (response.ok) {
          return response;
        }

        // Check if this is a server error (500+) that should be retried
        if (response.status >= 500) {
          lastResponse = response;
          lastError = await this.handleErrorResponse(response.clone());
          
          // If this is the last attempt, don't wait
          if (attempt < this.retryConfig.maxAttempts - 1) {
            const delayMs = calculateBackoffDelay(
              attempt,
              this.retryConfig.baseDelayMs,
              this.retryConfig.maxDelayMs
            );
            await delay(delayMs);
            continue;
          }
        }

        // For non-500 errors, return the response without retry
        return response;
      } catch (error) {
        // Handle network errors and timeouts
        const isTimeout = error instanceof Error && error.name === 'TimeoutError';
        const isNetworkError = error instanceof Error && 
          (error.message.includes('network') || 
           error.message.includes('fetch') ||
           error.name === 'TypeError');

        if (isTimeout || isNetworkError) {
          lastError = this.createNetworkError(error, isTimeout);
          
          // For timeouts, only retry once (attempt 0 -> attempt 1)
          if (isTimeout && attempt >= 1) {
            throw lastError;
          }
          
          // For network errors, retry with backoff
          if (attempt < this.retryConfig.maxAttempts - 1) {
            const delayMs = calculateBackoffDelay(
              attempt,
              this.retryConfig.baseDelayMs,
              this.retryConfig.maxDelayMs
            );
            await delay(delayMs);
            continue;
          }
        }

        // For other errors, throw immediately
        throw this.createNetworkError(error);
      }
    }

    // If we've exhausted all retries, throw the last error or return last response
    if (lastResponse) {
      return lastResponse;
    }
    
    if (lastError) {
      throw lastError;
    }

    // This shouldn't happen, but provide a fallback
    throw this.createNetworkError(new Error('Request failed after all retry attempts'));
  }

  /**
   * Makes an authenticated request using the stored token
   */
  private async makeAuthenticatedRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    return this.makeRequest(endpoint, this.token!, options);
  }

  /**
   * Fetches languages for a repository
   */
  private async fetchLanguages(fullRepoName: string): Promise<Record<string, number>> {
    const response = await this.makeAuthenticatedRequest(`/repos/${fullRepoName}/languages`);
    if (!response.ok) {
      return {};
    }
    return await response.json() as Record<string, number>;
  }

  /**
   * Fetches the file structure of a repository (root level)
   */
  private async fetchFileStructure(fullRepoName: string): Promise<FileNode[]> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/repos/${fullRepoName}/contents`
      );

      if (!response.ok) {
        return [];
      }

      const contents = await response.json();
      
      if (!Array.isArray(contents)) {
        return [];
      }

      return contents.map((item: GitHubContentItem) => ({
        name: item.name,
        path: item.path,
        type: item.type === 'dir' ? 'directory' : 'file',
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetches the contributors count for a repository
   */
  private async fetchContributorsCount(fullRepoName: string): Promise<number> {
    try {
      const response = await this.makeAuthenticatedRequest(
        `/repos/${fullRepoName}/contributors?per_page=1&anon=true`
      );

      if (!response.ok) {
        return 0;
      }

      // GitHub returns the total count in the Link header
      const linkHeader = response.headers.get('Link');
      if (linkHeader) {
        const lastPageMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
        if (lastPageMatch && lastPageMatch[1]) {
          return parseInt(lastPageMatch[1], 10);
        }
      }

      // If no Link header, count the returned items
      const contributors = await response.json();
      return Array.isArray(contributors) ? contributors.length : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Maps GitHub API user response to GitHubProfile interface
   */
  private mapUserToProfile(userData: GitHubApiUser): GitHubProfile {
    return {
      username: userData.login,
      name: userData.name,
      bio: userData.bio,
      avatarUrl: userData.avatar_url,
      profileUrl: userData.html_url,
      company: userData.company,
      location: userData.location,
      blog: userData.blog || null,
      email: userData.email,
      publicRepos: userData.public_repos,
      followers: userData.followers,
      following: userData.following,
      createdAt: new Date(userData.created_at),
    };
  }

  /**
   * Maps GitHub API repository response to Repository interface
   * @see Requirements 1.3 - Capture repository metadata
   */
  private mapRepoToRepository(
    repoData: GitHubApiRepository,
    languages: Record<string, number>
  ): Repository {
    return {
      name: repoData.name,
      description: repoData.description,
      isPrivate: repoData.private,
      languages,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      lastUpdated: new Date(repoData.updated_at),
      topics: repoData.topics || [],
      url: repoData.html_url,
    };
  }

  /**
   * Handles error responses from GitHub API
   * Provides user-friendly error messages with actionable guidance
   * @see Requirements 1.4 - Display descriptive error message and retry options
   */
  private async handleErrorResponse(response: Response): Promise<GitHubError> {
    let errorMessage = '';
    let errorType: GitHubErrorType;
    let retryable = false;
    let retryAfter: number | undefined;

    try {
      const errorData = await response.json() as { message?: string; documentation_url?: string };
      errorMessage = errorData.message || '';
    } catch {
      errorMessage = response.statusText;
    }

    switch (response.status) {
      case 401:
        errorType = 'unauthorized';
        errorMessage = 'Authentication failed. Please re-authenticate with a valid token. Your stored token may have expired or been revoked.';
        retryable = false;
        break;
        
      case 403:
        errorType = 'forbidden';
        // Check for rate limiting
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        const rateLimitReset = response.headers.get('x-ratelimit-reset');
        const rateLimitLimit = response.headers.get('x-ratelimit-limit');
        
        if (rateLimitRemaining === '0') {
          const resetTimestamp = rateLimitReset ? parseInt(rateLimitReset, 10) * 1000 : Date.now() + 60000;
          const resetTime = new Date(resetTimestamp).toLocaleTimeString();
          const waitTimeMs = resetTimestamp - Date.now();
          const waitMinutes = Math.ceil(waitTimeMs / 60000);
          
          errorMessage = `Rate limit exceeded. You have used all ${rateLimitLimit || 'available'} requests. ` +
            `Please wait ${waitMinutes} minute(s) (until ${resetTime}) before trying again.`;
          retryable = true;
          retryAfter = waitTimeMs > 0 ? waitTimeMs : 60000;
        } else {
          errorMessage = 'Access forbidden. You may not have permission to access this resource. ' +
            'Please check your token permissions or contact the repository owner.';
          retryable = false;
        }
        break;
        
      case 404:
        errorType = 'not_found';
        errorMessage = 'Resource not found. The repository or resource may have been deleted, renamed, or you may not have access. ' +
          'Please verify the repository name and try again.';
        retryable = false;
        break;
        
      default:
        if (response.status >= 500) {
          errorType = 'server_error';
          errorMessage = `GitHub server error (${response.status}). The service is temporarily unavailable. ` +
            `The request will be automatically retried with exponential backoff.`;
          retryable = true;
          retryAfter = this.retryConfig.baseDelayMs;
        } else {
          errorType = 'unknown';
          errorMessage = errorMessage || `An unexpected error occurred (HTTP ${response.status}). Please try again later.`;
          retryable = false;
        }
    }

    const error: GitHubError = {
      type: errorType,
      statusCode: response.status,
      message: errorMessage,
      retryable,
    };

    if (retryAfter !== undefined) {
      error.retryAfter = retryAfter;
    }

    return error;
  }

  /**
   * Creates a network error object
   * @see Requirements 1.4 - Display descriptive error message
   */
  private createNetworkError(error: unknown, isTimeout: boolean = false): GitHubError {
    const originalError = error instanceof Error ? error : new Error(String(error));
    
    if (isTimeout) {
      return {
        type: 'network_error',
        message: 'Request timed out. Please check your internet connection or try again later. You may continue in offline mode.',
        retryable: true,
        retryAfter: 5000, // Suggest waiting 5 seconds before retry
        originalError,
      };
    }
    
    return {
      type: 'network_error',
      message: 'Network error. Please check your internet connection and try again.',
      retryable: true,
      originalError,
    };
  }
}

// GitHub API response types (internal use)

interface GitHubApiUser {
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
  html_url: string;
  company: string | null;
  location: string | null;
  blog: string | null;
  email: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

interface GitHubApiRepository {
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  topics?: string[];
  license?: {
    spdx_id: string;
  } | null;
}

interface GitHubContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

// Export default instance for convenience
export const gitHubConnector = new GitHubConnector();

// Export helper functions for testing
export { calculateBackoffDelay, delay, DEFAULT_RETRY_CONFIG };
export type { RetryConfig };
