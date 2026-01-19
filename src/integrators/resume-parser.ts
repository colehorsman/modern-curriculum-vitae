/**
 * Resume Parser
 * 
 * Parses resume files (PDF, DOCX) to extract profile data.
 * @see Requirements 7.1, 7.2, 7.5
 */

import type { 
  ParsedResume, WorkExperience, Education, Skill, 
  ResumeParseResult, ResumeParseError 
} from '../types/profile.js';

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * ResumeParser class
 */
export class ResumeParser {
  /**
   * Parses a resume file
   * @see Requirements 7.1, 7.2
   */
  async parseResume(
    fileBuffer: Buffer,
    filename: string
  ): Promise<ResumeParseResult> {
    const ext = filename.toLowerCase().split('.').pop();
    
    if (ext !== 'pdf' && ext !== 'docx') {
      return {
        success: false,
        error: {
          type: 'unsupported_format',
          message: `Unsupported file format: .${ext}`,
          suggestions: ['Please upload a PDF or DOCX file'],
        },
      };
    }

    try {
      let text: string;
      
      if (ext === 'pdf') {
        text = await this.parsePDF(fileBuffer);
      } else {
        text = await this.parseDOCX(fileBuffer);
      }

      if (!text || text.trim().length === 0) {
        return {
          success: false,
          error: {
            type: 'empty_content',
            message: 'No text content found in the file',
            suggestions: ['Ensure the file contains readable text'],
          },
        };
      }

      const parsed = this.extractData(text, ext as 'pdf' | 'docx');
      return { success: true, data: parsed };
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'corrupted_file',
          message: error instanceof Error ? error.message : 'Failed to parse file',
          details: String(error),
          suggestions: ['Try re-saving the file', 'Check if the file is corrupted'],
        },
      };
    }
  }

  private async parsePDF(buffer: Buffer): Promise<string> {
    // Would use pdf-parse library
    // For now, return placeholder
    return buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ');
  }

  private async parseDOCX(buffer: Buffer): Promise<string> {
    // Would use mammoth library
    return buffer.toString('utf-8').replace(/[^\x20-\x7E\n]/g, ' ');
  }

  private extractData(text: string, format: 'pdf' | 'docx'): ParsedResume {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Basic extraction - would be more sophisticated in production
    const name = lines[0] || 'Unknown';
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    const phoneMatch = text.match(/[\d-()+ ]{10,}/);

    return {
      name,
      email: emailMatch?.[0],
      phone: phoneMatch?.[0],
      summary: lines.slice(1, 3).join(' '),
      experience: this.extractExperience(text),
      education: this.extractEducation(text),
      skills: this.extractSkills(text),
      certifications: [],
      rawText: text,
      sourceFormat: format,
      confidence: 0.7,
    };
  }

  private extractExperience(text: string): WorkExperience[] {
    // Simplified extraction
    return [];
  }

  private extractEducation(text: string): Education[] {
    return [];
  }

  private extractSkills(text: string): Skill[] {
    const skillKeywords = ['JavaScript', 'TypeScript', 'Python', 'React', 'Node.js', 'AWS', 'Docker'];
    return skillKeywords
      .filter(skill => text.toLowerCase().includes(skill.toLowerCase()))
      .map(name => ({
        name,
        category: 'language' as const,
        proficiency: 'intermediate' as const,
        yearsOfExperience: 2,
      }));
  }
}

export const resumeParser = new ResumeParser();
