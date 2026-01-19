/**
 * Job-related type definitions
 * 
 * Types for job scraping, knowledge base storage, and job search functionality.
 * @see Requirements 4.2, 5.1-5.6 - Job scraping and knowledge base management
 */

/**
 * Salary range information for a job listing
 */
export interface SalaryRange {
  /** Minimum salary */
  min: number;
  /** Maximum salary */
  max: number;
  /** Currency code (e.g., 'USD', 'EUR') */
  currency: string;
  /** Payment period */
  period: 'hourly' | 'annual';
}

/**
 * Job status in the knowledge base
 * @see Requirements 5.6 - Allow users to mark jobs as applied, interested, or dismissed
 */
export type JobStatus = 'new' | 'interested' | 'applied' | 'dismissed' | 'expired';

/**
 * Job type classification
 */
export type JobType = 'full-time' | 'part-time' | 'contract' | 'remote';

/**
 * Experience level classification
 */
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead';

/**
 * Source of job listing
 */
export type JobSource = 'linkedin' | 'indeed' | 'company_website';

/**
 * Job listing stored in the knowledge base
 * Contains all scraped job information with metadata.
 * 
 * @see Requirements 4.2 - Extract job title, company, location, description,
 * requirements, and posting date
 * @see Requirements 5.1 - Store job listings with full metadata and timestamps
 */
export interface JobListing {
  /** Unique identifier */
  id: string;
  /** Job title */
  title: string;
  /** Company name */
  company: string;
  /** Job location */
  location: string;
  /** Full job description */
  description: string;
  /** List of job requirements */
  requirements: string[];
  /** Salary range if available */
  salary?: SalaryRange;
  /** Type of employment */
  jobType: JobType;
  /** Required experience level */
  experienceLevel: ExperienceLevel;
  /** Date the job was posted */
  postedDate: Date;
  /** Date the job was scraped */
  scrapedDate: Date;
  /** Original URL of the job posting */
  sourceUrl: string;
  /** Source platform */
  source: JobSource;
  /** Current status in user's workflow */
  status: JobStatus;
  /** Tags for categorization */
  tags: string[];
  /** Match score based on user profile (0-100) */
  matchScore?: number;
}

/**
 * Filters for job scraping and searching
 * @see Requirements 5.3 - Support filters for location, job type, experience level,
 * and technology keywords
 */
export interface JobFilters {
  /** Keywords to search for */
  keywords: string[];
  /** Locations to filter by */
  locations: string[];
  /** Job types to include */
  jobTypes: JobType[];
  /** Experience levels to include */
  experienceLevels: ExperienceLevel[];
  /** Only include jobs posted within this many days */
  postedWithinDays: number;
}

/**
 * Sort options for job search results
 */
export type JobSortBy = 'date' | 'relevance' | 'company';

/**
 * Search query for the knowledge base
 * @see Requirements 5.2 - Return jobs matching search query across title,
 * company, and description fields
 */
export interface SearchQuery {
  /** Free text search query */
  text?: string;
  /** Filters to apply */
  filters?: Partial<JobFilters>;
  /** Sort order */
  sortBy?: JobSortBy;
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Job source configuration for scraping
 */
export interface JobSourceConfig {
  /** Type of job source */
  type: JobSource;
  /** URL to scrape */
  url: string;
  /** Optional credentials for authenticated sources */
  credentials?: SourceCredentials;
}

/**
 * Credentials for authenticated job sources
 */
export interface SourceCredentials {
  /** Username or email */
  username?: string;
  /** Password or API key */
  password?: string;
  /** OAuth token */
  token?: string;
}

/**
 * Error encountered during job scraping
 */
export interface ScrapeError {
  /** Source that caused the error */
  source: JobSource;
  /** Error message */
  message: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Whether the error is recoverable */
  recoverable: boolean;
}

/**
 * Result of a job scraping operation
 * @see Requirements 4.5 - Report number of new jobs found and any errors encountered
 */
export interface ScrapeResult {
  /** Total jobs found in this scrape */
  jobsFound: number;
  /** Number of new jobs added to knowledge base */
  newJobs: number;
  /** Number of duplicates that were skipped */
  duplicatesSkipped: number;
  /** Errors encountered during scraping */
  errors: ScrapeError[];
  /** Duration of scrape in milliseconds */
  duration: number;
}

/**
 * Status of an ongoing scraping operation
 */
export interface ScrapingStatus {
  /** Whether scraping is currently in progress */
  isRunning: boolean;
  /** Current source being scraped */
  currentSource?: JobSource;
  /** Progress percentage (0-100) */
  progress: number;
  /** Jobs found so far */
  jobsFoundSoFar: number;
  /** Start time of the scrape */
  startedAt?: Date;
}

/**
 * Entry in scrape history
 */
export interface ScrapeHistoryEntry {
  /** Unique identifier */
  id: string;
  /** When the scrape occurred */
  timestamp: Date;
  /** Sources that were scraped */
  sources: JobSource[];
  /** Number of jobs found */
  jobsFound: number;
  /** Duration in milliseconds */
  duration: number;
  /** Error messages if any */
  errors: string[];
}
