/**
 * Design system type definitions
 * 
 * Types for neo-brutalism design system, website building, and responsive layouts.
 * @see Requirements 9.1-9.5 - Neo-brutalism UI design system
 * @see Requirements 10.1-10.5 - Multi-device responsiveness
 */

/**
 * Color scheme for neo-brutalism design
 * @see Requirements 9.1 - Bold primary colors, thick borders, high contrast elements
 */
export interface ColorScheme {
  /** Bold accent color for primary elements */
  primary: string;
  /** Secondary accent color */
  secondary: string;
  /** Page background color */
  background: string;
  /** Card/component surface background */
  surface: string;
  /** Primary text color */
  text: string;
  /** Secondary/muted text color */
  textMuted: string;
  /** Bold border color */
  border: string;
  /** Highlight/accent color */
  accent: string;
}

/**
 * Typography configuration
 * @see Requirements 9.2 - Clean, readable typography with strong visual hierarchy
 */
export interface TypographyConfig {
  /** Font family for headings */
  headingFont: string;
  /** Font family for body text */
  bodyFont: string;
  /** Font family for code/monospace */
  monoFont: string;
  /** Base font size in pixels */
  baseFontSize: number;
  /** Line height multiplier */
  lineHeight: number;
  /** Font weight for headings */
  headingWeight: number;
}

/**
 * Spacing scale for consistent layout
 */
export interface SpacingScale {
  /** Extra small spacing (4px typical) */
  xs: number;
  /** Small spacing (8px typical) */
  sm: number;
  /** Medium spacing (16px typical) */
  md: number;
  /** Large spacing (24px typical) */
  lg: number;
  /** Extra large spacing (32px typical) */
  xl: number;
}

/**
 * Responsive breakpoints
 * @see Requirements 10.1 - Responsive layouts from 320px to 2560px width
 */
export interface Breakpoints {
  /** Mobile breakpoint (320px) */
  mobile: number;
  /** Tablet breakpoint (768px) */
  tablet: number;
  /** Desktop breakpoint (1024px) */
  desktop: number;
  /** Wide screen breakpoint (1440px) */
  wide: number;
}

/**
 * Layout configuration for neo-brutalism design
 * @see Requirements 9.4 - Flat, bold styling without subtle gradients or shadows
 */
export interface LayoutConfig {
  /** Maximum content width in pixels */
  maxWidth: number;
  /** Border width in pixels (thick for neo-brutalism) */
  borderWidth: number;
  /** Border radius in pixels (0 for neo-brutalism) */
  borderRadius: number;
  /** Spacing scale */
  spacing: SpacingScale;
  /** Responsive breakpoints */
  breakpoints: Breakpoints;
}

/**
 * Complete design configuration
 */
export interface DesignConfig {
  /** Color scheme */
  colorScheme: ColorScheme;
  /** Typography settings */
  typography: TypographyConfig;
  /** Layout settings */
  layout: LayoutConfig;
}

/**
 * Asset file in a website build
 */
export interface Asset {
  /** Asset filename */
  filename: string;
  /** Asset type */
  type: 'image' | 'font' | 'icon' | 'other';
  /** File path relative to build output */
  path: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
}

/**
 * Page metadata for SEO and social sharing
 */
export interface PageMetadata {
  /** Page title */
  title: string;
  /** Meta description */
  description: string;
  /** Keywords for SEO */
  keywords: string[];
  /** Open Graph image URL */
  ogImage?: string;
  /** Canonical URL */
  canonicalUrl?: string;
}

/**
 * Generated landing page for a project
 * @see Requirements 3.1-3.6 - Landing page generation
 */
export interface LandingPage {
  /** Unique identifier */
  id: string;
  /** Associated project ID */
  projectId: string;
  /** URL slug for the page */
  slug: string;
  /** Generated HTML content */
  html: string;
  /** Generated CSS styles */
  css: string;
  /** Associated assets */
  assets: Asset[];
  /** Page metadata */
  metadata: PageMetadata;
}

/**
 * Section configuration for website
 */
export interface SectionConfig {
  /** Section identifier */
  id: string;
  /** Section title */
  title: string;
  /** Section type */
  type: 'experience' | 'projects' | 'skills' | 'education' | 'volunteer' | 'contact' | 'custom';
  /** Whether section is visible */
  visible: boolean;
  /** Display order */
  order: number;
  /** Custom content for custom sections */
  customContent?: string;
}

/**
 * SEO configuration for website
 */
export interface SEOConfig {
  /** Site title */
  siteTitle: string;
  /** Site description */
  siteDescription: string;
  /** Site keywords */
  keywords: string[];
  /** Author name */
  author: string;
  /** Social media handles */
  socialHandles?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
  };
  /** Google Analytics ID */
  analyticsId?: string;
}

/**
 * Website configuration for building
 * @see Requirements 6.1-6.6 - Personal website generation
 */
