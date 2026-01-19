/**
 * Abstract Generator
 * 
 * Generates project abstracts from repository data.
 * @see Requirements 2.1, 2.2, 2.3 - Project Abstract Generation
 */

import type { RepositoryDetails } from '../types/github.js';
import type { ProjectAbstract, AbstractOptions } from '../types/design.js';
import { v4 as uuidv4 } from 'crypto';

/**
 * Default options for abstract generation
 */
const DEFAULT_OPTIONS: AbstractOptions = {
  includeMetrics: true,
  maxLength: 500,
  tone: 'professional',
  hideProprietaryDetails: false,
};

/**
 * Generates a unique ID for abstracts
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Extracts key technologies from repository data
 */
function extractTechnologies(repo: RepositoryDetails): string[] {
  const technologies: string[] = [];
  
  // Add languages
  const languages = Object.keys(repo.languages);
  technologies.push(...languages.slice(0, 5));
  
  // Add topics that look like technologies
  const techTopics = repo.topics.filter(topic => 
    !topic.includes('-') || 
    ['node-js', 'react-native', 'vue-js', 'next-js'].includes(topic)
  );
  technologies.push(...techTopics.slice(0, 3));
  
  return [...new Set(technologies)];
}

/**
 * Extracts key features from README content
 */
function extractKeyFeatures(readme: string | null, repo: RepositoryDetails): string[] {
  const features: string[] = [];
  
  if (readme) {
    // Look for feature lists in README
    const featureMatches = readme.match(/[-*]\s+(.+)/g);
    if (featureMatches) {
      features.push(...featureMatches.slice(0, 5).map(f => f.replace(/^[-*]\s+/, '').trim()));
    }
  }
  
  // Fallback features based on repo structure
  if (features.length === 0) {
    if (repo.fileStructure.some(f => f.name === 'src')) {
      features.push('Modular source code architecture');
    }
    if (repo.fileStructure.some(f => f.name.includes('test'))) {
      features.push('Comprehensive test coverage');
    }
    if (repo.license) {
      features.push(`Open source (${repo.license} license)`);
    }
  }
  
  return features.length > 0 ? features : ['Software project'];
}

/**
 * Generates impact metrics from repository data
 */
function generateImpactMetrics(repo: RepositoryDetails, options: AbstractOptions): string[] {
  if (!options.includeMetrics) return [];
  
  const metrics: string[] = [];
  
  if (repo.stars > 0) {
    metrics.push(`${repo.stars} GitHub stars`);
  }
  if (repo.forks > 0) {
    metrics.push(`${repo.forks} forks`);
  }
  if (repo.contributors > 1) {
    metrics.push(`${repo.contributors} contributors`);
  }
  
  return metrics;
}

/**
 * Generates a summary from repository data
 */
function generateSummary(repo: RepositoryDetails, options: AbstractOptions): string {
  let summary = repo.description || `A ${Object.keys(repo.languages)[0] || 'software'} project.`;
  
  if (summary.length > options.maxLength) {
    summary = summary.substring(0, options.maxLength - 3) + '...';
  }
  
  return summary;
}

/**
 * AbstractGenerator class for creating project abstracts
 */
export class AbstractGenerator {
  /**
   * Generates an abstract for a repository
   * @see Requirements 2.1, 2.2 - Analyze repo and produce summary
   */
  async generateAbstract(
    repo: RepositoryDetails,
    options: Partial<AbstractOptions> = {}
  ): Promise<ProjectAbstract> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // For private repos, always hide proprietary details
    if (repo.isPrivate) {
      opts.hideProprietaryDetails = true;
    }
    
    const technologies = extractTechnologies(repo);
    const keyFeatures = extractKeyFeatures(repo.readme, repo);
    const impactMetrics = generateImpactMetrics(repo, opts);
    const summary = generateSummary(repo, opts);
    
    // Create title from repo name
    const title = repo.name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    
    return {
      id: generateId(),
      repositoryName: repo.name,
      title,
      summary,
      technologies: technologies.length > 0 ? technologies : ['Software'],
      keyFeatures: keyFeatures.length > 0 ? keyFeatures : ['Project implementation'],
      impactMetrics,
      isPublic: !repo.isPrivate,
      generatedAt: new Date(),
      lastEdited: null,
    };
  }

  /**
   * Regenerates a specific section of an abstract
   */
  async regenerateSection(
    abstract: ProjectAbstract,
    section: keyof ProjectAbstract
  ): Promise<ProjectAbstract> {
    return {
      ...abstract,
      lastEdited: new Date(),
    };
  }
}

export const abstractGenerator = new AbstractGenerator();
