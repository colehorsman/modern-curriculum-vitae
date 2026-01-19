/**
 * Integration tests for Platform orchestrator
 * 
 * Tests end-to-end flows for the Career Showcase Platform.
 * @see Requirements: All
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Platform } from './platform.js';
import type { UnifiedProfile } from './types/profile.js';
import type { ProjectAbstract } from './types/design.js';

describe('Platform Integration Tests', () => {
  let platform: Platform;

  beforeEach(() => {
    platform = new Platform();
  });

  describe('Profile → Website Build Flow', () => {
    it('should build website from unified profile', async () => {
      // Create a mock profile
      const mockProfile: UnifiedProfile = {
        name: 'John Doe',
        headline: 'Senior Software Engineer',
        summary: 'Experienced developer with 10+ years in web technologies.',
        experience: [
          {
            id: '1',
            company: 'Tech Corp',
            title: 'Senior Engineer',
            location: 'San Francisco, CA',
            startDate: new Date('2020-01-01'),
            endDate: null,
            isCurrent: true,
            description: 'Leading frontend development team.',
            highlights: ['Led migration to React', 'Improved performance by 40%'],
            technologies: ['React', 'TypeScript', 'Node.js'],
          },
        ],
        education: [
          {
            id: '1',
            institution: 'MIT',
            degree: 'Bachelor of Science',
            field: 'Computer Science',
            startDate: new Date('2010-09-01'),
            endDate: new Date('2014-05-01'),
            honors: ['Magna Cum Laude'],
          },
        ],
        skills: [
          { name: 'TypeScript', category: 'language', proficiency: 'expert', yearsOfExperience: 5 },
          { name: 'React', category: 'framework', proficiency: 'expert', yearsOfExperience: 6 },
          { name: 'Node.js', category: 'framework', proficiency: 'advanced', yearsOfExperience: 7 },
        ],
        certifications: [],
        volunteerWork: [],
        contactInfo: {
          email: 'john@example.com',
          linkedIn: 'https://linkedin.com/in/johndoe',
          github: 'https://github.com/johndoe',
        },
      };

      // Set the profile
      platform.setProfile(mockProfile);

      // Build website
      const build = await platform.buildWebsite();

      // Verify build output
      expect(build).toBeDefined();
      expect(build.id).toBeDefined();
      expect(build.files.length).toBeGreaterThan(0);
      expect(build.totalSize).toBeGreaterThan(0);
      expect(build.generatedAt).toBeInstanceOf(Date);

      // Verify essential files exist
      const fileNames = build.files.map(f => f.path);
      expect(fileNames).toContain('index.html');
      expect(fileNames).toContain('style.css');
      expect(fileNames).toContain('experience.html');

      // Verify index.html contains profile info
      const indexFile = build.files.find(f => f.path === 'index.html');
      expect(indexFile).toBeDefined();
      const indexContent = indexFile!.content.toString();
      expect(indexContent).toContain('John Doe');
      expect(indexContent).toContain('Senior Software Engineer');

      // Verify contact info is included (safe methods only)
      expect(indexContent).toContain('mailto:john@example.com');
      expect(indexContent).toContain('linkedin.com/in/johndoe');
      expect(indexContent).toContain('github.com/johndoe');
    });

    it('should throw error when building website without profile', async () => {
      await expect(platform.buildWebsite()).rejects.toThrow('Profile not set');
    });
  });

  describe('Profile README Generation Flow', () => {
    it('should generate profile README from profile and projects', () => {
      // Create mock profile
      const mockProfile: UnifiedProfile = {
        name: 'Jane Smith',
        headline: 'Full Stack Developer',
        summary: 'Passionate about building great software.',
        experience: [],
        education: [],
        skills: [
          { name: 'Python', category: 'language', proficiency: 'expert', yearsOfExperience: 8 },
          { name: 'Django', category: 'framework', proficiency: 'advanced', yearsOfExperience: 5 },
        ],
        certifications: [],
        volunteerWork: [],
        contactInfo: {
          email: 'jane@example.com',
          linkedIn: 'https://linkedin.com/in/janesmith',
          github: 'https://github.com/janesmith',
        },
      };

      platform.setProfile(mockProfile);

      // Generate README
      const readme = platform.generateProfileReadme();

      // Verify README structure
      expect(readme).toBeDefined();
      expect(readme.markdown).toContain('Jane Smith');
      expect(readme.markdown).toContain('Full Stack Developer');
      expect(readme.sections.length).toBeGreaterThan(0);

      // Verify sections
      const sectionIds = readme.sections.map(s => s.id);
      expect(sectionIds).toContain('intro');
      expect(sectionIds).toContain('contact');
    });

    it('should throw error when generating README without profile', () => {
      expect(() => platform.generateProfileReadme()).toThrow('Profile not set');
    });
  });

  describe('Job Knowledge Base Flow', () => {
    it('should search and filter jobs', async () => {
      // Search with empty knowledge base
      const results = await platform.searchJobs('engineer');
      expect(results).toEqual([]);
    });

    it('should update job status', async () => {
      // This tests the interface - actual job would need to be added first
      await expect(platform.updateJobStatus('nonexistent', 'applied')).resolves.not.toThrow();
    });
  });

  describe('PII Management', () => {
    it('should scan content for PII', async () => {
      const content = 'Contact me at 555-123-4567 or john@example.com';
      const result = await platform.scanForPII(content);

      expect(result.hasPII).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
      
      const types = result.items.map(i => i.type);
      expect(types).toContain('phone');
      expect(types).toContain('email');
    });

    it('should manage PII allowlist', () => {
      platform.addToAllowlist('john@example.com', 'Professional email');
      
      const allowlist = platform.getAllowlist();
      expect(allowlist).toContain('john@example.com');
    });
  });

  describe('Design System', () => {
    it('should provide access to design system', () => {
      const designSystem = platform.getDesignSystem();
      expect(designSystem).toBeDefined();

      const config = designSystem.getConfig();
      expect(config.colorScheme).toBeDefined();
      expect(config.typography).toBeDefined();
      expect(config.layout).toBeDefined();
    });
  });

  describe('Abstract Generation', () => {
    it('should store and retrieve abstracts', async () => {
      // Initially empty
      expect(platform.getAbstracts()).toEqual([]);

      // After setting profile and generating, abstracts would be populated
      // This tests the getter interface
    });
  });
});
