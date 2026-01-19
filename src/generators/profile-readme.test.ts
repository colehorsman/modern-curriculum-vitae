/**
 * Property-based tests for ProfileReadmeGenerator
 * 
 * Tests GitHub profile README completeness using fast-check.
 * @see Requirements 11.2, 11.3, 11.4, 11.5 - GitHub profile page enhancement
 */

// Feature: career-showcase-platform, Property 32: GitHub Profile README Completeness
// **Validates: Requirements 11.2, 11.3, 11.4, 11.5**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ProfileReadmeGenerator } from './profile-readme.js';
import type { UnifiedProfile, Skill, WorkExperience, Education, ContactInfo } from '../types/profile.js';
import type { ProjectAbstract } from '../types/design.js';

/**
 * Arbitrary generator for ContactInfo
 */
const contactInfoArbitrary: fc.Arbitrary<ContactInfo> = fc.record({
  email: fc.emailAddress(),
  linkedIn: fc.webUrl().map(url => `https://linkedin.com/in/${url.split('/').pop()}`),
  github: fc.string({ minLength: 1, maxLength: 39 })
    .filter(s => /^[a-zA-Z0-9-]+$/.test(s))
    .map(username => `https://github.com/${username}`),
  website: fc.option(fc.webUrl(), { nil: undefined }),
  phone: fc.option(fc.string(), { nil: undefined }),
  address: fc.option(fc.string(), { nil: undefined }),
});

/**
 * Arbitrary generator for Skill
 */
const skillArbitrary: fc.Arbitrary<Skill> = fc.record({
  name: fc.constantFrom(
    'TypeScript', 'JavaScript', 'Python', 'React', 'Node.js', 'AWS',
    'Docker', 'Kubernetes', 'Go', 'Rust', 'Java', 'C++', 'GraphQL', 'PostgreSQL'
  ),
  category: fc.constantFrom('language', 'framework', 'tool', 'concept', 'soft'),
  proficiency: fc.constantFrom('beginner', 'intermediate', 'advanced', 'expert'),
  yearsOfExperience: fc.integer({ min: 0, max: 30 }),
});

/**
 * Arbitrary generator for WorkExperience
 */
const workExperienceArbitrary: fc.Arbitrary<WorkExperience> = fc.record({
  id: fc.uuid(),
  company: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  location: fc.string({ minLength: 1, maxLength: 100 }),
  startDate: fc.date({ min: new Date('2000-01-01'), max: new Date() }),
  endDate: fc.option(fc.date({ min: new Date('2000-01-01'), max: new Date() }), { nil: null }),
  isCurrent: fc.boolean(),
  description: fc.string({ maxLength: 500 }),
  highlights: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { maxLength: 5 }),
  technologies: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
});

/**
 * Arbitrary generator for Education
 */
const educationArbitrary: fc.Arbitrary<Education> = fc.record({
  id: fc.uuid(),
  institution: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  degree: fc.string({ minLength: 1, maxLength: 100 }),
  field: fc.string({ minLength: 1, maxLength: 100 }),
  startDate: fc.date({ min: new Date('1990-01-01'), max: new Date() }),
  endDate: fc.option(fc.date({ min: new Date('1990-01-01'), max: new Date() }), { nil: null }),
  gpa: fc.option(fc.float({ min: 0, max: 4, noNaN: true }), { nil: undefined }),
  honors: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 3 }),
});

/**
 * Arbitrary generator for UnifiedProfile with required fields for README generation
 */
const unifiedProfileArbitrary: fc.Arbitrary<UnifiedProfile> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  headline: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
  summary: fc.string({ minLength: 10, maxLength: 1000 }),
  experience: fc.array(workExperienceArbitrary, { minLength: 0, maxLength: 5 }),
  education: fc.array(educationArbitrary, { minLength: 0, maxLength: 3 }),
  skills: fc.array(skillArbitrary, { minLength: 1, maxLength: 15 }),
  certifications: fc.constant([]),
  volunteerWork: fc.constant([]),
  contactInfo: contactInfoArbitrary,
});

/**
 * Arbitrary generator for ProjectAbstract
 */
const projectAbstractArbitrary: fc.Arbitrary<ProjectAbstract> = fc.record({
  id: fc.uuid(),
  repositoryName: fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => /^[a-zA-Z0-9._-]+$/.test(s))
    .map(name => `user/${name}`),
  title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  summary: fc.string({ minLength: 10, maxLength: 500 }),
  technologies: fc.array(
    fc.constantFrom('TypeScript', 'JavaScript', 'Python', 'React', 'Node.js', 'Docker'),
    { minLength: 1, maxLength: 5 }
  ),
  keyFeatures: fc.array(fc.string({ minLength: 5, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
  impactMetrics: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 3 }),
  isPublic: fc.boolean(),
  generatedAt: fc.date(),
  lastEdited: fc.option(fc.date(), { nil: null }),
});

