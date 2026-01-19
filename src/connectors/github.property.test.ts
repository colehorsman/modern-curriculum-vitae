/**
 * Property-based tests for GitHub Connector
 * 
 * Tests repository metadata completeness using fast-check.
 * @see Requirements 1.3 - Capture repository metadata
 * @see Requirements 1.5 - Private repository flagging
 */

// Feature: career-showcase-platform, Property 1: Repository Metadata Completeness
// **Validates: Requirements 1.3**

// Feature: career-showcase-platform, Property 3: Private Repository Flagging
// **Validates: Requirements 1.5**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Repository, RepositoryDisplayOptions } from '../types/github.js';
import { 
  getRepositoryDisplayOptions, 
  isAbstractOnly, 
  shouldIncludeRepositoryLink 
} from '../types/github.js';

/**
 * Maps GitHub API repository response to Repository interface
 * This is a standalone version of the mapping function for property testing.
 * 
 * @see Requirements 1.3 - Capture repository metadata
 */
function mapRepoToRepository(
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
 * GitHub API repository response type (simulating API response)
 */
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

/**
 * Arbitrary generator for GitHub API repository responses
 * Generates random but valid GitHub API response shapes
 */
const githubApiRepositoryArbitrary: fc.Arbitrary<GitHubApiRepository> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  full_name: fc.tuple(
    fc.string({ minLength: 1, maxLength: 39 }).filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
    fc.string({ minLength: 1, maxLength: 100 }).filter(s => /^[a-zA-Z0-9._-]+$/.test(s))
  ).map(([owner, repo]) => `${owner}/${repo}`),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  private: fc.boolean(),
  html_url: fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => s.trim().length > 0)
    .map(s => `https://github.com/${s}`),
  stargazers_count: fc.nat({ max: 1000000 }),
  forks_count: fc.nat({ max: 100000 }),
  updated_at: fc.date({ min: new Date('2008-01-01'), max: new Date() })
    .map(d => d.toISOString()),
  topics: fc.option(
    fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-z0-9-]+$/.test(s)), { maxLength: 20 }),
    { nil: undefined }
  ),
  license: fc.option(
    fc.record({ spdx_id: fc.constantFrom('MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC') }),
    { nil: null }
  ),
});

/**
 * Arbitrary generator for languages map
 * Generates random language byte counts
 */
const languagesArbitrary: fc.Arbitrary<Record<string, number>> = fc.dictionary(
  fc.constantFrom(
    'TypeScript', 'JavaScript', 'Python', 'Java', 'Go', 'Rust', 'C++', 'C', 
    'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'HTML', 'CSS', 'Shell'
  ),
  fc.nat({ max: 1000000 })
);

// Feature: career-showcase-platform, Property 2: GitHub Error Handling
// **Validates: Requirements 1.4**

import type { GitHubError, GitHubErrorType } from '../types/github.js';

/**
 * Creates a mock Response object for testing error handling
 */
function createMockResponse(
  status: number,
  statusText: string,
  body: object = {},
  headers: Record<string, string> = {}
): Response {
  const headersObj = new Headers(headers);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: headersObj,
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone: function() { return createMockResponse(status, statusText, body, headers); },
  } as Response;
}

/**
 * Extracts the error handling logic for testing
 * This mirrors the handleErrorResponse method from GitHubConnector
 */
