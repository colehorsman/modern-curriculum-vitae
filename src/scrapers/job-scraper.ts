/**
 * Job Scraper
 * 
 * Scrapes job listings from multiple sources.
 * @see Requirements 4.1-4.5 - Job Scraping
 */

import type { 
  JobListing, JobSource, JobType, ExperienceLevel, 
  ScrapeResult, ScrapeError, ScrapingStatus, JobSourceConfig 
} from '../types/jobs.js';

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Calculates exponential backoff delay
 */
function calculateBackoff(attempt: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 30000);
}

/**
 * Delays execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * JobScraper class for aggregating job listings
 */
export class JobScraper {
  private isRunning = false;
  private currentSource: JobSource | undefined;
  private jobsFoundSoFar = 0;
  private startedAt: Date | undefined;
  private baseDelay: number;
  private maxRetries: number;

  constructor(options: { baseDelay?: number; maxRetries?: number } = {}) {
    this.baseDelay = options.baseDelay ?? 1000;
    this.maxRetries = options.maxRetries ?? 5;
  }

  /**
   * Scrapes jobs from configured sources
   * @see Requirements 4.1, 4.2
   */
  async scrape(
    sources: JobSourceConfig[],
    keywords: string[] = []
  ): Promise<ScrapeResult> {
    this.isRunning = true;
    this.startedAt = new Date();
    this.jobsFoundSoFar = 0;
    
    const startTime = Date.now();
    const jobs: JobListing[] = [];
    const errors: ScrapeError[] = [];

    for (const source of sources) {
      this.currentSource = source.type;
      
      try {
        const sourceJobs = await this.scrapeSource(source, keywords);
        jobs.push(...sourceJobs);
        this.jobsFoundSoFar += sourceJobs.length;
      } catch (error) {
        errors.push({
          source: source.type,
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
        });
      }
    }

    this.isRunning = false;
    this.currentSource = undefined;

    return {
      jobsFound: jobs.length,
      newJobs: jobs.length, // Deduplication happens in KnowledgeBase
      duplicatesSkipped: 0,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Scrapes a single source with retry logic
   * @see Requirements 4.4 - Exponential backoff
   */
  private async scrapeSource(
    source: JobSourceConfig,
    keywords: string[]
  ): Promise<JobListing[]> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // In a real implementation, this would fetch and parse HTML
        // For now, return mock data structure
        return this.mockScrape(source, keywords);
      } catch (error) {
        if (this.isRateLimited(error)) {
          const backoffDelay = calculateBackoff(attempt, this.baseDelay);
          await delay(backoffDelay);
          continue;
        }
        throw error;
      }
    }
    
    throw new Error(`Failed to scrape ${source.type} after ${this.maxRetries} attempts`);
  }

  /**
   * Mock scrape implementation - replace with real scraping logic
   */
  private mockScrape(source: JobSourceConfig, keywords: string[]): JobListing[] {
    // This would be replaced with actual scraping logic using cheerio
    return [];
  }

  /**
   * Checks if error is a rate limit response
   */
  private isRateLimited(error: unknown): boolean {
    if (error instanceof Error) {
      return error.message.includes('429') || 
             error.message.toLowerCase().includes('rate limit');
    }
    return false;
  }

  /**
   * Gets current scraping status
   */
  getScrapingStatus(): ScrapingStatus {
    return {
      isRunning: this.isRunning,
      currentSource: this.currentSource,
      progress: 0,
      jobsFoundSoFar: this.jobsFoundSoFar,
      startedAt: this.startedAt,
    };
  }

  /**
   * Cancels ongoing scrape
   */
  cancelScrape(): void {
    this.isRunning = false;
  }

  /**
   * Parses a job listing from HTML (to be implemented per source)
   */
  parseJobListing(html: string, source: JobSource): Partial<JobListing> {
    // Would use cheerio to parse HTML
    return {
      source,
      scrapedDate: new Date(),
      status: 'new',
      tags: [],
    };
  }
}

export const jobScraper = new JobScraper();
