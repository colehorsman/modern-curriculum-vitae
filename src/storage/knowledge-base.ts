/**
 * Knowledge Base
 * 
 * Local storage for job listings with search and filtering.
 * @see Requirements 5.1-5.6 - Job Knowledge Base Management
 */

import type { 
  JobListing, JobStatus, SearchQuery, JobFilters 
} from '../types/jobs.js';

/**
 * In-memory knowledge base (can be replaced with SQLite)
 */
export class KnowledgeBase {
  private jobs: Map<string, JobListing> = new Map();

  /**
   * Adds jobs with deduplication
   * @see Requirements 4.3, 5.1
   */
  async addJobs(jobs: JobListing[]): Promise<{ added: number; duplicates: number }> {
    let added = 0;
    let duplicates = 0;

    for (const job of jobs) {
      const key = this.getDeduplicationKey(job);
      if (!this.jobs.has(key)) {
        this.jobs.set(job.id, job);
        added++;
      } else {
        duplicates++;
      }
    }

    return { added, duplicates };
  }

  /**
   * Gets a job by ID
   */
  async getJob(id: string): Promise<JobListing | null> {
    return this.jobs.get(id) ?? null;
  }

  /**
   * Searches jobs
   * @see Requirements 5.2, 5.3, 5.4
   */
  async searchJobs(query: SearchQuery): Promise<JobListing[]> {
    let results = Array.from(this.jobs.values());

    // Text search
    if (query.text) {
      const searchText = query.text.toLowerCase();
      results = results.filter(job =>
        job.title.toLowerCase().includes(searchText) ||
        job.company.toLowerCase().includes(searchText) ||
        job.description.toLowerCase().includes(searchText)
      );
    }

    // Apply filters
    if (query.filters) {
      results = this.applyFilters(results, query.filters);
    }

    // Sort
    if (query.sortBy === 'date') {
      results.sort((a, b) => b.postedDate.getTime() - a.postedDate.getTime());
    } else if (query.sortBy === 'company') {
      results.sort((a, b) => a.company.localeCompare(b.company));
    }

    // Pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    return results.slice(offset, offset + limit);
  }

  /**
   * Updates job status
   * @see Requirements 5.6
   */
  async updateJobStatus(id: string, status: JobStatus): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      job.status = status;
      this.jobs.set(id, job);
    }
  }

  /**
   * Gets expired jobs (older than 30 days)
   * @see Requirements 5.5
   */
  async getExpiredJobs(): Promise<JobListing[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return Array.from(this.jobs.values()).filter(
      job => job.postedDate < thirtyDaysAgo
    );
  }

  /**
   * Marks expired jobs
   */
  async markExpiredJobs(): Promise<number> {
    const expired = await this.getExpiredJobs();
    for (const job of expired) {
      if (job.status !== 'expired') {
        job.status = 'expired';
        this.jobs.set(job.id, job);
      }
    }
    return expired.length;
  }

  /**
   * Deletes jobs by IDs
   */
  async deleteJobs(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.jobs.delete(id);
    }
  }

  /**
   * Gets total job count
   */
  async getJobCount(): Promise<number> {
    return this.jobs.size;
  }

  /**
   * Clears all jobs
   */
  async clear(): Promise<void> {
    this.jobs.clear();
  }

  private getDeduplicationKey(job: JobListing): string {
    return `${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
  }

  private applyFilters(jobs: JobListing[], filters: Partial<JobFilters>): JobListing[] {
    let results = jobs;

    if (filters.locations?.length) {
      const locs = filters.locations.map(l => l.toLowerCase());
      results = results.filter(j => 
        locs.some(loc => j.location.toLowerCase().includes(loc))
      );
    }

    if (filters.jobTypes?.length) {
      results = results.filter(j => filters.jobTypes!.includes(j.jobType));
    }

    if (filters.experienceLevels?.length) {
      results = results.filter(j => filters.experienceLevels!.includes(j.experienceLevel));
    }

    if (filters.keywords?.length) {
      results = results.filter(j =>
        filters.keywords!.some(kw => 
          j.title.toLowerCase().includes(kw.toLowerCase()) ||
          j.description.toLowerCase().includes(kw.toLowerCase()) ||
          j.tags.some(t => t.toLowerCase().includes(kw.toLowerCase()))
        )
      );
    }

    if (filters.postedWithinDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - filters.postedWithinDays);
      results = results.filter(j => j.postedDate >= cutoff);
    }

    return results;
  }
}

export const knowledgeBase = new KnowledgeBase();
