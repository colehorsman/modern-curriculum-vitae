/**
 * SerpAPI Connector
 * 
 * Real implementation for Google search results via SerpAPI.
 * Used for job searching, profile enrichment, and company research.
 */

export interface SerpAPIConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
  source?: string;
  date?: string;
}

export interface JobResult {
  title: string;
  company: string;
  location: string;
  description: string;
  link: string;
  posted?: string;
  salary?: string;
  jobType?: string;
  source: string;
}

export interface ProfileMention {
  title: string;
  link: string;
  snippet: string;
  source: string;
  date?: string;
  type: 'article' | 'talk' | 'interview' | 'social' | 'other';
}

export interface SerpAPIResponse {
  search_metadata: {
    id: string;
    status: string;
    total_time_taken: number;
  };
  search_parameters: Record<string, string>;
  organic_results?: Array<{
    position: number;
    title: string;
    link: string;
    snippet?: string;
    date?: string;
    source?: string;
  }>;
  jobs_results?: Array<{
    title: string;
    company_name: string;
    location: string;
    description?: string;
    detected_extensions?: {
      posted_at?: string;
      salary?: string;
      schedule_type?: string;
    };
    job_id?: string;
    share_link?: string;
  }>;
  knowledge_graph?: {
    title?: string;
    description?: string;
    source?: { link?: string };
  };
  error?: string;
}

export class SerpAPIConnector {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: SerpAPIConfig) {
    if (!config.apiKey) {
      throw new Error('SerpAPI key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://serpapi.com/search.json';
  }

  /**
   * Performs a Google search
   */
  async search(query: string, options: { num?: number; location?: string } = {}): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      engine: 'google',
      q: query,
      num: String(options.num ?? 10),
    });

    if (options.location) {
      params.set('location', options.location);
    }

    const response = await fetch(`${this.baseUrl}?${params}`);
    
    if (!response.ok) {
      throw new Error(`SerpAPI request failed: ${response.status} ${response.statusText}`);
    }

    const data: SerpAPIResponse = await response.json();

    if (data.error) {
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    return (data.organic_results ?? []).map(result => ({
      title: result.title,
      link: result.link,
      snippet: result.snippet ?? '',
      position: result.position,
      source: result.source,
      date: result.date,
    }));
  }

  /**
   * Searches for jobs using Google Jobs
   */
  async searchJobs(query: string, options: { location?: string; num?: number } = {}): Promise<JobResult[]> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      engine: 'google_jobs',
      q: query,
    });

    if (options.location) {
      params.set('location', options.location);
    }

    const response = await fetch(`${this.baseUrl}?${params}`);
    
    if (!response.ok) {
      throw new Error(`SerpAPI request failed: ${response.status} ${response.statusText}`);
    }

    const data: SerpAPIResponse = await response.json();

    if (data.error) {
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    return (data.jobs_results ?? []).map(job => ({
      title: job.title,
      company: job.company_name,
      location: job.location,
      description: job.description ?? '',
      link: job.share_link ?? '',
      posted: job.detected_extensions?.posted_at,
      salary: job.detected_extensions?.salary,
      jobType: job.detected_extensions?.schedule_type,
      source: 'google_jobs',
    }));
  }

  /**
   * Searches for mentions of a person (articles, talks, interviews)
   */
  async searchProfileMentions(name: string, context?: string): Promise<ProfileMention[]> {
    const query = context ? `"${name}" ${context}` : `"${name}"`;
    const results = await this.search(query, { num: 20 });

    return results.map(result => ({
      title: result.title,
      link: result.link,
      snippet: result.snippet,
      source: new URL(result.link).hostname,
      date: result.date,
      type: this.classifyMention(result),
    }));
  }

  /**
   * Searches LinkedIn for a person's profile info
   */
  async searchLinkedIn(name: string, company?: string): Promise<SearchResult[]> {
    const query = company 
      ? `site:linkedin.com/in "${name}" "${company}"`
      : `site:linkedin.com/in "${name}"`;
    
    return this.search(query, { num: 5 });
  }

  /**
   * Searches for company information
   */
  async searchCompany(companyName: string): Promise<SearchResult[]> {
    return this.search(`"${companyName}" company about`, { num: 10 });
  }

  /**
   * Classifies a search result as article, talk, interview, etc.
   */
  private classifyMention(result: SearchResult): ProfileMention['type'] {
    const text = `${result.title} ${result.snippet}`.toLowerCase();
    const url = result.link.toLowerCase();

    if (url.includes('youtube.com') || url.includes('vimeo.com') || 
        text.includes('talk') || text.includes('presentation') || text.includes('keynote')) {
      return 'talk';
    }
    if (text.includes('interview') || text.includes('q&a') || text.includes('spoke with')) {
      return 'interview';
    }
    if (url.includes('twitter.com') || url.includes('linkedin.com') || 
        url.includes('x.com') || url.includes('facebook.com')) {
      return 'social';
    }
    if (url.includes('medium.com') || url.includes('blog') || 
        text.includes('article') || text.includes('wrote')) {
      return 'article';
    }
    return 'other';
  }
}
