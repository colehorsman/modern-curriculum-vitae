/**
 * Platform Orchestrator
 * 
 * Main entry point that wires all components together and provides
 * high-level workflow methods for the Career Showcase Platform.
 * @see Requirements: All
 */

import { GitHubConnector } from './connectors/github.js';
import { AbstractGenerator } from './generators/abstract.js';
import { LandingPageGenerator } from './generators/landing-page.js';
import { ProfileReadmeGenerator } from './generators/profile-readme.js';
import { ResumeParser } from './integrators/resume-parser.js';
import { ProfileMerger } from './integrators/profile-merger.js';
import { JobScraper } from './scrapers/job-scraper.js';
import { KnowledgeBase } from './storage/knowledge-base.js';
import { PIIScanner } from './services/pii-scanner.js';
import { WebsiteBuilder } from './builders/website-builder.js';
import { DesignSystem } from './design/design-system.js';

import type { Repository, RepositoryDetails, GitHubProfile, AuthResult } from './types/github.js';
import type { UnifiedProfile, ParsedResume, LinkedInProfile } from './types/profile.js';
import type { ProjectAbstract, LandingPage, ProfileReadme, WebsiteBuild, DesignConfig } from './types/design.js';
import type { JobListing, JobFilters, ScrapeResult, JobSourceConfig } from './types/jobs.js';
import * as fs from 'fs';

/**
 * Platform configuration options
 */
export interface PlatformConfig {
  /** GitHub OAuth token */
  githubToken?: string;
  /** Path to store knowledge base */
  knowledgeBasePath?: string;
  /** Path to store PII allowlist */
  allowlistPath?: string;
  /** Design configuration override */
  designConfig?: DesignConfig;
}

/**
 * Result of building a complete portfolio
 */
export interface PortfolioBuildResult {
  /** Generated website build */
  website: WebsiteBuild;
  /** Generated landing pages for projects */
  landingPages: LandingPage[];
  /** Generated GitHub profile README */
  profileReadme: ProfileReadme;
  /** Project abstracts */
  abstracts: ProjectAbstract[];
}

/**
 * Platform class - Main orchestrator for Career Showcase Platform
 */
export class Platform {
  private githubConnector: GitHubConnector;
  private abstractGenerator: AbstractGenerator;
  private landingPageGenerator: LandingPageGenerator;
  private profileReadmeGenerator: ProfileReadmeGenerator;
  private resumeParser: ResumeParser;
  private profileMerger: ProfileMerger;
  private jobScraper: JobScraper;
  private knowledgeBase: KnowledgeBase;
  private piiScanner: PIIScanner;
  private websiteBuilder: WebsiteBuilder;
  private designSystem: DesignSystem;

  private _config: PlatformConfig;
  private profile: UnifiedProfile | null = null;
  private repositories: Repository[] = [];
  private abstracts: Map<string, ProjectAbstract> = new Map();

  constructor(config: PlatformConfig = {}) {
    this._config = config;

    // Initialize all components
    this.githubConnector = new GitHubConnector();
    this.abstractGenerator = new AbstractGenerator();
    this.landingPageGenerator = new LandingPageGenerator();
    this.profileReadmeGenerator = new ProfileReadmeGenerator();
    this.resumeParser = new ResumeParser();
    this.profileMerger = new ProfileMerger();
    this.jobScraper = new JobScraper();
    this.knowledgeBase = new KnowledgeBase();
    this.piiScanner = new PIIScanner(config.allowlistPath);
    this.websiteBuilder = new WebsiteBuilder();
    this.designSystem = new DesignSystem(config.designConfig);
  }

  // ==================== GitHub Integration ====================

  /**
   * Connects to GitHub with the provided token
   * @see Requirements 1.1, 1.2
   */
  async connectGitHub(token: string): Promise<AuthResult> {
    this.githubConnector = new GitHubConnector();
    return this.githubConnector.authenticate(token);
  }

  /**
   * Fetches all repositories for the authenticated user
   * @see Requirements 1.2, 1.3
   */
  async fetchRepositories(): Promise<Repository[]> {
    this.repositories = await this.githubConnector.getRepositories();
    return this.repositories;
  }

  /**
   * Gets detailed information for a specific repository
   * @see Requirements 1.3, 2.1
   */
  async getRepositoryDetails(repoName: string): Promise<RepositoryDetails> {
    return this.githubConnector.getRepositoryDetails(repoName);
  }

