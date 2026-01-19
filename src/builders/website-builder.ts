/**
 * Website Builder
 * 
 * Generates personal portfolio website with neo-brutalism design.
 * @see Requirements 6.1-6.6, 10.1-10.5
 */

import type { 
  WebsiteConfig, WebsiteBuild, BuildFile, 
  UnifiedProfile, ProjectAbstract, DesignConfig 
} from '../types/design.js';
import { DesignSystem, DEFAULT_COLOR_SCHEME, DEFAULT_TYPOGRAPHY, DEFAULT_LAYOUT } from '../design/design-system.js';

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * WebsiteBuilder class
 */
export class WebsiteBuilder {
  /**
   * Builds the complete website
   * @see Requirements 6.1, 6.2
   */
  async build(config: WebsiteConfig): Promise<WebsiteBuild> {
    const files: BuildFile[] = [];
    const designSystem = new DesignSystem(config.design);

    // Generate main CSS
    files.push(this.generateMainCSS(designSystem));

    // Generate index page
    files.push(this.generateIndexPage(config));

    // Generate section pages
    if (config.profile.experience.length > 0) {
      files.push(this.generateExperiencePage(config.profile));
    }

    if (config.projects.length > 0) {
      files.push(this.generateProjectsPage(config.projects));
    }

    // Calculate total size
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    return {
      id: generateId(),
      files,
      totalSize,
      generatedAt: new Date(),
    };
  }

  private generateMainCSS(designSystem: DesignSystem): BuildFile {
    const cssVars = designSystem.generateCSSVariables();
    const css = `
${cssVars}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  line-height: var(--line-height);
  background: var(--color-background);
  color: var(--color-text);
}

.container {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: var(--spacing-lg);
}

h1, h2, h3, h4 {
  font-family: var(--font-heading);
  font-weight: var(--font-weight-heading);
  margin-bottom: var(--spacing-md);
}

h1 { font-size: 3rem; }
h2 { font-size: 2rem; }
h3 { font-size: 1.5rem; }

.card {
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.badge {
  display: inline-block;
  background: var(--color-accent);
  border: 2px solid var(--color-border);
  padding: 4px 12px;
  margin: 4px;
  font-size: 0.875rem;
  font-weight: 600;
}

.btn {
  display: inline-block;
  background: var(--color-primary);
  color: white;
  border: var(--border-width) solid var(--color-border);
  padding: 12px 24px;
  font-weight: 600;
  text-decoration: none;
  min-height: 44px;
  min-width: 44px;
  cursor: pointer;
}

.btn:hover {
  background: var(--color-secondary);
}

a {
  color: var(--color-primary);
  text-decoration: none;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}

a:hover {
  text-decoration: underline;
}

nav {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
  flex-wrap: wrap;
}

.section {
  margin-bottom: var(--spacing-xl);
}

.experience-item, .project-item {
  border-bottom: 1px solid var(--color-border);
  padding: var(--spacing-lg) 0;
}

.skills-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

/* Responsive - Mobile first */
@media (max-width: 767px) {
  .container {
    padding: var(--spacing-md);
  }
  
  h1 { font-size: 2rem; }
  h2 { font-size: 1.5rem; }
  
  nav {
    flex-direction: column;
  }
  
  .card {
    padding: var(--spacing-md);
  }
}

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) {
  .container {
    padding: var(--spacing-lg);
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    padding: var(--spacing-xl);
  }
}
`.trim();

    return {
      path: 'style.css',
      content: css,
      size: css.length,
      mimeType: 'text/css',
    };
  }

