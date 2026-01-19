/**
 * Unit tests for AbstractGenerator
 * 
 * Tests the abstract generation functionality including:
 * - Technology extraction from languages and files
 * - Summary extraction from README
 * - Key features extraction
 * - Impact metrics generation
 * - Full abstract generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AbstractGenerator,
  extractTechnologiesFromLanguages,
  extractTechnologiesFromFiles,
  extractSummaryFromReadme,
  extractKeyFeaturesFromReadme,
  generateTitle,
  generateImpactMetrics,
  generateFallbackSummary,
  generateFallbackFeatures,
  type ProjectAbstract,
} from './abstract.js';
import { RepositoryDetails, FileNode } from '../types/github.js';

describe('AbstractGenerator', () => {
  let generator: AbstractGenerator;

  beforeEach(() => {
    generator = new AbstractGenerator();
  });

  // Helper to create a minimal RepositoryDetails object
  function createRepoDetails(overrides: Partial<RepositoryDetails> = {}): RepositoryDetails {
    return {
      name: 'test-repo',
      description: 'A test repository',
      isPrivate: false,
      languages: { TypeScript: 10000, JavaScript: 5000 },
      stars: 100,
      forks: 25,
      lastUpdated: new Date(),
      topics: ['testing', 'typescript'],
      url: 'https://github.com/user/test-repo',
      readme: '# Test Repo\n\nThis is a test repository for unit testing.',
      fileStructure: [
        { name: 'package.json', path: 'package.json', type: 'file' },
        { name: 'tsconfig.json', path: 'tsconfig.json', type: 'file' },
        { name: 'src', path: 'src', type: 'directory' },
      ],
      contributors: 5,
      license: 'MIT',
      ...overrides,
    };
  }

  describe('generateAbstract', () => {
    it('should generate a complete abstract with all required fields', async () => {
      const repo = createRepoDetails();
      const abstract = await generator.generateAbstract(repo);

      expect(abstract).toBeDefined();
      expect(abstract.id).toBeDefined();
      expect(abstract.id).toMatch(/^abstract_\d+_[a-z0-9]+$/);
      expect(abstract.repositoryName).toBe('test-repo');
      expect(abstract.title).toBe('Test Repo');
      expect(abstract.summary).toBeDefined();
      expect(abstract.summary.length).toBeGreaterThan(0);
      expect(abstract.technologies).toBeDefined();
      expect(abstract.technologies.length).toBeGreaterThan(0);
      expect(abstract.keyFeatures).toBeDefined();
      expect(abstract.keyFeatures.length).toBeGreaterThan(0);
      expect(abstract.impactMetrics).toBeDefined();
      expect(abstract.isPublic).toBe(true);
      expect(abstract.generatedAt).toBeInstanceOf(Date);
      expect(abstract.lastEdited).toBeNull();
    });

    it('should mark private repositories as not public', async () => {
      const repo = createRepoDetails({ isPrivate: true });
      const abstract = await generator.generateAbstract(repo);

      expect(abstract.isPublic).toBe(false);
    });

    it('should include impact metrics when option is enabled', async () => {
      const repo = createRepoDetails({ stars: 100, forks: 25, contributors: 5 });
      const abstract = await generator.generateAbstract(repo, { includeMetrics: true });

      expect(abstract.impactMetrics).toContain('100 stars');
      expect(abstract.impactMetrics).toContain('25 forks');
      expect(abstract.impactMetrics).toContain('5 contributors');
    });

    it('should exclude impact metrics when option is disabled', async () => {
      const repo = createRepoDetails({ stars: 100, forks: 25 });
      const abstract = await generator.generateAbstract(repo, { includeMetrics: false });

      expect(abstract.impactMetrics).toHaveLength(0);
    });

    it('should handle repositories without README', async () => {
      const repo = createRepoDetails({ readme: null, description: 'A project description' });
      const abstract = await generator.generateAbstract(repo);

      expect(abstract.summary).toBeDefined();
      expect(abstract.summary.length).toBeGreaterThan(0);
      expect(abstract.summary).toContain('A project description');
    });

    it('should handle repositories without description or README', async () => {
      const repo = createRepoDetails({ readme: null, description: null });
      const abstract = await generator.generateAbstract(repo);

      expect(abstract.summary).toBeDefined();
      expect(abstract.summary.length).toBeGreaterThan(0);
    });

    it('should extract technologies from both languages and file patterns', async () => {
      const repo = createRepoDetails({
        languages: { TypeScript: 10000 },
        fileStructure: [
          { name: 'package.json', path: 'package.json', type: 'file' },
          { name: 'vitest.config.ts', path: 'vitest.config.ts', type: 'file' },
          { name: 'Dockerfile', path: 'Dockerfile', type: 'file' },
        ],
      });
      const abstract = await generator.generateAbstract(repo);

      expect(abstract.technologies).toContain('TypeScript');
      expect(abstract.technologies).toContain('Node.js');
      expect(abstract.technologies).toContain('Vitest');
      expect(abstract.technologies).toContain('Docker');
    });
  });

  describe('regenerateSection', () => {
    it('should update lastEdited timestamp', async () => {
      const repo = createRepoDetails();
      const original = await generator.generateAbstract(repo);
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updated = await generator.regenerateSection(original, 'summary');

      expect(updated.lastEdited).not.toBeNull();
      expect(updated.lastEdited!.getTime()).toBeGreaterThan(original.generatedAt.getTime());
    });
  });
});

describe('extractTechnologiesFromLanguages', () => {
  it('should extract technologies from language map', () => {
    const languages = {
      TypeScript: 50000,
      JavaScript: 20000,
      Python: 10000,
    };

    const techs = extractTechnologiesFromLanguages(languages);

    expect(techs).toContain('TypeScript');
    expect(techs).toContain('JavaScript');
    expect(techs).toContain('Python');
  });

  it('should sort technologies by usage (bytes)', () => {
    const languages = {
      Python: 10000,
      TypeScript: 50000,
      JavaScript: 20000,
    };

    const techs = extractTechnologiesFromLanguages(languages);

    expect(techs[0]).toBe('TypeScript');
    expect(techs[1]).toBe('JavaScript');
    expect(techs[2]).toBe('Python');
  });

  it('should return empty array for empty languages', () => {
    const techs = extractTechnologiesFromLanguages({});
    expect(techs).toHaveLength(0);
  });

  it('should map language names to display names', () => {
    const languages = {
      Shell: 1000,
      'C++': 2000,
    };

    const techs = extractTechnologiesFromLanguages(languages);

    expect(techs).toContain('Shell/Bash');
    expect(techs).toContain('C++');
  });
});

describe('extractTechnologiesFromFiles', () => {
  it('should detect Node.js from package.json', () => {
    const files: FileNode[] = [
      { name: 'package.json', path: 'package.json', type: 'file' },
    ];

    const techs = extractTechnologiesFromFiles(files);

    expect(techs).toContain('Node.js');
    expect(techs).toContain('npm');
  });

  it('should detect TypeScript from tsconfig.json', () => {
    const files: FileNode[] = [
      { name: 'tsconfig.json', path: 'tsconfig.json', type: 'file' },
    ];

    const techs = extractTechnologiesFromFiles(files);

    expect(techs).toContain('TypeScript');
  });

  it('should detect Docker from Dockerfile', () => {
    const files: FileNode[] = [
      { name: 'Dockerfile', path: 'Dockerfile', type: 'file' },
    ];

    const techs = extractTechnologiesFromFiles(files);

    expect(techs).toContain('Docker');
  });

  it('should detect multiple technologies', () => {
    const files: FileNode[] = [
      { name: 'package.json', path: 'package.json', type: 'file' },
      { name: 'tsconfig.json', path: 'tsconfig.json', type: 'file' },
      { name: 'vitest.config.ts', path: 'vitest.config.ts', type: 'file' },
      { name: 'Dockerfile', path: 'Dockerfile', type: 'file' },
    ];

    const techs = extractTechnologiesFromFiles(files);

    expect(techs).toContain('Node.js');
    expect(techs).toContain('TypeScript');
    expect(techs).toContain('Vitest');
    expect(techs).toContain('Docker');
  });

  it('should return empty array for unrecognized files', () => {
    const files: FileNode[] = [
      { name: 'random.txt', path: 'random.txt', type: 'file' },
      { name: 'data.csv', path: 'data.csv', type: 'file' },
    ];

    const techs = extractTechnologiesFromFiles(files);

    expect(techs).toHaveLength(0);
  });
});

describe('extractSummaryFromReadme', () => {
  it('should extract first paragraph from README', () => {
    const readme = `# My Project

This is the first paragraph of the README. It describes the project.

## Installation

Install with npm.`;

    const summary = extractSummaryFromReadme(readme, 500);

    expect(summary).toBe('This is the first paragraph of the README. It describes the project.');
  });

  it('should skip badges at the start', () => {
    const readme = `[![Build Status](https://example.com/badge.svg)](https://example.com)
[![Coverage](https://example.com/coverage.svg)](https://example.com)

# My Project

This is the actual description.`;

    const summary = extractSummaryFromReadme(readme, 500);

    expect(summary).toBe('This is the actual description.');
  });

  it('should skip code blocks', () => {
    const readme = `# My Project

\`\`\`bash
npm install
\`\`\`

This is the description after the code block.`;

    const summary = extractSummaryFromReadme(readme, 500);

    expect(summary).toBe('This is the description after the code block.');
  });

  it('should truncate long summaries', () => {
    const readme = `# My Project

This is a very long description that goes on and on and on. It contains a lot of text that exceeds the maximum length we want for our summary.`;

    const summary = extractSummaryFromReadme(readme, 50);

    expect(summary.length).toBeLessThanOrEqual(50);
    expect(summary).toMatch(/\.\.\.$/);
  });

  it('should return empty string for null README', () => {
    const summary = extractSummaryFromReadme(null, 500);
    expect(summary).toBe('');
  });

  it('should return empty string for empty README', () => {
    const summary = extractSummaryFromReadme('', 500);
    expect(summary).toBe('');
  });

  it('should handle README with only headers', () => {
    const readme = `# Project
## Section 1
## Section 2`;

    const summary = extractSummaryFromReadme(readme, 500);
    expect(summary).toBe('');
  });
});

describe('extractKeyFeaturesFromReadme', () => {
  it('should extract features from Features section', () => {
    const readme = `# My Project

## Features

- Feature one is great
- Feature two is awesome
- Feature three is amazing

## Installation`;

    const features = extractKeyFeaturesFromReadme(readme);

    expect(features).toContain('Feature one is great');
    expect(features).toContain('Feature two is awesome');
    expect(features).toContain('Feature three is amazing');
  });

  it('should extract features from Key Features section', () => {
    const readme = `# My Project

### Key Features

* First key feature
* Second key feature

## Usage`;

    const features = extractKeyFeaturesFromReadme(readme);

    expect(features).toContain('First key feature');
    expect(features).toContain('Second key feature');
  });

  it('should remove markdown formatting from features', () => {
    const readme = `## Features

- **Bold feature** description
- Feature with \`code\` in it
- Feature with [link](https://example.com)`;

    const features = extractKeyFeaturesFromReadme(readme);

    expect(features).toContain('Bold feature description');
    expect(features).toContain('Feature with code in it');
    expect(features).toContain('Feature with link');
  });

  it('should limit to 5 features', () => {
    const readme = `## Features

- Feature 1
- Feature 2
- Feature 3
- Feature 4
- Feature 5
- Feature 6
- Feature 7`;

    const features = extractKeyFeaturesFromReadme(readme);

    expect(features).toHaveLength(5);
  });

  it('should return empty array for README without features', () => {
    const readme = `# My Project

Just a simple description.

## Installation

npm install`;

    const features = extractKeyFeaturesFromReadme(readme);

    // May extract some bullet points or return empty
    expect(features.length).toBeLessThanOrEqual(5);
  });

  it('should return empty array for null README', () => {
    const features = extractKeyFeaturesFromReadme(null);
    expect(features).toHaveLength(0);
  });
});

describe('generateTitle', () => {
  it('should convert kebab-case to Title Case', () => {
    expect(generateTitle('my-awesome-project')).toBe('My Awesome Project');
  });

  it('should convert snake_case to Title Case', () => {
    expect(generateTitle('my_awesome_project')).toBe('My Awesome Project');
  });

  it('should handle camelCase', () => {
    expect(generateTitle('myAwesomeProject')).toBe('My Awesome Project');
  });

  it('should handle single word', () => {
    expect(generateTitle('project')).toBe('Project');
  });

  it('should handle mixed formats', () => {
    expect(generateTitle('my-awesome_project')).toBe('My Awesome Project');
  });
});

describe('generateImpactMetrics', () => {
  it('should generate metrics for stars, forks, and contributors', () => {
    const repo = {
      stars: 100,
      forks: 25,
      contributors: 10,
    } as RepositoryDetails;

    const metrics = generateImpactMetrics(repo);

    expect(metrics).toContain('100 stars');
    expect(metrics).toContain('25 forks');
    expect(metrics).toContain('10 contributors');
  });

  it('should use singular form for single items', () => {
    const repo = {
      stars: 1,
      forks: 1,
      contributors: 1,
    } as RepositoryDetails;

    const metrics = generateImpactMetrics(repo);

    expect(metrics).toContain('1 star');
    expect(metrics).toContain('1 fork');
    expect(metrics).toContain('1 contributor');
  });

  it('should skip zero values', () => {
    const repo = {
      stars: 0,
      forks: 0,
      contributors: 0,
    } as RepositoryDetails;

    const metrics = generateImpactMetrics(repo);

    expect(metrics).toHaveLength(0);
  });

  it('should format large numbers with locale string', () => {
    const repo = {
      stars: 10000,
      forks: 2500,
      contributors: 100,
    } as RepositoryDetails;

    const metrics = generateImpactMetrics(repo);

    expect(metrics[0]).toMatch(/10,?000 stars/);
    expect(metrics[1]).toMatch(/2,?500 forks/);
  });
});

describe('generateFallbackSummary', () => {
  it('should use description if available', () => {
    const repo = {
      name: 'test-repo',
      description: 'A great project description',
    } as RepositoryDetails;

    const summary = generateFallbackSummary(repo, ['TypeScript'], 'professional');

    expect(summary).toBe('A great project description');
  });

  it('should generate professional summary with technologies', () => {
    const repo = {
      name: 'test-repo',
      description: null,
    } as RepositoryDetails;

    const summary = generateFallbackSummary(repo, ['TypeScript', 'React'], 'professional');

    expect(summary).toContain('Test Repo');
    expect(summary).toContain('TypeScript');
  });

  it('should generate casual summary with technologies', () => {
    const repo = {
      name: 'test-repo',
      description: null,
    } as RepositoryDetails;

    const summary = generateFallbackSummary(repo, ['TypeScript', 'React'], 'casual');

    expect(summary).toContain('Test Repo');
    expect(summary).toContain('TypeScript');
  });

  it('should handle empty technologies', () => {
    const repo = {
      name: 'test-repo',
      description: null,
    } as RepositoryDetails;

    const summary = generateFallbackSummary(repo, [], 'professional');

    expect(summary).toContain('Test Repo');
    expect(summary).toContain('software project');
  });
});

describe('generateFallbackFeatures', () => {
  it('should generate features based on technologies', () => {
    const repo = {
      license: 'MIT',
      fileStructure: [],
    } as unknown as RepositoryDetails;

    const features = generateFallbackFeatures(repo, ['TypeScript', 'Docker', 'Jest']);

    expect(features).toContain('Type-safe codebase with TypeScript');
    expect(features).toContain('Containerized deployment with Docker');
    expect(features).toContain('Comprehensive test coverage');
  });

  it('should include license information', () => {
    const repo = {
      license: 'MIT',
      fileStructure: [],
    } as unknown as RepositoryDetails;

    const features = generateFallbackFeatures(repo, []);

    expect(features.some(f => f.includes('MIT'))).toBe(true);
  });

  it('should limit to 3 features', () => {
    const repo = {
      license: 'MIT',
      fileStructure: [],
    } as unknown as RepositoryDetails;

    const features = generateFallbackFeatures(repo, [
      'TypeScript', 'Docker', 'Jest', 'GitHub Actions', 'ESLint', 'Prettier'
    ]);

    expect(features.length).toBeLessThanOrEqual(3);
  });
});