  /**
   * Gets the authenticated user's GitHub profile
   * @see Requirements 11.2
   */
  async getGitHubProfile(): Promise<GitHubProfile> {
    return this.githubConnector.getUserProfile();
  }

  // ==================== Abstract Generation ====================

  /**
   * Generates an abstract for a repository
   * @see Requirements 2.1, 2.2, 2.3
   */
  async generateAbstract(repoName: string): Promise<ProjectAbstract> {
    const details = await this.getRepositoryDetails(repoName);
    const abstract = await this.abstractGenerator.generateAbstract(details);
    this.abstracts.set(repoName, abstract);
    return abstract;
  }

  /**
   * Generates abstracts for all fetched repositories
   * @see Requirements 2.1, 2.2
   */
  async generateAllAbstracts(): Promise<ProjectAbstract[]> {
    const abstracts: ProjectAbstract[] = [];
    for (const repo of this.repositories) {
      const abstract = await this.generateAbstract(repo.name);
      abstracts.push(abstract);
    }
    return abstracts;
  }

  /**
   * Gets all generated abstracts
   */
  getAbstracts(): ProjectAbstract[] {
    return Array.from(this.abstracts.values());
  }

  // ==================== Landing Page Generation ====================

  /**
   * Generates a landing page for a project abstract
   * @see Requirements 3.1, 3.2, 3.3
   */
  async generateLandingPage(abstract: ProjectAbstract): Promise<LandingPage> {
    const design = this.designSystem.getConfig();
    const repoUrl = abstract.isPublic ? `https://github.com/${abstract.repositoryName}` : undefined;
    return this.landingPageGenerator.generatePage(abstract, design, repoUrl);
  }

  /**
   * Generates landing pages for all abstracts
   * @see Requirements 3.1, 3.2
   */
  async generateAllLandingPages(): Promise<LandingPage[]> {
    const pages: LandingPage[] = [];
    for (const abstract of this.abstracts.values()) {
      const page = await this.generateLandingPage(abstract);
      pages.push(page);
    }
    return pages;
  }

  // ==================== Profile Integration ====================

