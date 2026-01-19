/**
 * Profile-related type definitions
 * 
 * Types for resume parsing, LinkedIn integration, and unified profile management.
 * @see Requirements 7.1-7.5 - Resume and profile integration
 */

/**
 * Work experience entry
 * @see Requirements 7.1 - Extract work experience from resume
 */
export interface WorkExperience {
  /** Unique identifier */
  id: string;
  /** Company name */
  company: string;
  /** Job title */
  title: string;
  /** Work location */
  location: string;
  /** Start date of employment */
  startDate: Date;
  /** End date of employment, null if current */
  endDate: Date | null;
  /** Whether this is the current position */
  isCurrent: boolean;
  /** Job description */
  description: string;
  /** Key achievements and highlights */
  highlights: string[];
  /** Technologies used in this role */
  technologies: string[];
}

/**
 * Education entry
 * @see Requirements 7.1 - Extract education from resume
 */
export interface Education {
  /** Unique identifier */
  id: string;
  /** Educational institution name */
  institution: string;
  /** Degree type (e.g., 'Bachelor of Science', 'Master of Arts') */
  degree: string;
  /** Field of study */
  field: string;
  /** Start date */
  startDate: Date;
  /** End date, null if ongoing */
  endDate: Date | null;
  /** GPA if available */
  gpa?: number;
  /** Honors and awards */
  honors: string[];
}

/**
 * Skill category classification
 */
export type SkillCategory = 'language' | 'framework' | 'tool' | 'concept' | 'soft';

/**
 * Skill proficiency level
 */
export type SkillProficiency = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * Skill entry with proficiency information
 * @see Requirements 7.1 - Extract skills from resume
 */
export interface Skill {
  /** Skill name */
  name: string;
  /** Category of the skill */
  category: SkillCategory;
  /** Proficiency level */
  proficiency: SkillProficiency;
  /** Years of experience with this skill */
  yearsOfExperience: number;
}

/**
 * Professional certification
 */
export interface Certification {
  /** Unique identifier */
  id: string;
  /** Certification name */
  name: string;
  /** Issuing organization */
  issuer: string;
  /** Date obtained */
  dateObtained: Date;
  /** Expiration date if applicable */
  expirationDate?: Date;
  /** Credential ID or URL */
  credentialId?: string;
  /** URL to verify certification */
  credentialUrl?: string;
}

/**
 * Volunteer experience entry
 * @see Requirements 6.1 - Include volunteer work section on website
 */
export interface VolunteerExperience {
  /** Unique identifier */
  id: string;
  /** Organization name */
  organization: string;
  /** Role/position */
  role: string;
  /** Cause or focus area */
  cause: string;
  /** Start date */
  startDate: Date;
  /** End date, null if ongoing */
  endDate: Date | null;
  /** Description of volunteer work */
  description: string;
  /** Key achievements */
  highlights: string[];
}

/**
 * Contact information with PII flags
 * @see Requirements 6.5, 6.6 - Exclude PII, include only professional contact methods
 * @see Requirements 8.1-8.5 - PII protection
 */
export interface ContactInfo {
  /** Email address (safe to display) */
  email: string;
  /** LinkedIn profile URL (safe to display) */
  linkedIn: string;
  /** GitHub profile URL (safe to display) */
  github: string;
  /** Personal website URL (safe to display) */
  website?: string;
  /** Phone number - PII, never exposed publicly */
  phone?: string;
  /** Physical address - PII, never exposed publicly */
  address?: string;
}

/**
 * Unified profile combining resume and LinkedIn data
 * @see Requirements 7.4 - Merge data from resume and LinkedIn to create unified profile
 */
export interface UnifiedProfile {
  /** Full name */
  name: string;
  /** Professional headline */
  headline: string;
  /** Professional summary/bio */
  summary: string;
  /** Work experience entries */
  experience: WorkExperience[];
  /** Education entries */
  education: Education[];
  /** Skills list */
  skills: Skill[];
  /** Professional certifications */
  certifications: Certification[];
  /** Volunteer work entries */
  volunteerWork: VolunteerExperience[];
  /** Contact information */
  contactInfo: ContactInfo;
}

/**
 * Parsed resume data before merging
 * @see Requirements 7.1, 7.2 - Parse resume from PDF and DOCX formats
 */
export interface ParsedResume {
  /** Extracted name */
  name: string;
  /** Extracted email */
  email?: string;
  /** Extracted phone (PII) */
  phone?: string;
  /** Extracted address (PII) */
  address?: string;
  /** Professional summary if present */
  summary?: string;
  /** Work experience entries */
  experience: WorkExperience[];
  /** Education entries */
  education: Education[];
  /** Skills extracted */
  skills: Skill[];
  /** Certifications extracted */
  certifications: Certification[];
  /** Raw text content for reference */
  rawText: string;
  /** Source file format */
  sourceFormat: 'pdf' | 'docx';
  /** Parsing confidence score (0-1) */
  confidence: number;
}

/**
 * LinkedIn profile data
 * @see Requirements 7.3 - Retrieve public profile information from LinkedIn
 */
export interface LinkedInProfile {
  /** LinkedIn profile URL */
  profileUrl: string;
  /** Full name */
  name: string;
  /** Professional headline */
  headline: string;
  /** Summary/about section */
  summary: string;
  /** Profile photo URL */
  photoUrl?: string;
  /** Current location */
  location?: string;
  /** Work experience entries */
  experience: WorkExperience[];
  /** Education entries */
  education: Education[];
  /** Skills list */
  skills: string[];
  /** Certifications */
  certifications: Certification[];
  /** Number of connections */
  connectionCount?: number;
}

/**
 * Resume parsing error types
 * @see Requirements 7.5 - Display specific error details for parsing failures
 */
export type ResumeParseErrorType =
  | 'unsupported_format'   // File format not supported
  | 'corrupted_file'       // File is corrupted or unreadable
  | 'empty_content'        // File has no extractable content
  | 'encoding_error'       // Character encoding issues
  | 'password_protected'   // PDF is password protected
  | 'unknown';             // Unclassified error

/**
 * Resume parsing error
 */
export interface ResumeParseError {
  /** Error type classification */
  type: ResumeParseErrorType;
  /** User-friendly error message */
  message: string;
  /** Detailed error information for debugging */
  details?: string;
  /** Suggested actions to resolve */
  suggestions: string[];
}

/**
 * Result of resume parsing operation
 */
export interface ResumeParseResult {
  /** Whether parsing was successful */
  success: boolean;
  /** Parsed resume data if successful */
  data?: ParsedResume;
  /** Error information if failed */
  error?: ResumeParseError;
}

/**
 * User preferences for profile display
 */
export interface UserPreferences {
  /** PII items explicitly allowed for public display */
  piiAllowlist: string[];
  /** Sections to include on public website */
  visibleSections: string[];
  /** Featured projects to highlight */
  featuredProjects: string[];
  /** Custom ordering of experience entries */
  experienceOrder?: string[];
}