export interface WebsiteConfig {
  /** User profile data */
  profile: import('./profile.js').UnifiedProfile;
  /** Project abstracts to include */
  projects: ProjectAbstract[];
  /** Generated landing pages */
  landingPages: LandingPage[];
  /** Design configuration */
  design: DesignConfig;
  /** Section configurations */
  sections: SectionConfig[];
  /** SEO configuration */
  seo: SEOConfig;
}

/**
 * Build file in website output
 */
export interface BuildFile {
  /** File path relative to output directory */
  path: string;
  /** File content */
  content: string | Buffer;
  /** File size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
}

/**
 * Result of website build
 */
export interface WebsiteBuild {
  /** Build identifier */
  id: string;
  /** Generated files */
  files: BuildFile[];
  /** Total size in bytes */
  totalSize: number;
  /** Build timestamp */
  generatedAt: Date;
}

/**
 * Deployment target configuration
 */
export interface DeployTarget {
  /** Target type */
  type: 'github-pages' | 'netlify' | 'vercel' | 'custom';
  /** Target URL or identifier */
  url: string;
  /** Deployment credentials */
  credentials?: {
    token?: string;
    apiKey?: string;
  };
}

/**
 * Result of deployment operation
 */
export interface DeployResult {
  /** Whether deployment was successful */
  success: boolean;
  /** Deployed URL */
  url?: string;
  /** Error message if failed */
  error?: string;
  /** Deployment timestamp */
  deployedAt: Date;
}

/**
 * Preview URL for website preview
 */
export interface PreviewUrl {
  /** Preview URL */
  url: string;
  /** Expiration time */
  expiresAt: Date;
}

/**
 * Project abstract for portfolio display
 * @see Requirements 2.1-2.5 - Project abstract generation
 */
export interface ProjectAbstract {
  /** Unique identifier */
  id: string;
  /** Source repository name */
  repositoryName: string;
  /** Project title */
  title: string;
  /** Project summary */
  summary: string;
  /** Technologies used */
  technologies: string[];
  /** Key features */
  keyFeatures: string[];
  /** Impact metrics */
  impactMetrics: string[];
  /** Whether the source is public */
  isPublic: boolean;
  /** Generation timestamp */
  generatedAt: Date;
  /** Last edit timestamp */
  lastEdited: Date | null;
}

/**
 * Options for abstract generation
 */
export interface AbstractOptions {
  /** Whether to include metrics */
  includeMetrics: boolean;
  /** Maximum length in characters */
  maxLength: number;
  /** Tone of the abstract */
  tone: 'professional' | 'casual';
  /** Whether to hide proprietary details */
  hideProprietaryDetails: boolean;
}

/**
 * Badge for technology or skill display
 */
export interface Badge {
  /** Badge label */
  label: string;
  /** Badge color */
  color: string;
  /** Badge icon URL or name */
  icon?: string;
  /** Link URL */
  url?: string;
}

/**
 * Section in GitHub profile README
 */
export interface ReadmeSection {
  /** Section identifier */
  id: string;
  /** Section title */
  title: string;
  /** Section content in markdown */
  content: string;
  /** Display order */
  order: number;
}

/**
 * Featured project in profile README
 * @see Requirements 11.3 - Display featured projects with descriptions and links
 */
export interface FeaturedProject {
  /** Project name */
  name: string;
  /** Brief description */
  description: string;
  /** Project URL */
  url: string;
  /** Technologies used */
  technologies: string[];
}

/**
 * GitHub profile README
 * @see Requirements 11.1-11.7 - GitHub profile page enhancement
 */
export interface ProfileReadme {
  /** Complete markdown content */
  markdown: string;
  /** Technology badges */
  badges: Badge[];
  /** README sections */
  sections: ReadmeSection[];
  /** Featured projects */
  featuredProjects: FeaturedProject[];
}

/**
 * Changes to apply to profile README
 */
export interface ReadmeChanges {
  /** Sections to update */
  sections?: Partial<ReadmeSection>[];
  /** Featured projects to update */
  featuredProjects?: FeaturedProject[];
  /** Badges to update */
  badges?: Badge[];
}

/**
 * PII type classification
 * @see Requirements 8.1 - Scan for PII patterns
 */
export type PIIType = 'phone' | 'address' | 'ssn' | 'email' | 'dob' | 'financial';

/**
 * Detected PII item
 */
export interface PIIItem {
  /** Type of PII detected */
  type: PIIType;
  /** The detected value */
  value: string;
  /** Position in the content */
  position: { start: number; end: number };
  /** Detection confidence (0-1) */
  confidence: number;
}

/**
 * Risk level for PII detection
 */
export type PIIRiskLevel = 'none' | 'low' | 'medium' | 'high';

/**
 * Result of PII scan
 * @see Requirements 8.1, 8.2 - PII detection and flagging
 */
export interface PIIScanResult {
  /** Whether any PII was detected */
  hasPII: boolean;
  /** Detected PII items */
  items: PIIItem[];
  /** Overall risk level */
  riskLevel: PIIRiskLevel;
}
