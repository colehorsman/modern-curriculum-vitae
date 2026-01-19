# Requirements Document

## Introduction

The Career Showcase Platform is a personal portfolio and career management system designed to highlight professional work for prospective hiring agents, engineers, and potential employers in the AI/ML engineering space. The platform addresses the challenge of showcasing internal or private work that cannot be publicly shared by generating README summaries and abstracts. It combines a project portfolio generator, job scraper with knowledge base, personal website with neo-brutalism design, and resume/profile integration.

## Glossary

- **Platform**: The Career Showcase Platform system
- **Portfolio_Generator**: Component that connects to GitHub and generates project abstracts and landing pages
- **Job_Scraper**: Component that scrapes job listings from various sources and builds a knowledge base
- **Website_Builder**: Component that generates the personal showcase website
- **Profile_Integrator**: Component that connects to LinkedIn and GitHub for profile data
- **Knowledge_Base**: Local storage system for scraped job listings and metadata
- **Abstract**: A generated summary of a project suitable for public display
- **Landing_Page**: A visually appealing page showcasing a single project
- **PII**: Personally Identifiable Information (address, phone number, etc.)
- **Neo_Brutalism**: A design aesthetic characterized by bold colors, stark contrasts, and raw visual elements

## Requirements

### Requirement 1: GitHub Repository Connection

**User Story:** As a user, I want to connect my GitHub account to the platform, so that I can automatically import and showcase my repositories.

#### Acceptance Criteria

1. WHEN a user provides GitHub credentials or OAuth token, THE Platform SHALL authenticate and establish a connection to the GitHub API
2. WHEN connected to GitHub, THE Portfolio_Generator SHALL retrieve a list of all accessible repositories for the authenticated user
3. WHEN retrieving repositories, THE Portfolio_Generator SHALL capture repository metadata including name, description, languages, stars, forks, and last updated date
4. IF the GitHub API returns an error, THEN THE Platform SHALL display a descriptive error message and retry options
5. WHEN a repository is marked as private, THE Portfolio_Generator SHALL still retrieve metadata but flag it for abstract-only display

### Requirement 2: Project Abstract Generation

**User Story:** As a user, I want the platform to generate beautiful abstracts for my projects, so that I can showcase internal work without exposing sensitive code.

#### Acceptance Criteria

1. WHEN a repository is selected for abstract generation, THE Portfolio_Generator SHALL analyze the repository structure, README, and code patterns
2. WHEN generating an abstract, THE Portfolio_Generator SHALL produce a summary including project purpose, technologies used, key features, and impact metrics
3. WHEN a project is marked as internal/private, THE Portfolio_Generator SHALL generate an abstract that describes the work without exposing proprietary details
4. THE Portfolio_Generator SHALL format abstracts using consistent styling that matches the neo-brutalism aesthetic
5. WHEN an abstract is generated, THE Platform SHALL allow the user to edit and customize the content before publishing

### Requirement 3: Landing Page Generation

**User Story:** As a user, I want beautiful landing pages generated for each project, so that visitors can explore my work in an engaging way.

#### Acceptance Criteria

1. WHEN a project abstract is finalized, THE Portfolio_Generator SHALL generate a dedicated landing page for that project
2. THE Landing_Page SHALL include the project abstract, technology badges, visual elements, and links to public resources
3. THE Landing_Page SHALL follow the neo-brutalism design aesthetic with bold colors, stark contrasts, and clean typography
4. WHEN the source repository is public, THE Landing_Page SHALL include a link to the GitHub repository
5. WHEN the source repository is private, THE Landing_Page SHALL display only the abstract without repository links
6. THE Landing_Page SHALL be responsive and render correctly on desktop, tablet, and mobile devices

### Requirement 4: Job Scraping from Multiple Sources

**User Story:** As a user, I want to scrape job listings from LinkedIn, Indeed, and company websites, so that I can build a knowledge base of relevant opportunities.

#### Acceptance Criteria

1. WHEN a user initiates a job scrape, THE Job_Scraper SHALL connect to configured job sources (LinkedIn, Indeed, company career pages)
2. WHEN scraping job listings, THE Job_Scraper SHALL extract job title, company, location, description, requirements, and posting date
3. THE Job_Scraper SHALL store scraped jobs in the Knowledge_Base with deduplication based on job title and company
4. IF a job source blocks or rate-limits requests, THEN THE Job_Scraper SHALL implement exponential backoff and notify the user
5. WHEN scraping is complete, THE Job_Scraper SHALL report the number of new jobs found and any errors encountered

### Requirement 5: Job Knowledge Base Management

**User Story:** As a user, I want a local knowledge base of scraped jobs, so that I can search and filter opportunities matching my skillset.

#### Acceptance Criteria

