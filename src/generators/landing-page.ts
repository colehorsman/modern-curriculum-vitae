/**
 * Landing Page Generator
 * 
 * Generates landing pages for projects with neo-brutalism design.
 * @see Requirements 3.1-3.6 - Landing Page Generation
 */

import type { ProjectAbstract, LandingPage, DesignConfig, PageMetadata } from '../types/design.js';

/**
 * Default neo-brutalism design config
 */
const DEFAULT_DESIGN: DesignConfig = {
  colorScheme: {
    primary: '#FF6B6B',
    secondary: '#4ECDC4',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    textMuted: '#666666',
    border: '#1A1A1A',
    accent: '#FFE66D',
  },
  typography: {
    headingFont: 'Space Grotesk, sans-serif',
    bodyFont: 'Inter, sans-serif',
    monoFont: 'JetBrains Mono, monospace',
    baseFontSize: 16,
    lineHeight: 1.6,
    headingWeight: 700,
  },
  layout: {
    maxWidth: 1200,
    borderWidth: 3,
    borderRadius: 0,
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    breakpoints: { mobile: 320, tablet: 768, desktop: 1024, wide: 1440 },
  },
};

function generateId(): string {
  return crypto.randomUUID();
}

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function generateCSS(design: DesignConfig): string {
  const { colorScheme: c, typography: t, layout: l } = design;
  return `
:root {
  --primary: ${c.primary};
  --secondary: ${c.secondary};
  --background: ${c.background};
  --surface: ${c.surface};
  --text: ${c.text};
  --text-muted: ${c.textMuted};
  --border: ${c.border};
  --accent: ${c.accent};
  --border-width: ${l.borderWidth}px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: ${t.bodyFont};
  font-size: ${t.baseFontSize}px;
  line-height: ${t.lineHeight};
  background: var(--background);
  color: var(--text);
}
.container { max-width: ${l.maxWidth}px; margin: 0 auto; padding: ${l.spacing.lg}px; }
h1, h2, h3 { font-family: ${t.headingFont}; font-weight: ${t.headingWeight}; }
h1 { font-size: 3rem; margin-bottom: ${l.spacing.lg}px; }
.card {
  background: var(--surface);
  border: var(--border-width) solid var(--border);
  padding: ${l.spacing.lg}px;
  margin-bottom: ${l.spacing.lg}px;
}
.badge {
  display: inline-block;
  background: var(--accent);
  border: 2px solid var(--border);
  padding: 4px 12px;
  margin: 4px;
  font-size: 0.875rem;
  font-weight: 600;
}
.btn {
  display: inline-block;
  background: var(--primary);
  color: white;
  border: var(--border-width) solid var(--border);
  padding: 12px 24px;
  font-weight: 600;
  text-decoration: none;
  min-height: 44px;
  min-width: 44px;
}
.btn:hover { background: var(--secondary); }
ul { list-style: none; }
li { padding: ${l.spacing.sm}px 0; border-bottom: 1px solid var(--border); }
@media (max-width: ${l.breakpoints.tablet}px) {
  .container { padding: ${l.spacing.md}px; }
  h1 { font-size: 2rem; }
}
`.trim();
}

function generateHTML(abstract: ProjectAbstract, repoUrl?: string): string {
  const techBadges = abstract.technologies.map(t => `<span class="badge">${t}</span>`).join('');
  const features = abstract.keyFeatures.map(f => `<li>${f}</li>`).join('');
  const metrics = abstract.impactMetrics.map(m => `<span class="badge">${m}</span>`).join('');
  
  const repoLink = abstract.isPublic && repoUrl 
    ? `<a href="${repoUrl}" class="btn" target="_blank">View on GitHub</a>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${abstract.summary}">
  <title>${abstract.title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <header class="card">
      <h1>${abstract.title}</h1>
      <p>${abstract.summary}</p>
      ${repoLink}
    </header>
    <section class="card">
      <h2>Technologies</h2>
      <div>${techBadges}</div>
    </section>
    <section class="card">
      <h2>Key Features</h2>
      <ul>${features}</ul>
    </section>
    ${metrics ? `<section class="card"><h2>Impact</h2><div>${metrics}</div></section>` : ''}
  </div>
</body>
</html>`;
}

/**
 * LandingPageGenerator class
 */
export class LandingPageGenerator {
  /**
   * Generates a landing page from a project abstract
   * @see Requirements 3.1, 3.2, 3.3
   */
  async generatePage(
    abstract: ProjectAbstract,
    design: DesignConfig = DEFAULT_DESIGN,
    repoUrl?: string
  ): Promise<LandingPage> {
    const slug = generateSlug(abstract.title);
    const html = generateHTML(abstract, abstract.isPublic ? repoUrl : undefined);
    const css = generateCSS(design);
    
    const metadata: PageMetadata = {
      title: abstract.title,
      description: abstract.summary,
      keywords: abstract.technologies,
    };

    return {
      id: generateId(),
      projectId: abstract.id,
      slug,
      html,
      css,
      assets: [],
      metadata,
    };
  }

  /**
   * Updates an existing landing page
   */
  async updatePage(pageId: string, updates: Partial<LandingPage>): Promise<LandingPage> {
    return { ...updates, id: pageId } as LandingPage;
  }
}

export const landingPageGenerator = new LandingPageGenerator();
