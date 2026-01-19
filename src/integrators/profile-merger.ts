/**
 * Profile Merger
 * 
 * Merges resume and LinkedIn data into unified profile.
 * @see Requirements 7.4
 */

import type { 
  UnifiedProfile, ParsedResume, LinkedInProfile, 
  WorkExperience, Education, Skill, ContactInfo 
} from '../types/profile.js';

/**
 * ProfileMerger class
 */
export class ProfileMerger {
  /**
   * Merges resume and LinkedIn data
   * @see Requirements 7.4
   */
  mergeProfiles(
    resume: ParsedResume | null,
    linkedin: LinkedInProfile | null
  ): UnifiedProfile {
    const experience = this.mergeExperience(
      resume?.experience ?? [],
      linkedin?.experience ?? []
    );

    const education = this.mergeEducation(
      resume?.education ?? [],
      linkedin?.education ?? []
    );

    const skills = this.mergeSkills(
      resume?.skills ?? [],
      linkedin?.skills ?? []
    );

    const contactInfo: ContactInfo = {
      email: resume?.email ?? '',
      linkedIn: linkedin?.profileUrl ?? '',
      github: '',
      phone: resume?.phone,
      address: resume?.address,
    };

    return {
      name: linkedin?.name ?? resume?.name ?? 'Unknown',
      headline: linkedin?.headline ?? '',
      summary: linkedin?.summary ?? resume?.summary ?? '',
      experience,
      education,
      skills,
      certifications: [
        ...(resume?.certifications ?? []),
        ...(linkedin?.certifications ?? []),
      ],
      volunteerWork: [],
      contactInfo,
    };
  }

  private mergeExperience(
    resumeExp: WorkExperience[],
    linkedinExp: WorkExperience[]
  ): WorkExperience[] {
    const merged = new Map<string, WorkExperience>();

    // Add resume experience
    for (const exp of resumeExp) {
      const key = `${exp.company.toLowerCase()}|${exp.startDate.getTime()}`;
      merged.set(key, exp);
    }

    // Merge LinkedIn experience (prefer LinkedIn for overlaps)
    for (const exp of linkedinExp) {
      const key = `${exp.company.toLowerCase()}|${exp.startDate.getTime()}`;
      if (merged.has(key)) {
        // Merge details
        const existing = merged.get(key)!;
        merged.set(key, {
          ...existing,
          description: exp.description || existing.description,
          highlights: [...new Set([...existing.highlights, ...exp.highlights])],
        });
      } else {
        merged.set(key, exp);
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  }

  private mergeEducation(
    resumeEdu: Education[],
    linkedinEdu: Education[]
  ): Education[] {
    const merged = new Map<string, Education>();

    for (const edu of [...resumeEdu, ...linkedinEdu]) {
      const key = `${edu.institution.toLowerCase()}|${edu.degree.toLowerCase()}`;
      if (!merged.has(key)) {
        merged.set(key, edu);
      }
    }

    return Array.from(merged.values());
  }

  private mergeSkills(
    resumeSkills: Skill[],
    linkedinSkills: string[]
  ): Skill[] {
    const skillMap = new Map<string, Skill>();

    for (const skill of resumeSkills) {
      skillMap.set(skill.name.toLowerCase(), skill);
    }

    for (const skillName of linkedinSkills) {
      if (!skillMap.has(skillName.toLowerCase())) {
        skillMap.set(skillName.toLowerCase(), {
          name: skillName,
          category: 'tool',
          proficiency: 'intermediate',
          yearsOfExperience: 1,
        });
      }
    }

    return Array.from(skillMap.values());
  }
}

export const profileMerger = new ProfileMerger();