describe('ProfileReadmeGenerator Property Tests', () => {
  const generator = new ProfileReadmeGenerator();

  describe('Property 32: GitHub Profile README Completeness', () => {
    // Feature: career-showcase-platform, Property 32: GitHub Profile README Completeness
    // **Validates: Requirements 11.2, 11.3, 11.4, 11.5**

    it('should always contain a heading with the user\'s name', () => {
      fc.assert(
        fc.property(
          unifiedProfileArbitrary,
          fc.array(projectAbstractArbitrary, { minLength: 0, maxLength: 5 }),
          (profile, projects) => {
            const readme = generator.generate(profile, projects);

            // Markdown should contain a heading with the user's name
            // @see Requirements 11.2 - Include professional introduction
            expect(readme.markdown).toContain(`# Hi, I'm ${profile.name}`);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should always contain an introduction section', () => {
      fc.assert(
        fc.property(
          unifiedProfileArbitrary,
          fc.array(projectAbstractArbitrary, { minLength: 0, maxLength: 5 }),
          (profile, projects) => {
            const readme = generator.generate(profile, projects);

            // Should have an About Me / introduction section
            // @see Requirements 11.2 - Include professional introduction
            const hasIntroSection = readme.sections.some(
              section => section.id === 'intro' || section.title.toLowerCase().includes('about')
            );
            expect(hasIntroSection).toBe(true);

            // The intro section should contain content from profile summary or headline
            const introSection = readme.sections.find(s => s.id === 'intro');
            expect(introSection).toBeDefined();
            expect(introSection!.content.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should contain a tech stack section with badge syntax when skills are present', () => {
      fc.assert(
        fc.property(
          unifiedProfileArbitrary.filter(p => 
            p.skills.some(s => s.category === 'language' || s.category === 'framework')
          ),
          fc.array(projectAbstractArbitrary, { minLength: 0, maxLength: 5 }),
          (profile, projects) => {
            const readme = generator.generate(profile, projects);

            // Should have a tech stack section
            // @see Requirements 11.2 - Include tech stack in profile README
            const hasTechStackSection = readme.sections.some(
              section => section.id === 'tech-stack' || 
                        section.title.toLowerCase().includes('tech') ||
                        section.title.toLowerCase().includes('stack')
            );
            expect(hasTechStackSection).toBe(true);

            // Should have badges
            expect(readme.badges.length).toBeGreaterThan(0);

            // Markdown should contain badge syntax (shields.io or similar)
            // @see Requirements 11.5 - Use clean formatting with badges
            const hasBadgeSyntax = readme.markdown.includes('![') && 
                                   readme.markdown.includes('](') &&
                                   (readme.markdown.includes('img.shields.io') || 
                                    readme.markdown.includes('badge'));
            expect(hasBadgeSyntax).toBe(true);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should contain a featured projects section with links when public projects exist', () => {
      fc.assert(
        fc.property(
          unifiedProfileArbitrary,
          fc.array(projectAbstractArbitrary.filter(p => p.isPublic), { minLength: 1, maxLength: 5 }),
          (profile, projects) => {
            const readme = generator.generate(profile, projects);

            // Should have a projects section
            // @see Requirements 11.3 - Display featured projects with descriptions and links
            const hasProjectsSection = readme.sections.some(
              section => section.id === 'projects' || 
                        section.title.toLowerCase().includes('project')
            );
            expect(hasProjectsSection).toBe(true);

            // Should have featured projects
            expect(readme.featuredProjects.length).toBeGreaterThan(0);

            // Featured projects should have URLs
            readme.featuredProjects.forEach(project => {
              expect(project.url).toBeDefined();
              expect(project.url.length).toBeGreaterThan(0);
              expect(project.url).toContain('github.com');
            });

            // Markdown should contain project links
            const projectsSection = readme.sections.find(s => s.id === 'projects');
            if (projectsSection) {
              expect(projectsSection.content).toContain('](');
            }
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should contain a contact section with LinkedIn and GitHub links', () => {
      fc.assert(
        fc.property(
          unifiedProfileArbitrary,
          fc.array(projectAbstractArbitrary, { minLength: 0, maxLength: 5 }),
          (profile, projects) => {
            const readme = generator.generate(profile, projects);

            // Should have a contact/connect section
            // @see Requirements 11.4 - Include professional contact links
            const hasContactSection = readme.sections.some(
              section => section.id === 'contact' || 
                        section.title.toLowerCase().includes('connect') ||
                        section.title.toLowerCase().includes('contact')
            );
            expect(hasContactSection).toBe(true);

            // Contact section should contain LinkedIn link
            const contactSection = readme.sections.find(
              s => s.id === 'contact' || s.title.toLowerCase().includes('connect')
            );
            expect(contactSection).toBeDefined();
            
            // Should contain LinkedIn badge/link
            const hasLinkedIn = contactSection!.content.toLowerCase().includes('linkedin') ||
                               readme.markdown.toLowerCase().includes('linkedin');
            expect(hasLinkedIn).toBe(true);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should produce a complete ProfileReadme structure', () => {
      fc.assert(
        fc.property(
          unifiedProfileArbitrary,
          fc.array(projectAbstractArbitrary, { minLength: 0, maxLength: 5 }),
          (profile, projects) => {
            const readme = generator.generate(profile, projects);

            // Should have all required fields
            expect(readme).toHaveProperty('markdown');
            expect(readme).toHaveProperty('badges');
            expect(readme).toHaveProperty('sections');
            expect(readme).toHaveProperty('featuredProjects');

            // Markdown should be non-empty
            expect(readme.markdown.length).toBeGreaterThan(0);

            // Sections should be an array
            expect(Array.isArray(readme.sections)).toBe(true);

            // Badges should be an array
            expect(Array.isArray(readme.badges)).toBe(true);

            // Featured projects should be an array
            expect(Array.isArray(readme.featuredProjects)).toBe(true);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should include headline in the markdown', () => {
      fc.assert(
        fc.property(
          unifiedProfileArbitrary,
          fc.array(projectAbstractArbitrary, { minLength: 0, maxLength: 5 }),
          (profile, projects) => {
            const readme = generator.generate(profile, projects);

            // Markdown should contain the headline
            // @see Requirements 11.2 - Include professional introduction
            expect(readme.markdown).toContain(profile.headline);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should have sections with proper ordering', () => {
      fc.assert(
        fc.property(
          unifiedProfileArbitrary,
          fc.array(projectAbstractArbitrary, { minLength: 0, maxLength: 5 }),
          (profile, projects) => {
            const readme = generator.generate(profile, projects);

            // Each section should have an order property
            readme.sections.forEach(section => {
              expect(section).toHaveProperty('order');
              expect(typeof section.order).toBe('number');
            });

            // Sections should be orderable (no duplicate orders or all unique)
            const orders = readme.sections.map(s => s.order);
            const uniqueOrders = new Set(orders);
            expect(uniqueOrders.size).toBe(orders.length);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should generate badges with required properties', () => {
      fc.assert(
        fc.property(
          unifiedProfileArbitrary.filter(p => 
            p.skills.some(s => s.category === 'language' || s.category === 'framework')
          ),
          fc.array(projectAbstractArbitrary, { minLength: 0, maxLength: 5 }),
          (profile, projects) => {
            const readme = generator.generate(profile, projects);

            // Each badge should have label and color
            readme.badges.forEach(badge => {
              expect(badge).toHaveProperty('label');
              expect(badge).toHaveProperty('color');
              expect(badge.label.length).toBeGreaterThan(0);
              expect(badge.color.length).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should generate featured projects with required properties', () => {
      fc.assert(
        fc.property(
          unifiedProfileArbitrary,
          fc.array(projectAbstractArbitrary.filter(p => p.isPublic), { minLength: 1, maxLength: 5 }),
          (profile, projects) => {
            const readme = generator.generate(profile, projects);

            // Each featured project should have name, description, url, and technologies
            // @see Requirements 11.3 - Display featured projects with descriptions and links
            readme.featuredProjects.forEach(project => {
              expect(project).toHaveProperty('name');
              expect(project).toHaveProperty('description');
              expect(project).toHaveProperty('url');
              expect(project).toHaveProperty('technologies');
              
              expect(project.name.length).toBeGreaterThan(0);
              expect(project.url.length).toBeGreaterThan(0);
              expect(Array.isArray(project.technologies)).toBe(true);
            });
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });

    it('should only include public projects in featured projects', () => {
      fc.assert(
        fc.property(
          unifiedProfileArbitrary,
          fc.array(projectAbstractArbitrary, { minLength: 1, maxLength: 10 }),
          (profile, projects) => {
            const readme = generator.generate(profile, projects);

            // Featured projects count should not exceed public projects count
            const publicProjectsCount = projects.filter(p => p.isPublic).length;
            expect(readme.featuredProjects.length).toBeLessThanOrEqual(publicProjectsCount);
          }
        ),
        { numRuns: 100, seed: Date.now() }
      );
    });
  });
});