1. THE Knowledge_Base SHALL store job listings with full metadata and timestamps
2. WHEN a user searches the Knowledge_Base, THE Platform SHALL return jobs matching the search query across title, company, and description fields
3. WHEN filtering jobs, THE Platform SHALL support filters for location, job type, experience level, and technology keywords
4. THE Knowledge_Base SHALL support filtering for AI/ML engineering roles based on keyword matching
5. WHEN a job listing is older than 30 days, THE Knowledge_Base SHALL mark it as potentially expired
6. THE Platform SHALL allow users to mark jobs as applied, interested, or dismissed

### Requirement 6: Personal Website Generation

**User Story:** As a user, I want a personal website that showcases my experience, projects, and volunteer work, so that potential employers can learn about me.

#### Acceptance Criteria

1. THE Website_Builder SHALL generate a personal website with sections for experience, projects, skills, and volunteer work
2. THE Website_Builder SHALL implement a neo-brutalism design aesthetic with bold colors and stark visual contrasts
3. THE Website_Builder SHALL NOT include a busy animated background (clean, focused design)
4. THE Website_Builder SHALL ensure the website is publicly accessible
5. THE Website_Builder SHALL exclude all PII including physical address and phone number from the public website
6. WHEN generating the website, THE Website_Builder SHALL include professional contact methods (email, LinkedIn, GitHub links only)

### Requirement 7: Resume and Profile Integration

**User Story:** As a user, I want to load my resume and connect my LinkedIn profile, so that the platform can use this information for content generation.

#### Acceptance Criteria

1. WHEN a user uploads a resume file, THE Profile_Integrator SHALL parse and extract work experience, education, skills, and achievements
2. THE Profile_Integrator SHALL support resume formats including PDF and DOCX
3. WHEN connected to LinkedIn, THE Profile_Integrator SHALL retrieve public profile information including headline, summary, and experience
4. THE Profile_Integrator SHALL merge data from resume and LinkedIn to create a unified profile
5. IF resume parsing fails, THEN THE Profile_Integrator SHALL display specific error details and allow manual entry

### Requirement 8: Privacy and PII Protection

**User Story:** As a user, I want my sensitive personal information protected, so that only professional details are publicly visible.

#### Acceptance Criteria

1. THE Platform SHALL scan all generated content for PII patterns (phone numbers, addresses, SSN patterns)
2. WHEN PII is detected in content, THE Platform SHALL flag it for user review before publishing
3. THE Platform SHALL maintain a configurable allowlist of information that can be publicly displayed
4. THE Platform SHALL store sensitive data locally and never transmit it to external services without explicit consent
5. WHEN generating public content, THE Platform SHALL automatically redact detected PII unless explicitly approved

### Requirement 9: Neo-Brutalism UI Design System

**User Story:** As a user, I want a consistent neo-brutalism design across the platform, so that my portfolio has a distinctive and memorable visual identity.

#### Acceptance Criteria

1. THE Website_Builder SHALL implement a design system with bold primary colors, thick borders, and high contrast elements
2. THE Website_Builder SHALL use clean, readable typography with strong visual hierarchy
3. THE Website_Builder SHALL implement interactive elements with obvious hover and click states
4. THE Website_Builder SHALL avoid subtle gradients, shadows, and soft edges in favor of flat, bold styling
5. THE Website_Builder SHALL ensure all design elements meet WCAG 2.1 AA accessibility standards for color contrast

### Requirement 10: Multi-Device Responsiveness

**User Story:** As a user, I want my portfolio website to work well on all devices, so that employers can view it on desktop or mobile.

#### Acceptance Criteria

1. THE Website_Builder SHALL generate responsive layouts that adapt to screen sizes from 320px to 2560px width
2. WHEN viewed on mobile devices, THE Website_Builder SHALL reorganize content into a single-column layout
3. THE Website_Builder SHALL ensure all interactive elements are touch-friendly with minimum 44px tap targets
4. THE Website_Builder SHALL optimize images and assets for fast loading on mobile networks
5. WHEN the viewport changes, THE Website_Builder SHALL smoothly transition between layout breakpoints

### Requirement 11: GitHub Profile Page Enhancement

**User Story:** As a user, I want a clean and professional GitHub profile landing page, so that visitors to my GitHub see a polished first impression.

#### Acceptance Criteria

1. THE Portfolio_Generator SHALL generate a GitHub profile README (special repository matching username)
2. THE Portfolio_Generator SHALL include a professional introduction, current focus areas, and tech stack in the profile README
3. THE Portfolio_Generator SHALL display featured projects with brief descriptions and links
4. THE Portfolio_Generator SHALL include professional contact links (LinkedIn, portfolio website, email)
5. THE Portfolio_Generator SHALL use clean formatting with badges, icons, and visual hierarchy
6. THE Portfolio_Generator SHALL avoid cluttered elements and maintain a minimalist, professional aesthetic similar to github.com/patrickwiloak
7. WHEN generating the profile README, THE Portfolio_Generator SHALL ensure content aligns with the neo-brutalism aesthetic of the main portfolio