  /**
   * Parses a resume file and extracts profile data
   * @see Requirements 7.1, 7.2
   */
  async parseResume(filePath: string): Promise<ParsedResume> {
    const buffer = await fs.promises.readFile(filePath);
    const filename = filePath.split('/').pop() || 'resume.pdf';
    const result = await this.resumeParser.parseResume(buffer, filename);
    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to parse resume');
    }
    return result.data;
  }

  /**
   * Merges resume and LinkedIn data into a unified profile
   * @see Requirements 7.4
   */
  async createUnifiedProfile(
    resume: ParsedResume,
    linkedIn?: LinkedInProfile
  ): Promise<UnifiedProfile> {
    this.profile = this.profileMerger.mergeProfiles(resume, linkedIn || null);
    return this.profile;
  }

  /**
   * Gets the current unified profile
   */
  getProfile(): UnifiedProfile | null {
    return this.profile;
  }

  /**
   * Sets the unified profile directly
   */
  setProfile(profile: UnifiedProfile): void {
    this.profile = profile;
  }

  // ==================== Job Scraping ====================

  /**
   * Scrapes jobs from configured sources
   * @see Requirements 4.1, 4.2
   */
  async scrapeJobs(sources: JobSourceConfig[], keywords: string[] = []): Promise<ScrapeResult> {
    const result = await this.jobScraper.scrape(sources, keywords);
    return result;
  }

  /**
   * Searches jobs in the knowledge base
   * @see Requirements 5.2, 5.3
   */
  async searchJobs(query: string, filters?: JobFilters): Promise<JobListing[]> {
    return this.knowledgeBase.searchJobs({ text: query, filters: filters || {} });
  }

  /**
   * Gets a specific job by ID
   * @see Requirements 5.1
   */
  async getJob(id: string): Promise<JobListing | null> {
    return this.knowledgeBase.getJob(id);
  }

  /**
   * Updates the status of a job
   * @see Requirements 5.6
   */
  async updateJobStatus(
    id: string,
    status: 'new' | 'interested' | 'applied' | 'dismissed' | 'expired'
  ): Promise<void> {
    await this.knowledgeBase.updateJobStatus(id, status);
  }

  // ==================== Website Building ====================

  /**
   * Builds the complete portfolio website
   * @see Requirements 6.1, 6.2
   */
  async buildWebsite(): Promise<WebsiteBuild> {
    if (!this.profile) {
      throw new Error('Profile not set. Please parse a resume or set a profile first.');
    }

    const abstracts = this.getAbstracts();
    const landingPages = await this.generateAllLandingPages();
    const design = this.designSystem.getConfig();

    return this.websiteBuilder.build({
      profile: this.profile,
      projects: abstracts,
      landingPages,
      design,
      sections: [
        { id: 'experience', title: 'Experience', type: 'experience', visible: true, order: 1 },
        { id: 'projects', title: 'Projects', type: 'projects', visible: true, order: 2 },
        { id: 'skills', title: 'Skills', type: 'skills', visible: true, order: 3 },
        { id: 'education', title: 'Education', type: 'education', visible: true, order: 4 },
        { id: 'volunteer', title: 'Volunteer Work', type: 'volunteer', visible: true, order: 5 },
        { id: 'contact', title: 'Contact', type: 'contact', visible: true, order: 6 },
      ],
      seo: {
        siteTitle: `${this.profile.name} - Portfolio`,
        siteDescription: this.profile.headline,
        keywords: this.profile.skills.map(s => s.name),
        author: this.profile.name,
      },
    });
  }

  // ==================== GitHub Profile README ====================

  /**
   * Generates a GitHub profile README
   * @see Requirements 11.1, 11.2, 11.3, 11.4, 11.5
   */
  generateProfileReadme(): ProfileReadme {
    if (!this.profile) {
      throw new Error('Profile not set. Please parse a resume or set a profile first.');
    }

    const abstracts = this.getAbstracts();
    return this.profileReadmeGenerator.generate(this.profile, abstracts);
  }

  // ==================== PII Management ====================

  /**
   * Scans content for PII
   * @see Requirements 8.1
   */
  async scanForPII(content: string) {
    return this.piiScanner.scan(content);
  }

  /**
   * Adds a value to the PII allowlist
   * @see Requirements 8.3
   */
  addToAllowlist(value: string, reason?: string): void {
    this.piiScanner.addToAllowlist(value, undefined, reason);
  }

  /**
   * Gets the PII allowlist
   * @see Requirements 8.3
   */
  getAllowlist(): string[] {
    return this.piiScanner.getAllowlist();
  }

  /**
   * Saves the PII allowlist to disk
   * @see Requirements 8.3
   */
  async saveAllowlist(): Promise<void> {
    await this.piiScanner.saveAllowlist();
  }

  /**
   * Loads the PII allowlist from disk
   * @see Requirements 8.3
   */
  async loadAllowlist(): Promise<boolean> {
    return this.piiScanner.loadAllowlist();
  }

  // ==================== Full Workflow ====================

  /**
   * Builds a complete portfolio from GitHub and resume
   * This is the main high-level workflow method.
   * @see Requirements: All
   */
  async buildPortfolio(options: {
    githubToken: string;
    resumePath: string;
    linkedInProfile?: LinkedInProfile;
  }): Promise<PortfolioBuildResult> {
    // 1. Connect to GitHub
    await this.connectGitHub(options.githubToken);

    // 2. Fetch repositories
    await this.fetchRepositories();

    // 3. Generate abstracts for all repos
    await this.generateAllAbstracts();

    // 4. Parse resume
    const resume = await this.parseResume(options.resumePath);

    // 5. Create unified profile
    await this.createUnifiedProfile(resume, options.linkedInProfile);

    // 6. Generate landing pages
    const landingPages = await this.generateAllLandingPages();

    // 7. Build website
    const website = await this.buildWebsite();

    // 8. Generate profile README
    const profileReadme = this.generateProfileReadme();

    return {
      website,
      landingPages,
      profileReadme,
      abstracts: this.getAbstracts(),
    };
  }

  // ==================== Utility Methods ====================

  /**
   * Gets the platform configuration
   */
  getConfig(): PlatformConfig {
    return this._config;
  }

  /**
   * Gets the design system instance
   */
  getDesignSystem(): DesignSystem {
    return this.designSystem;
  }

  /**
   * Gets the knowledge base instance
   */
  getKnowledgeBase(): KnowledgeBase {
    return this.knowledgeBase;
  }

  /**
   * Initializes the knowledge base (creates tables if needed)
   */
  async initializeKnowledgeBase(): Promise<void> {
    // Knowledge base is in-memory, no initialization needed
  }

  /**
   * Closes all resources (database connections, etc.)
   */
  async close(): Promise<void> {
    // Clear in-memory data
    await this.knowledgeBase.clear();
  }
}

// Export a factory function for convenience
export function createPlatform(config?: PlatformConfig): Platform {
  return new Platform(config);
}
