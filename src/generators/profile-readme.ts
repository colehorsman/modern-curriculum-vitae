/**
 * Profile README Generator
 * 
 * Generates GitHub profile README with neo-brutalism aesthetic.
 * @see Requirements 11.1-11.7
 */

import type { UnifiedProfile } from '../types/profile.js';
import type { ProjectAbstract, ProfileReadme, Badge, FeaturedProject, ReadmeSection } from '../types/design.js';

/**
 * ProfileReadmeGenerator class
 */
export class ProfileReadmeGenerator {
  /**
   * Generates a GitHub profile README
   * @see Requirements 11.2, 11.3, 11.4, 11.5
   */
  generate(profile: UnifiedProfile, projects: ProjectAbstract[]): ProfileReadme {
    const badges = this.generateBadges(profile);
    const featuredProjects = this.selectFeaturedProjects(projects);
    const sections = this.generateSections(profile, featuredProjects, badges);
    const markdown = this.assembleMarkdown(profile, sections, badges, featuredProjects);

    return {
      markdown,
      badges,
      sections,
      featuredProjects,
    };
  }

  private generateBadges(profile: UnifiedProfile): Badge[] {
    const techBadges: Badge[] = profile.skills
      .filter(s => s.category === 'language' || s.category === 'framework')
      .slice(0, 8)
      .map(skill => ({
        label: skill.name,
        color: this.getSkillColor(skill.name),
        url: `https://skillicons.dev/icons?i=${skill.name.toLowerCase()}`,
      }));

    return techBadges;
  }

  private getSkillColor(skill: string): string {
    const colors: Record<string, string> = {
      TypeScript: '3178C6',
      JavaScript: 'F7DF1E',
      Python: '3776AB',
      React: '61DAFB',
      'Node.js': '339933',
      AWS: 'FF9900',
      Docker: '2496ED',
    };
    return colors[skill] || '666666';
  }

  private selectFeaturedProjects(projects: ProjectAbstract[]): FeaturedProject[] {
    return projects
      .filter(p => p.isPublic)
      .slice(0, 4)
      .map(p => ({
        name: p.title,
        description: p.summary.substring(0, 100) + (p.summary.length > 100 ? '...' : ''),
        url: `https://github.com/${p.repositoryName}`,
        technologies: p.technologies.slice(0, 3),
      }));
  }

  private generateSections(
    profile: UnifiedProfile,
    featuredProjects: FeaturedProject[],
    badges: Badge[]
  ): ReadmeSection[] {
    const sections: ReadmeSection[] = [];

    // Introduction
    sections.push({
      id: 'intro',
      title: 'About Me',
      content: profile.summary || profile.headline,
      order: 1,
    });

    // Tech Stack
    if (badges.length > 0) {
      const badgeMarkdown = badges
        .map(b => `![${b.label}](https://img.shields.io/badge/${b.label}-${b.color}?style=flat-square&logo=${b.label.toLowerCase()}&logoColor=white)`)
        .join(' ');
      
      sections.push({
        id: 'tech-stack',
        title: 'Tech Stack',
        content: badgeMarkdown,
        order: 2,
      });
    }

    // Featured Projects
    if (featuredProjects.length > 0) {
      const projectsMarkdown = featuredProjects
        .map(p => `- **[${p.name}](${p.url})** - ${p.description}`)
        .join('\n');
      
      sections.push({
        id: 'projects',
        title: 'Featured Projects',
        content: projectsMarkdown,
        order: 3,
      });
    }

    // Contact
    const contactLinks = [];
    if (profile.contactInfo.linkedIn) {
      contactLinks.push(`[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat-square&logo=linkedin&logoColor=white)](${profile.contactInfo.linkedIn})`);
    }
    if (profile.contactInfo.email) {
      contactLinks.push(`[![Email](https://img.shields.io/badge/Email-D14836?style=flat-square&logo=gmail&logoColor=white)](mailto:${profile.contactInfo.email})`);
    }
    if (profile.contactInfo.website) {
      contactLinks.push(`[![Portfolio](https://img.shields.io/badge/Portfolio-000000?style=flat-square&logo=About.me&logoColor=white)](${profile.contactInfo.website})`);
    }

    if (contactLinks.length > 0) {
      sections.push({
        id: 'contact',
        title: 'Connect',
        content: contactLinks.join(' '),
        order: 4,
      });
    }

    return sections;
  }

  private assembleMarkdown(
    profile: UnifiedProfile,
    sections: ReadmeSection[],
    badges: Badge[],
    featuredProjects: FeaturedProject[]
  ): string {
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);

    let markdown = `# Hi, I'm ${profile.name} 👋\n\n`;
    markdown += `### ${profile.headline}\n\n`;

    for (const section of sortedSections) {
      markdown += `## ${section.title}\n\n`;
      markdown += `${section.content}\n\n`;
    }

    // Footer
    markdown += `---\n\n`;
    markdown += `*This README was generated with ❤️*\n`;

    return markdown;
  }
}

export const profileReadmeGenerator = new ProfileReadmeGenerator();
