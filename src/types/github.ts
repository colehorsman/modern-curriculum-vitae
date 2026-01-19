/**
 * GitHub-related type definitions
 * 
 * Types for GitHub API integration, repository data, and profile information.
 * @see Requirements 1.3 - Repository metadata capture
 */

/**
 * Represents a file or directory node in a repository's file structure
 */
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

/**
 * Repository metadata retrieved from GitHub API
 * Contains essential information about a repository for portfolio display.
 * 
 * @see Requirements 1.3 - Capture repository metadata including name, description,
 * languages, stars, forks, and last updated date
 */
export interface Repository {
  /** Repository name */
  name: string;
  /** Repository description, null if not provided */
  description: string | null;
  /** Whether the repository is private */
  isPrivate: boolean;
  /** Map of programming languages to bytes of code */
  languages: Record<string, number>;
  /** Number of stars/stargazers */
  stars: number;
  /** Number of forks */
  forks: number;
  /** Date of last update */
  lastUpdated: Date;
  /** Repository topics/tags */
  topics: string[];
  /** URL to the repository */
  url: string;
}

/**
 * Extended repository details including README and file structure
 * Used for detailed analysis during abstract generation.
 * 
 * @see Requirements 2.1 - Analyze repository structure, README, and code patterns
 */
export interface RepositoryDetails extends Repository {
  /** README content, null if not present */
  readme: string | null;
  /** Repository file structure tree */
  fileStructure: FileNode[];
  /** Number of contributors */
  contributors: number;
  /** License identifier, null if not specified */
  license: string | null;
}

/**
 * GitHub user profile information
 * Used for profile integration and README generation.
 * 
 * @see Requirements 11.2 - Include professional introduction in profile README
 */
export interface GitHubProfile {
  /** GitHub username */
  username: string;
  /** Display name */
  name: string | null;
  /** Profile bio */
  bio: string | null;
  /** Avatar image URL */
  avatarUrl: string;
  /** Profile URL */
  profileUrl: string;
  /** Company/organization */
  company: string | null;
  /** Location */
  location: string | null;
  /** Blog/website URL */
  blog: string | null;
  /** Email (if public) */
  email: string | null;
  /** Number of public repositories */
  publicRepos: number;
  /** Number of followers */
  followers: number;
  /** Number of following */
  following: number;
  /** Account creation date */
  createdAt: Date;
}

/**
 * Result of GitHub authentication attempt
 */
export interface AuthResult {
  /** Whether authentication was successful */
  success: boolean;
  /** Error message if authentication failed */
  error?: string;
  /** Authenticated user profile if successful */
  profile?: GitHubProfile;
  /** OAuth scopes granted */
  scopes?: string[];
}

/**
 * GitHub API error types for error handling
 * @see Requirements 1.4 - Display descriptive error message and retry options
 */
export type GitHubErrorType = 
  | 'unauthorized'      // 401 - Invalid or expired token
  | 'forbidden'         // 403 - Rate limited or insufficient permissions
  | 'not_found'         // 404 - Resource not found
  | 'server_error'      // 500+ - GitHub server error
  | 'network_error'     // Network connectivity issues
  | 'unknown';          // Unclassified error

/**
 * Structured GitHub API error
 */
export interface GitHubError {
  /** Error type classification */
  type: GitHubErrorType;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** User-friendly error message */
  message: string;
  /** Whether the operation can be retried */
  retryable: boolean;
  /** Suggested wait time before retry in milliseconds */
  retryAfter?: number;
  /** Original error for debugging */
  originalError?: Error;
}

/**
 * Repository display options for portfolio generation
 * Determines how a repository should be displayed based on its privacy status.
 * 
 * @see Requirements 1.5 - Private repositories flagged for abstract-only display
 * @see Requirements 3.4, 3.5 - Conditional repository link inclusion
 */
export interface RepositoryDisplayOptions {
  /** Whether the repository should be displayed as abstract-only (no direct links) */
  abstractOnly: boolean;
  /** Whether to include a link to the GitHub repository */
  includeRepositoryLink: boolean;
  /** Whether to include code snippets in the display */
  includeCodeSnippets: boolean;
  /** Whether to include file paths in the display */
  includeFilePaths: boolean;
}

/**
 * Determines the display options for a repository based on its privacy status.
 * Private repositories are flagged for abstract-only display.
 * 
 * @param repository - The repository to get display options for
 * @returns RepositoryDisplayOptions indicating how the repository should be displayed
 * @see Requirements 1.5 - Flag private repos for abstract-only display
 */
export function getRepositoryDisplayOptions(repository: Pick<Repository, 'isPrivate'>): RepositoryDisplayOptions {
  const isPrivate = repository.isPrivate;
  
  return {
    abstractOnly: isPrivate,
    includeRepositoryLink: !isPrivate,
    includeCodeSnippets: !isPrivate,
    includeFilePaths: !isPrivate,
  };
}

/**
 * Checks if a repository should be displayed as abstract-only.
 * This is a convenience function that returns true for private repositories.
 * 
 * @param repository - The repository to check
 * @returns true if the repository should be abstract-only, false otherwise
 * @see Requirements 1.5 - Private repositories flagged for abstract-only display
 */
export function isAbstractOnly(repository: Pick<Repository, 'isPrivate'>): boolean {
  return repository.isPrivate;
}

/**
 * Checks if a repository link should be included in the display.
 * Public repositories include links, private repositories do not.
 * 
 * @param repository - The repository to check
 * @returns true if the repository link should be included, false otherwise
 * @see Requirements 3.4, 3.5 - Conditional repository link inclusion
 */
export function shouldIncludeRepositoryLink(repository: Pick<Repository, 'isPrivate'>): boolean {
  return !repository.isPrivate;
}