  private generateIndexPage(config: WebsiteConfig): BuildFile {
    const { profile, seo } = config;
    const contact = profile.contactInfo;

    // Only include safe contact methods (no phone/address)
    const contactLinks = [];
    if (contact.email) {
      contactLinks.push(`<a href="mailto:${contact.email}" class="btn">Email</a>`);
    }
    if (contact.linkedIn) {
      contactLinks.push(`<a href="${contact.linkedIn}" class="btn" target="_blank">LinkedIn</a>`);
    }
    if (contact.github) {
      contactLinks.push(`<a href="${contact.github}" class="btn" target="_blank">GitHub</a>`);
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${seo.siteDescription}">
  <title>${seo.siteTitle}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <header class="card">
      <h1>${profile.name}</h1>
      <p class="headline">${profile.headline}</p>
      <p>${profile.summary}</p>
      <div class="contact-links" style="margin-top: var(--spacing-lg);">
        ${contactLinks.join('\n        ')}
      </div>
    </header>

    <nav>
      <a href="experience.html" class="btn">Experience</a>
      <a href="projects.html" class="btn">Projects</a>
    </nav>

    <section class="section card">
      <h2>Skills</h2>
      <div class="skills-grid">
        ${profile.skills.map(s => `<span class="badge">${s.name}</span>`).join('\n        ')}
      </div>
    </section>

    ${profile.volunteerWork.length > 0 ? `
    <section class="section card">
      <h2>Volunteer Work</h2>
      ${profile.volunteerWork.map(v => `
        <div class="experience-item">
          <h3>${v.role}</h3>
          <p><strong>${v.organization}</strong></p>
          <p>${v.description}</p>
        </div>
      `).join('')}
    </section>
    ` : ''}
  </div>
</body>
</html>`;

    return {
      path: 'index.html',
      content: html,
      size: html.length,
      mimeType: 'text/html',
    };
  }

  private generateExperiencePage(profile: UnifiedProfile): BuildFile {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Experience - ${profile.name}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <nav>
      <a href="index.html" class="btn">Home</a>
      <a href="projects.html" class="btn">Projects</a>
    </nav>

    <h1>Experience</h1>

    ${profile.experience.map(exp => `
    <div class="card experience-item">
      <h2>${exp.title}</h2>
      <p><strong>${exp.company}</strong> | ${exp.location}</p>
      <p class="dates">${exp.startDate.toLocaleDateString()} - ${exp.isCurrent ? 'Present' : exp.endDate?.toLocaleDateString()}</p>
      <p>${exp.description}</p>
      ${exp.highlights.length > 0 ? `
      <ul>
        ${exp.highlights.map(h => `<li>${h}</li>`).join('')}
      </ul>
      ` : ''}
      <div class="skills-grid">
        ${exp.technologies.map(t => `<span class="badge">${t}</span>`).join('')}
      </div>
    </div>
    `).join('')}

    ${profile.education.length > 0 ? `
    <h2>Education</h2>
    ${profile.education.map(edu => `
    <div class="card">
      <h3>${edu.degree} in ${edu.field}</h3>
      <p><strong>${edu.institution}</strong></p>
    </div>
    `).join('')}
    ` : ''}
  </div>
</body>
</html>`;

    return {
      path: 'experience.html',
      content: html,
      size: html.length,
      mimeType: 'text/html',
    };
  }

  private generateProjectsPage(projects: ProjectAbstract[]): BuildFile {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Projects</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <nav>
      <a href="index.html" class="btn">Home</a>
      <a href="experience.html" class="btn">Experience</a>
    </nav>

    <h1>Projects</h1>

    ${projects.map(project => `
    <div class="card project-item">
      <h2>${project.title}</h2>
      <p>${project.summary}</p>
      <div class="skills-grid">
        ${project.technologies.map(t => `<span class="badge">${t}</span>`).join('')}
      </div>
      <h4>Key Features</h4>
      <ul>
        ${project.keyFeatures.map(f => `<li>${f}</li>`).join('')}
      </ul>
      ${project.isPublic ? `<a href="projects/${project.repositoryName}.html" class="btn">View Details</a>` : ''}
    </div>
    `).join('')}
  </div>
</body>
</html>`;

    return {
      path: 'projects.html',
      content: html,
      size: html.length,
      mimeType: 'text/html',
    };
  }
}

export const websiteBuilder = new WebsiteBuilder();