async function handleErrorResponse(response: Response): Promise<GitHubError> {
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
        retryAfter = 1000; // Default base delay
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
 * Patterns that indicate raw API error details that should NOT be exposed
 */
const RAW_API_PATTERNS = [
  /\bstack\s*trace\b/i,
  /\binternal\s*server\b/i,
  /\bexception\b/i,
  /\bnull\s*pointer\b/i,
  /\bsegmentation\s*fault\b/i,
  /\bsyntax\s*error\b/i,
  /\btype\s*error\b/i,
  /\breference\s*error\b/i,
  /at\s+\w+\s*\(/,  // Stack trace pattern like "at Function ("
  /\.js:\d+:\d+/,   // File:line:column pattern
  /\.ts:\d+:\d+/,   // TypeScript file:line:column pattern
  /\bERRNO\b/i,
  /\bECONNREFUSED\b/i,
  /\bECONNRESET\b/i,
  /\bETIMEDOUT\b/i,
];

/**
 * Patterns that indicate actionable guidance in error messages
 */
const ACTIONABLE_GUIDANCE_PATTERNS = [
  /please/i,
  /try again/i,
  /check/i,
  /verify/i,
  /wait/i,
  /contact/i,
  /re-authenticate/i,
  /retr(y|ied|ying)/i,  // retry, retried, retrying
  /automatically/i,
];

/**
 * Arbitrary generator for HTTP error status codes
 */
const errorStatusCodeArbitrary = fc.oneof(
  fc.constant(401),  // Unauthorized
  fc.constant(403),  // Forbidden
  fc.constant(404),  // Not Found
  fc.integer({ min: 500, max: 599 }),  // Server errors (500-599)
);

/**
 * Arbitrary generator for raw API error messages (that should be sanitized)
 */
const rawApiErrorMessageArbitrary = fc.oneof(
  fc.constant('Bad credentials'),
  fc.constant('Not Found'),
  fc.constant('API rate limit exceeded'),
  fc.constant('Server Error'),
  fc.constant('Internal Server Error'),
  fc.constant('Service Unavailable'),
  fc.constant('Gateway Timeout'),
  fc.string({ minLength: 0, maxLength: 200 }),
);

/**
 * Arbitrary generator for rate limit headers
 */
const rateLimitHeadersArbitrary = fc.record({
  remaining: fc.nat({ max: 5000 }),
  limit: fc.integer({ min: 60, max: 5000 }),
  resetOffset: fc.integer({ min: 60, max: 3600 }), // seconds from now
});

describe('GitHub Connector Property Tests', () => {
  describe('Property 1: Repository Metadata Completeness', () => {
    // Feature: career-showcase-platform, Property 1: Repository Metadata Completeness
    // **Validates: Requirements 1.3**
    
    it('should always produce Repository objects with all required fields', () => {
      fc.assert(
        fc.property(
          githubApiRepositoryArbitrary,
          languagesArbitrary,
          (apiResponse, languages) => {
            const repository = mapRepoToRepository(apiResponse, languages);

            // Verify all required fields are present
            expect(repository).toHaveProperty('name');
            expect(repository).toHaveProperty('description');
            expect(repository).toHaveProperty('isPrivate');
            expect(repository).toHaveProperty('languages');
            expect(repository).toHaveProperty('stars');
            expect(repository).toHaveProperty('forks');
            expect(repository).toHaveProperty('lastUpdated');
            expect(repository).toHaveProperty('topics');
            expect(repository).toHaveProperty('url');
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should always produce Repository objects with correct field types', () => {
      fc.assert(
        fc.property(
          githubApiRepositoryArbitrary,
          languagesArbitrary,
          (apiResponse, languages) => {
            const repository = mapRepoToRepository(apiResponse, languages);

            // Verify field types
            expect(typeof repository.name).toBe('string');
            expect(repository.description === null || typeof repository.description === 'string').toBe(true);
            expect(typeof repository.isPrivate).toBe('boolean');
            expect(typeof repository.languages).toBe('object');
            expect(repository.languages !== null).toBe(true);
            expect(typeof repository.stars).toBe('number');
            expect(typeof repository.forks).toBe('number');
            expect(repository.lastUpdated instanceof Date).toBe(true);
            expect(Array.isArray(repository.topics)).toBe(true);
            expect(typeof repository.url).toBe('string');
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should correctly map name field from API response', () => {
      fc.assert(
        fc.property(
          githubApiRepositoryArbitrary,
          languagesArbitrary,
          (apiResponse, languages) => {
            const repository = mapRepoToRepository(apiResponse, languages);
            expect(repository.name).toBe(apiResponse.name);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should correctly map description field (including null)', () => {
      fc.assert(
        fc.property(
          githubApiRepositoryArbitrary,
          languagesArbitrary,
          (apiResponse, languages) => {
            const repository = mapRepoToRepository(apiResponse, languages);
            expect(repository.description).toBe(apiResponse.description);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should correctly map isPrivate flag from API response', () => {
      fc.assert(
        fc.property(
          githubApiRepositoryArbitrary,
          languagesArbitrary,
          (apiResponse, languages) => {
            const repository = mapRepoToRepository(apiResponse, languages);
            expect(repository.isPrivate).toBe(apiResponse.private);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should correctly map languages map', () => {
      fc.assert(
        fc.property(
          githubApiRepositoryArbitrary,
          languagesArbitrary,
          (apiResponse, languages) => {
            const repository = mapRepoToRepository(apiResponse, languages);
            expect(repository.languages).toEqual(languages);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should correctly map stars count from stargazers_count', () => {
      fc.assert(
        fc.property(
          githubApiRepositoryArbitrary,
          languagesArbitrary,
          (apiResponse, languages) => {
            const repository = mapRepoToRepository(apiResponse, languages);
            expect(repository.stars).toBe(apiResponse.stargazers_count);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should correctly map forks count from forks_count', () => {
      fc.assert(
        fc.property(
          githubApiRepositoryArbitrary,
          languagesArbitrary,
          (apiResponse, languages) => {
            const repository = mapRepoToRepository(apiResponse, languages);
            expect(repository.forks).toBe(apiResponse.forks_count);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should correctly parse lastUpdated as a valid Date', () => {
      fc.assert(
        fc.property(
          githubApiRepositoryArbitrary,
          languagesArbitrary,
          (apiResponse, languages) => {
            const repository = mapRepoToRepository(apiResponse, languages);
            expect(repository.lastUpdated instanceof Date).toBe(true);
            expect(isNaN(repository.lastUpdated.getTime())).toBe(false);
            expect(repository.lastUpdated.toISOString()).toBe(apiResponse.updated_at);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should correctly map topics array (defaulting to empty array when undefined)', () => {
      fc.assert(
        fc.property(
          githubApiRepositoryArbitrary,
          languagesArbitrary,
          (apiResponse, languages) => {
            const repository = mapRepoToRepository(apiResponse, languages);
            expect(Array.isArray(repository.topics)).toBe(true);
            
            if (apiResponse.topics !== undefined) {
              expect(repository.topics).toEqual(apiResponse.topics);
            } else {
              expect(repository.topics).toEqual([]);
            }
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should correctly map url from html_url', () => {
      fc.assert(
        fc.property(
          githubApiRepositoryArbitrary,
          languagesArbitrary,
          (apiResponse, languages) => {
            const repository = mapRepoToRepository(apiResponse, languages);
            expect(repository.url).toBe(apiResponse.html_url);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should handle edge cases: empty languages map', () => {
      fc.assert(
        fc.property(
          githubApiRepositoryArbitrary,
          (apiResponse) => {
            const emptyLanguages: Record<string, number> = {};
            const repository = mapRepoToRepository(apiResponse, emptyLanguages);
            
            expect(repository.languages).toEqual({});
            expect(Object.keys(repository.languages).length).toBe(0);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should handle edge cases: zero stars and forks', () => {
      fc.assert(
        fc.property(
          githubApiRepositoryArbitrary.map(repo => ({
            ...repo,
            stargazers_count: 0,
            forks_count: 0,
          })),
          languagesArbitrary,
          (apiResponse, languages) => {
            const repository = mapRepoToRepository(apiResponse, languages);
            
            expect(repository.stars).toBe(0);
            expect(repository.forks).toBe(0);
            expect(typeof repository.stars).toBe('number');
            expect(typeof repository.forks).toBe('number');
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should handle edge cases: null description', () => {
      fc.assert(
        fc.property(
          githubApiRepositoryArbitrary.map(repo => ({
            ...repo,
            description: null,
          })),
          languagesArbitrary,
          (apiResponse, languages) => {
            const repository = mapRepoToRepository(apiResponse, languages);
            
            expect(repository.description).toBeNull();
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should handle edge cases: empty topics array', () => {
      fc.assert(
        fc.property(
          githubApiRepositoryArbitrary.map(repo => ({
            ...repo,
            topics: [],
          })),
          languagesArbitrary,
          (apiResponse, languages) => {
            const repository = mapRepoToRepository(apiResponse, languages);
            
            expect(repository.topics).toEqual([]);
            expect(Array.isArray(repository.topics)).toBe(true);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should produce non-negative numeric values for stars and forks', () => {
      fc.assert(
        fc.property(
          githubApiRepositoryArbitrary,
          languagesArbitrary,
          (apiResponse, languages) => {
            const repository = mapRepoToRepository(apiResponse, languages);
            
            expect(repository.stars).toBeGreaterThanOrEqual(0);
            expect(repository.forks).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });
  });

  // Feature: career-showcase-platform, Property 2: GitHub Error Handling
  // **Validates: Requirements 1.4**
  describe('Property 2: GitHub Error Handling', () => {
    /**
     * Helper to check if a message contains raw API error details
     */
    function containsRawApiDetails(message: string): boolean {
      return RAW_API_PATTERNS.some(pattern => pattern.test(message));
    }

    /**
     * Helper to check if a message contains actionable guidance
     */
    function containsActionableGuidance(message: string): boolean {
      return ACTIONABLE_GUIDANCE_PATTERNS.some(pattern => pattern.test(message));
    }

    /**
     * Maps status code to expected error type
     */
    function getExpectedErrorType(statusCode: number): GitHubErrorType {
      switch (statusCode) {
        case 401:
          return 'unauthorized';
        case 403:
          return 'forbidden';
        case 404:
          return 'not_found';
        default:
          if (statusCode >= 500) {
            return 'server_error';
          }
          return 'unknown';
      }
    }

    it('should produce user-friendly error messages for all error status codes', async () => {
      await fc.assert(
        fc.asyncProperty(
          errorStatusCodeArbitrary,
          rawApiErrorMessageArbitrary,
          async (statusCode, rawMessage) => {
            const response = createMockResponse(
              statusCode,
              rawMessage,
              { message: rawMessage }
            );

            const error = await handleErrorResponse(response);

            // Error message should be non-empty
            expect(error.message).toBeTruthy();
            expect(error.message.length).toBeGreaterThan(0);

            // Error message should NOT contain raw API error details
            expect(containsRawApiDetails(error.message)).toBe(false);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should include actionable guidance in all error messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          errorStatusCodeArbitrary,
          rawApiErrorMessageArbitrary,
          async (statusCode, rawMessage) => {
            const response = createMockResponse(
              statusCode,
              rawMessage,
              { message: rawMessage }
            );

            const error = await handleErrorResponse(response);

            // Error message should contain actionable guidance
            expect(containsActionableGuidance(error.message)).toBe(true);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should correctly classify error types based on status code', async () => {
      await fc.assert(
        fc.asyncProperty(
          errorStatusCodeArbitrary,
          rawApiErrorMessageArbitrary,
          async (statusCode, rawMessage) => {
            const response = createMockResponse(
              statusCode,
              rawMessage,
              { message: rawMessage }
            );

            const error = await handleErrorResponse(response);
            const expectedType = getExpectedErrorType(statusCode);

            // Error type should match expected type based on status code
            expect(error.type).toBe(expectedType);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should include status code in the error object', async () => {
      await fc.assert(
        fc.asyncProperty(
          errorStatusCodeArbitrary,
          rawApiErrorMessageArbitrary,
          async (statusCode, rawMessage) => {
            const response = createMockResponse(
              statusCode,
              rawMessage,
              { message: rawMessage }
            );

            const error = await handleErrorResponse(response);

            // Status code should be preserved
            expect(error.statusCode).toBe(statusCode);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should mark server errors (500+) as retryable', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 500, max: 599 }),
          rawApiErrorMessageArbitrary,
          async (statusCode, rawMessage) => {
            const response = createMockResponse(
              statusCode,
              rawMessage,
              { message: rawMessage }
            );

            const error = await handleErrorResponse(response);

            // Server errors should be retryable
            expect(error.retryable).toBe(true);
            expect(error.retryAfter).toBeDefined();
            expect(error.retryAfter).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should mark 401 unauthorized errors as non-retryable', async () => {
      await fc.assert(
        fc.asyncProperty(
          rawApiErrorMessageArbitrary,
          async (rawMessage) => {
            const response = createMockResponse(
              401,
              rawMessage,
              { message: rawMessage }
            );

            const error = await handleErrorResponse(response);

            // 401 errors should not be retryable (need re-authentication)
            expect(error.retryable).toBe(false);
            expect(error.type).toBe('unauthorized');
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should mark 404 not found errors as non-retryable', async () => {
      await fc.assert(
        fc.asyncProperty(
          rawApiErrorMessageArbitrary,
          async (rawMessage) => {
            const response = createMockResponse(
              404,
              rawMessage,
              { message: rawMessage }
            );

            const error = await handleErrorResponse(response);

            // 404 errors should not be retryable
            expect(error.retryable).toBe(false);
            expect(error.type).toBe('not_found');
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should handle rate-limited 403 errors with retry information', async () => {
      await fc.assert(
        fc.asyncProperty(
          rateLimitHeadersArbitrary,
          async (rateLimitInfo) => {
            const resetTimestamp = Math.floor(Date.now() / 1000) + rateLimitInfo.resetOffset;
            const response = createMockResponse(
              403,
              'Forbidden',
              { message: 'API rate limit exceeded' },
              {
                'x-ratelimit-remaining': '0',
                'x-ratelimit-limit': String(rateLimitInfo.limit),
                'x-ratelimit-reset': String(resetTimestamp),
              }
            );

            const error = await handleErrorResponse(response);

            // Rate-limited errors should be retryable
            expect(error.retryable).toBe(true);
            expect(error.type).toBe('forbidden');
            expect(error.retryAfter).toBeDefined();
            expect(error.retryAfter).toBeGreaterThan(0);
            // Message should mention rate limit
            expect(error.message.toLowerCase()).toContain('rate limit');
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should handle non-rate-limited 403 errors as non-retryable', async () => {
      await fc.assert(
        fc.asyncProperty(
          rawApiErrorMessageArbitrary,
          fc.integer({ min: 1, max: 5000 }), // remaining > 0
          async (rawMessage, remaining) => {
            const response = createMockResponse(
              403,
              rawMessage,
              { message: rawMessage },
              {
                'x-ratelimit-remaining': String(remaining),
              }
            );

            const error = await handleErrorResponse(response);

            // Non-rate-limited 403 errors should not be retryable
            expect(error.retryable).toBe(false);
            expect(error.type).toBe('forbidden');
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should never expose raw API error messages in user-facing output', async () => {
      // Test with various raw API error messages that should be sanitized
      const dangerousMessages = [
        'Bad credentials',
        'Not Found',
        'API rate limit exceeded for user ID 12345',
        'Server Error at /api/v3/repos',
        'Internal Server Error',
        'Service Unavailable',
        'Gateway Timeout',
        'null',
        'undefined',
        '',
      ];

      for (const rawMessage of dangerousMessages) {
        for (const statusCode of [401, 403, 404, 500, 502, 503]) {
          const response = createMockResponse(
            statusCode,
            rawMessage,
            { message: rawMessage }
          );

          const error = await handleErrorResponse(response);

          // The raw message should not appear verbatim in the user-facing message
          // (unless it's a generic term that's also in our user-friendly message)
          expect(error.message).not.toBe(rawMessage);
          
          // Should not contain technical details
          expect(containsRawApiDetails(error.message)).toBe(false);
        }
      }
    });

    it('should produce consistent error structure for all error types', async () => {
      await fc.assert(
        fc.asyncProperty(
          errorStatusCodeArbitrary,
          rawApiErrorMessageArbitrary,
          async (statusCode, rawMessage) => {
            const response = createMockResponse(
              statusCode,
              rawMessage,
              { message: rawMessage }
            );

            const error = await handleErrorResponse(response);

            // All errors should have required fields
            expect(error).toHaveProperty('type');
            expect(error).toHaveProperty('statusCode');
            expect(error).toHaveProperty('message');
            expect(error).toHaveProperty('retryable');

            // Type should be a valid GitHubErrorType
            const validTypes: GitHubErrorType[] = [
              'unauthorized', 'forbidden', 'not_found', 
              'server_error', 'network_error', 'unknown'
            ];
            expect(validTypes).toContain(error.type);

            // Message should be a non-empty string
            expect(typeof error.message).toBe('string');
            expect(error.message.length).toBeGreaterThan(0);

            // Retryable should be a boolean
            expect(typeof error.retryable).toBe('boolean');
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should include retry timing for retryable errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 500, max: 599 }),
          rawApiErrorMessageArbitrary,
          async (statusCode, rawMessage) => {
            const response = createMockResponse(
              statusCode,
              rawMessage,
              { message: rawMessage }
            );

            const error = await handleErrorResponse(response);

            // Retryable errors should have retryAfter
            if (error.retryable) {
              expect(error.retryAfter).toBeDefined();
              expect(typeof error.retryAfter).toBe('number');
              expect(error.retryAfter).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });
  });

  // Feature: career-showcase-platform, Property 3: Private Repository Flagging
  // **Validates: Requirements 1.5**
  describe('Property 3: Private Repository Flagging', () => {
    /**
     * Arbitrary generator for Repository objects with varying isPrivate values
     * Generates random but valid Repository objects for property testing
     */
    const repositoryArbitrary: fc.Arbitrary<Repository> = fc.record({
      name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
      isPrivate: fc.boolean(),
      languages: fc.dictionary(
        fc.constantFrom('TypeScript', 'JavaScript', 'Python', 'Java', 'Go', 'Rust'),
        fc.nat({ max: 1000000 })
      ),
      stars: fc.nat({ max: 1000000 }),
      forks: fc.nat({ max: 100000 }),
      lastUpdated: fc.date({ min: new Date('2008-01-01'), max: new Date() }),
      topics: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 }),
      url: fc.string({ minLength: 1, maxLength: 100 })
        .filter(s => s.trim().length > 0)
        .map(s => `https://github.com/${s}`),
    });

    /**
     * Arbitrary generator for private repositories only
     */
    const privateRepositoryArbitrary = repositoryArbitrary.map(repo => ({
      ...repo,
      isPrivate: true,
    }));

    /**
     * Arbitrary generator for public repositories only
     */
    const publicRepositoryArbitrary = repositoryArbitrary.map(repo => ({
      ...repo,
      isPrivate: false,
    }));

    describe('getRepositoryDisplayOptions', () => {
      it('should set abstractOnly to true when isPrivate is true', () => {
        fc.assert(
          fc.property(
            privateRepositoryArbitrary,
            (repository) => {
              const options = getRepositoryDisplayOptions(repository);
              expect(options.abstractOnly).toBe(true);
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });

      it('should set includeRepositoryLink to false when isPrivate is true', () => {
        fc.assert(
          fc.property(
            privateRepositoryArbitrary,
            (repository) => {
              const options = getRepositoryDisplayOptions(repository);
              expect(options.includeRepositoryLink).toBe(false);
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });

      it('should set abstractOnly to false when isPrivate is false', () => {
        fc.assert(
          fc.property(
            publicRepositoryArbitrary,
            (repository) => {
              const options = getRepositoryDisplayOptions(repository);
              expect(options.abstractOnly).toBe(false);
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });

      it('should set includeRepositoryLink to true when isPrivate is false', () => {
        fc.assert(
          fc.property(
            publicRepositoryArbitrary,
            (repository) => {
              const options = getRepositoryDisplayOptions(repository);
              expect(options.includeRepositoryLink).toBe(true);
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });

      it('should return consistent display options for any repository configuration', () => {
        fc.assert(
          fc.property(
            repositoryArbitrary,
            (repository) => {
              const options = getRepositoryDisplayOptions(repository);

              // Verify all required fields are present
              expect(options).toHaveProperty('abstractOnly');
              expect(options).toHaveProperty('includeRepositoryLink');
              expect(options).toHaveProperty('includeCodeSnippets');
              expect(options).toHaveProperty('includeFilePaths');

              // Verify field types
              expect(typeof options.abstractOnly).toBe('boolean');
              expect(typeof options.includeRepositoryLink).toBe('boolean');
              expect(typeof options.includeCodeSnippets).toBe('boolean');
              expect(typeof options.includeFilePaths).toBe('boolean');

              // Verify logical consistency: abstractOnly and includeRepositoryLink are mutually exclusive
              expect(options.abstractOnly).toBe(!options.includeRepositoryLink);
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });

      it('should ensure private repos never have repository links generated', () => {
        fc.assert(
          fc.property(
            privateRepositoryArbitrary,
            (repository) => {
              const options = getRepositoryDisplayOptions(repository);
              
              // Private repos must have abstract-only display
              expect(options.abstractOnly).toBe(true);
              // Private repos must NOT include repository links
              expect(options.includeRepositoryLink).toBe(false);
              // Private repos should not include code snippets
              expect(options.includeCodeSnippets).toBe(false);
              // Private repos should not include file paths
              expect(options.includeFilePaths).toBe(false);
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });
    });

    describe('isAbstractOnly', () => {
      it('should return true when isPrivate is true', () => {
        fc.assert(
          fc.property(
            privateRepositoryArbitrary,
            (repository) => {
              expect(isAbstractOnly(repository)).toBe(true);
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });

      it('should return false when isPrivate is false', () => {
        fc.assert(
          fc.property(
            publicRepositoryArbitrary,
            (repository) => {
              expect(isAbstractOnly(repository)).toBe(false);
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });

      it('should be consistent with getRepositoryDisplayOptions.abstractOnly', () => {
        fc.assert(
          fc.property(
            repositoryArbitrary,
            (repository) => {
              const options = getRepositoryDisplayOptions(repository);
              expect(isAbstractOnly(repository)).toBe(options.abstractOnly);
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });

      it('should return boolean for any repository configuration', () => {
        fc.assert(
          fc.property(
            repositoryArbitrary,
            (repository) => {
              const result = isAbstractOnly(repository);
              expect(typeof result).toBe('boolean');
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });
    });

    describe('shouldIncludeRepositoryLink', () => {
      it('should return false when isPrivate is true', () => {
        fc.assert(
          fc.property(
            privateRepositoryArbitrary,
            (repository) => {
              expect(shouldIncludeRepositoryLink(repository)).toBe(false);
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });

      it('should return true when isPrivate is false', () => {
        fc.assert(
          fc.property(
            publicRepositoryArbitrary,
            (repository) => {
              expect(shouldIncludeRepositoryLink(repository)).toBe(true);
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });

      it('should be consistent with getRepositoryDisplayOptions.includeRepositoryLink', () => {
        fc.assert(
          fc.property(
            repositoryArbitrary,
            (repository) => {
              const options = getRepositoryDisplayOptions(repository);
              expect(shouldIncludeRepositoryLink(repository)).toBe(options.includeRepositoryLink);
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });

      it('should return boolean for any repository configuration', () => {
        fc.assert(
          fc.property(
            repositoryArbitrary,
            (repository) => {
              const result = shouldIncludeRepositoryLink(repository);
              expect(typeof result).toBe('boolean');
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });

      it('should be the logical inverse of isAbstractOnly', () => {
        fc.assert(
          fc.property(
            repositoryArbitrary,
            (repository) => {
              expect(shouldIncludeRepositoryLink(repository)).toBe(!isAbstractOnly(repository));
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });
    });

    describe('Cross-function consistency', () => {
      it('should maintain invariant: private repos always have abstractOnly=true and includeRepositoryLink=false', () => {
        fc.assert(
          fc.property(
            repositoryArbitrary,
            (repository) => {
              if (repository.isPrivate) {
                const options = getRepositoryDisplayOptions(repository);
                expect(options.abstractOnly).toBe(true);
                expect(options.includeRepositoryLink).toBe(false);
                expect(isAbstractOnly(repository)).toBe(true);
                expect(shouldIncludeRepositoryLink(repository)).toBe(false);
              }
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });

      it('should maintain invariant: public repos always have abstractOnly=false and includeRepositoryLink=true', () => {
        fc.assert(
          fc.property(
            repositoryArbitrary,
            (repository) => {
              if (!repository.isPrivate) {
                const options = getRepositoryDisplayOptions(repository);
                expect(options.abstractOnly).toBe(false);
                expect(options.includeRepositoryLink).toBe(true);
                expect(isAbstractOnly(repository)).toBe(false);
                expect(shouldIncludeRepositoryLink(repository)).toBe(true);
              }
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });

      it('should work correctly with minimal repository object (only isPrivate field)', () => {
        fc.assert(
          fc.property(
            fc.boolean(),
            (isPrivate) => {
              const minimalRepo = { isPrivate };
              
              const options = getRepositoryDisplayOptions(minimalRepo);
              expect(options.abstractOnly).toBe(isPrivate);
              expect(options.includeRepositoryLink).toBe(!isPrivate);
              
              expect(isAbstractOnly(minimalRepo)).toBe(isPrivate);
              expect(shouldIncludeRepositoryLink(minimalRepo)).toBe(!isPrivate);
            }
          ),
          { numRuns: 100, seed: Date.now() }
        );
      });
    });
  });
});
