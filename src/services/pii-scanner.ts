/**
 * PII Scanner Service
 * 
 * Detects and redacts Personally Identifiable Information (PII) from content.
 * @see Requirements 8.1, 8.2, 8.5 - Privacy and PII Protection
 * @see Requirements 8.3 - Configurable allowlist for approved PII
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Types of PII that can be detected
 */
export type PIIType = 'phone' | 'address' | 'ssn' | 'email' | 'dob' | 'financial';

/**
 * Allowlist entry with metadata
 */
export interface AllowlistEntry {
  /** The allowlisted value (normalized to lowercase) */
  value: string;
  /** Type of PII this entry represents */
  type?: PIIType;
  /** Optional description/reason for allowlisting */
  reason?: string;
  /** When the entry was added */
  addedAt: Date;
}

/**
 * Allowlist configuration for persistence
 */
export interface AllowlistConfig {
  /** Version of the allowlist format */
  version: string;
  /** When the allowlist was last modified */
  lastModified: Date;
  /** The allowlist entries */
  entries: AllowlistEntry[];
}

/**
 * Represents a detected PII item with its location and confidence
 */
export interface PIIItem {
  /** Type of PII detected */
  type: PIIType;
  /** The actual value detected */
  value: string;
  /** Position in the original content */
  position: { start: number; end: number };
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Result of a PII scan operation
 */
export interface PIIScanResult {
  /** Whether any PII was detected */
  hasPII: boolean;
  /** List of detected PII items */
  items: PIIItem[];
  /** Overall risk level based on detected PII */
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  /** Flag indicating content needs review before publishing */
  requiresReview: boolean;
}

/**
 * Configuration for PII detection patterns
 */
interface PIIPattern {
  type: PIIType;
  pattern: RegExp;
  confidence: number;
  description: string;
}

/**
 * PII Scanner class for detecting and redacting PII
 * 
 * @see Requirements 8.1 - Scan all generated content for PII patterns
 * @see Requirements 8.2 - Flag PII for user review before publishing
 * @see Requirements 8.3 - Configurable allowlist for approved PII
 * @see Requirements 8.5 - Automatically redact detected PII
 */
export class PIIScanner {
  private patterns: PIIPattern[];
  private allowlist: Map<string, AllowlistEntry>;
  private allowlistPath: string | null;

  constructor(allowlistPath?: string) {
    this.patterns = this.initializePatterns();
    this.allowlist = new Map<string, AllowlistEntry>();
    this.allowlistPath = allowlistPath || null;
  }

  /**
   * Initialize PII detection patterns
   * @see Requirements 8.1 - Detect phone numbers, addresses, SSN patterns
   */
  private initializePatterns(): PIIPattern[] {
    return [
      // Phone number patterns
      // Format: (XXX) XXX-XXXX
      {
        type: 'phone',
        pattern: /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/g,
        confidence: 0.95,
        description: 'Phone number in (XXX) XXX-XXXX format',
      },
      // Format: XXX-XXX-XXXX
      {
        type: 'phone',
        pattern: /\b\d{3}-\d{3}-\d{4}\b/g,
        confidence: 0.9,
        description: 'Phone number in XXX-XXX-XXXX format',
      },
      // Format: XXX.XXX.XXXX
      {
        type: 'phone',
        pattern: /\b\d{3}\.\d{3}\.\d{4}\b/g,
        confidence: 0.9,
        description: 'Phone number in XXX.XXX.XXXX format',
      },
      // Format: +1XXXXXXXXXX or +1 XXX XXX XXXX
      {
        type: 'phone',
        pattern: /\+1\s*\d{3}\s*\d{3}\s*\d{4}\b/g,
        confidence: 0.95,
        description: 'Phone number in +1XXXXXXXXXX format',
      },
      // Format: 1-XXX-XXX-XXXX
      {
        type: 'phone',
        pattern: /\b1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
        confidence: 0.9,
        description: 'Phone number in 1-XXX-XXX-XXXX format',
      },

      // SSN pattern: XXX-XX-XXXX
      {
        type: 'ssn',
        pattern: /\b\d{3}[-]\d{2}[-]\d{4}\b/g,
        confidence: 0.95,
        description: 'Social Security Number in XXX-XX-XXXX format',
      },
      // SSN without dashes (9 consecutive digits that look like SSN)
      {
        type: 'ssn',
        pattern: /\b(?!000|666|9\d{2})\d{3}(?!00)\d{2}(?!0000)\d{4}\b/g,
        confidence: 0.7,
        description: 'Potential SSN (9 consecutive digits)',
      },

      // Email pattern
      {
        type: 'email',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        confidence: 0.95,
        description: 'Email address',
      },

      // Address patterns - Street address with number
      {
        type: 'address',
        pattern: /\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl|Terrace|Ter|Highway|Hwy|Parkway|Pkwy)\.?\b/gi,
        confidence: 0.85,
        description: 'Street address',
      },
      // Address with city, state, zip
      {
        type: 'address',
        pattern: /\b[A-Za-z]+(?:\s+[A-Za-z]+)*,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g,
        confidence: 0.9,
        description: 'City, State ZIP format',
      },
      // Full address pattern (number + street + city + state + zip)
      {
        type: 'address',
        pattern: /\b\d{1,5}\s+[A-Za-z0-9\s,]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g,
        confidence: 0.95,
        description: 'Full address with ZIP code',
      },
      // PO Box
      {
        type: 'address',
        pattern: /\bP\.?O\.?\s*Box\s+\d+\b/gi,
        confidence: 0.9,
        description: 'PO Box address',
      },

      // Date of birth patterns
      // Format: MM/DD/YYYY or MM-DD-YYYY
      {
        type: 'dob',
        pattern: /\b(?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g,
        confidence: 0.8,
        description: 'Date in MM/DD/YYYY format',
      },
      // Format: YYYY-MM-DD (ISO format)
      {
        type: 'dob',
        pattern: /\b(?:19|20)\d{2}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01])\b/g,
        confidence: 0.75,
        description: 'Date in YYYY-MM-DD format',
      },
      // Written date format: Month DD, YYYY
      {
        type: 'dob',
        pattern: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(?:19|20)\d{2}\b/gi,
        confidence: 0.7,
        description: 'Date in Month DD, YYYY format',
      },
      // DOB with label
      {
        type: 'dob',
        pattern: /\b(?:DOB|Date\s+of\s+Birth|Birth\s*date|Born)[:\s]+[\d/\-]+\b/gi,
        confidence: 0.95,
        description: 'Labeled date of birth',
      },

      // Financial information patterns
      // Credit card numbers (major card formats)
      {
        type: 'financial',
        pattern: /\b(?:4\d{3}|5[1-5]\d{2}|6(?:011|5\d{2})|3[47]\d{2})[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
        confidence: 0.95,
        description: 'Credit card number',
      },
      // Credit card with spaces or dashes
      {
        type: 'financial',
        pattern: /\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b/g,
        confidence: 0.85,
        description: 'Potential credit card number (16 digits)',
      },
      // Bank account numbers (generic pattern - 8-17 digits)
      {
        type: 'financial',
        pattern: /(?:account|acct)\.?\s*(?:#\s*)?:?\s*\d{8,17}/gi,
        confidence: 0.9,
        description: 'Bank account number',
      },
      // Routing numbers (9 digits starting with valid ABA prefix)
      {
        type: 'financial',
        pattern: /\b(?:routing|ABA)\.?\s*#?\s*:?\s*\d{9}\b/gi,
        confidence: 0.9,
        description: 'Bank routing number',
      },
    ];
  }

  /**
   * Scans content for PII patterns
   * 
   * @param content - The text content to scan
   * @returns PIIScanResult with detected PII items and risk assessment
   * @see Requirements 8.1 - Scan all generated content for PII patterns
   * @see Requirements 8.2 - Flag PII for user review before publishing
   */
  async scan(content: string): Promise<PIIScanResult> {
    const items: PIIItem[] = [];
    const seenPositions = new Set<string>();

    for (const patternConfig of this.patterns) {
      // Reset regex lastIndex for global patterns
      patternConfig.pattern.lastIndex = 0;
      
      let match: RegExpExecArray | null;
      while ((match = patternConfig.pattern.exec(content)) !== null) {
        const value = match[0];
        const start = match.index;
        const end = start + value.length;
        
        // Create a position key to avoid duplicates
        const positionKey = `${start}-${end}`;
        
        // Skip if this position was already captured or if value is in allowlist
        if (seenPositions.has(positionKey) || this.isAllowlisted(value)) {
          continue;
        }
        
        // Check for overlapping matches and keep the one with higher confidence
        const overlapping = items.find(
          item => 
            (start >= item.position.start && start < item.position.end) ||
            (end > item.position.start && end <= item.position.end) ||
            (start <= item.position.start && end >= item.position.end)
        );
        
        if (overlapping) {
          // Keep the match with higher confidence
          if (patternConfig.confidence > overlapping.confidence) {
            const index = items.indexOf(overlapping);
            items.splice(index, 1);
            seenPositions.delete(`${overlapping.position.start}-${overlapping.position.end}`);
          } else {
            continue;
          }
        }
        
        seenPositions.add(positionKey);
        items.push({
          type: patternConfig.type,
          value,
          position: { start, end },
          confidence: patternConfig.confidence,
        });
      }
    }

    // Sort items by position
    items.sort((a, b) => a.position.start - b.position.start);

    const hasPII = items.length > 0;
    const riskLevel = this.calculateRiskLevel(items);

    return {
      hasPII,
      items,
      riskLevel,
      requiresReview: hasPII,
    };
  }

  /**
   * Scans multiple content strings for PII
   * 
   * @param contents - Array of text content to scan
   * @returns Array of PIIScanResult for each content
   */
  async scanBatch(contents: string[]): Promise<PIIScanResult[]> {
    return Promise.all(contents.map(content => this.scan(content)));
  }

  /**
   * Redacts PII from content by replacing detected items with placeholders
   * 
   * @param content - The original content
   * @param piiItems - Array of PII items to redact
   * @returns Content with PII replaced by redaction placeholders
   * @see Requirements 8.5 - Automatically redact detected PII
   */
  redact(content: string, piiItems: PIIItem[]): string {
    if (piiItems.length === 0) {
      return content;
    }

    // Sort items by position in reverse order to maintain correct positions during replacement
    const sortedItems = [...piiItems].sort((a, b) => b.position.start - a.position.start);
    
    let redactedContent = content;
    
    for (const item of sortedItems) {
      const placeholder = this.getRedactionPlaceholder(item.type);
      redactedContent = 
        redactedContent.slice(0, item.position.start) + 
        placeholder + 
        redactedContent.slice(item.position.end);
    }

    return redactedContent;
  }

  /**
   * Convenience method to scan and redact in one operation
   * 
   * @param content - The content to scan and redact
   * @returns Object containing the redacted content and scan result
   */
  async scanAndRedact(content: string): Promise<{ redactedContent: string; scanResult: PIIScanResult }> {
    const scanResult = await this.scan(content);
    const redactedContent = this.redact(content, scanResult.items);
    return { redactedContent, scanResult };
  }

  /**
   * Adds a value to the allowlist (will not be flagged as PII)
   * 
   * @param value - The value to allowlist
   * @param type - Optional PII type for the entry
   * @param reason - Optional reason for allowlisting
   * @see Requirements 8.3 - Configurable allowlist for approved PII
   */
  addToAllowlist(value: string, type?: PIIType, reason?: string): void {
    const normalizedValue = value.toLowerCase().trim();
    const entry: AllowlistEntry = {
      value: normalizedValue,
      type,
      reason,
      addedAt: new Date(),
    };
    this.allowlist.set(normalizedValue, entry);
  }

  /**
   * Removes a value from the allowlist
   * 
   * @param value - The value to remove from allowlist
   */
  removeFromAllowlist(value: string): void {
    this.allowlist.delete(value.toLowerCase().trim());
  }

  /**
   * Clears all entries from the allowlist
   */
  clearAllowlist(): void {
    this.allowlist.clear();
  }

  /**
   * Gets all allowlisted values
   * 
   * @returns Array of allowlisted values
   */
  getAllowlist(): string[] {
    return Array.from(this.allowlist.keys());
  }

  /**
   * Gets all allowlist entries with metadata
   * 
   * @returns Array of AllowlistEntry objects
   */
  getAllowlistEntries(): AllowlistEntry[] {
    return Array.from(this.allowlist.values());
  }

  /**
   * Gets a specific allowlist entry by value
   * 
   * @param value - The value to look up
   * @returns The AllowlistEntry if found, undefined otherwise
   */
  getAllowlistEntry(value: string): AllowlistEntry | undefined {
    return this.allowlist.get(value.toLowerCase().trim());
  }

  /**
   * Sets the allowlist from an array of values
   * 
   * @param values - Array of values to allowlist
   */
  setAllowlist(values: string[]): void {
    this.allowlist.clear();
    for (const value of values) {
      this.addToAllowlist(value);
    }
  }

  /**
   * Sets the allowlist from an array of entries with metadata
   * 
   * @param entries - Array of AllowlistEntry objects
   */
  setAllowlistEntries(entries: AllowlistEntry[]): void {
    this.allowlist.clear();
    for (const entry of entries) {
      const normalizedValue = entry.value.toLowerCase().trim();
      this.allowlist.set(normalizedValue, {
        ...entry,
        value: normalizedValue,
        addedAt: entry.addedAt instanceof Date ? entry.addedAt : new Date(entry.addedAt),
      });
    }
  }

  /**
   * Saves the allowlist to a file for persistence
   * 
   * @param filePath - Optional path to save to (uses constructor path if not provided)
   * @throws Error if no file path is available
   * @see Requirements 8.3 - Configurable allowlist for approved PII
   */
  async saveAllowlist(filePath?: string): Promise<void> {
    const targetPath = filePath || this.allowlistPath;
    if (!targetPath) {
      throw new Error('No file path specified for allowlist persistence');
    }

    const config: AllowlistConfig = {
      version: '1.0',
      lastModified: new Date(),
      entries: this.getAllowlistEntries(),
    };

    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(targetPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Loads the allowlist from a file
   * 
   * @param filePath - Optional path to load from (uses constructor path if not provided)
   * @returns True if loaded successfully, false if file doesn't exist
   * @throws Error if no file path is available or file is invalid
   * @see Requirements 8.3 - Configurable allowlist for approved PII
   */
  async loadAllowlist(filePath?: string): Promise<boolean> {
    const targetPath = filePath || this.allowlistPath;
    if (!targetPath) {
      throw new Error('No file path specified for allowlist persistence');
    }

    if (!fs.existsSync(targetPath)) {
      return false;
    }

    const content = await fs.promises.readFile(targetPath, 'utf-8');
    const config: AllowlistConfig = JSON.parse(content);

    if (!config.version || !Array.isArray(config.entries)) {
      throw new Error('Invalid allowlist file format');
    }

    this.setAllowlistEntries(config.entries);
    return true;
  }

  /**
   * Gets the configured allowlist file path
   * 
   * @returns The file path or null if not configured
   */
  getAllowlistPath(): string | null {
    return this.allowlistPath;
  }

  /**
   * Sets the allowlist file path for persistence
   * 
   * @param filePath - The file path to use for persistence
   */
  setAllowlistPath(filePath: string): void {
    this.allowlistPath = filePath;
  }

  /**
   * Checks if a value is in the allowlist
   * 
   * @param value - The value to check
   * @returns True if the value is allowlisted
   */
  isAllowlisted(value: string): boolean {
    return this.allowlist.has(value.toLowerCase().trim());
  }

  /**
   * Calculates the risk level based on detected PII items
   * 
   * @param items - Array of detected PII items
   * @returns Risk level assessment
   */
  private calculateRiskLevel(items: PIIItem[]): 'none' | 'low' | 'medium' | 'high' {
    if (items.length === 0) {
      return 'none';
    }

    // High risk PII types
    const highRiskTypes: PIIType[] = ['ssn', 'financial'];
    // Medium risk PII types
    const mediumRiskTypes: PIIType[] = ['address', 'dob'];
    // Low risk PII types
    const lowRiskTypes: PIIType[] = ['phone', 'email'];

    const hasHighRisk = items.some(item => highRiskTypes.includes(item.type));
    const hasMediumRisk = items.some(item => mediumRiskTypes.includes(item.type));
    const hasLowRisk = items.some(item => lowRiskTypes.includes(item.type));

    // Determine risk level based on highest risk type found
    if (hasHighRisk) {
      return 'high';
    }
    
    if (hasMediumRisk) {
      return 'medium';
    }
    
    // Multiple low-risk items elevate to medium risk
    if (hasLowRisk && items.length >= 3) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Gets the appropriate redaction placeholder for a PII type
   * 
   * @param type - The type of PII
   * @returns Redaction placeholder string
   */
  private getRedactionPlaceholder(type: PIIType): string {
    const placeholders: Record<PIIType, string> = {
      phone: '[PHONE REDACTED]',
      address: '[ADDRESS REDACTED]',
      ssn: '[SSN REDACTED]',
      email: '[EMAIL REDACTED]',
      dob: '[DOB REDACTED]',
      financial: '[FINANCIAL INFO REDACTED]',
    };
    return placeholders[type];
  }
}

// Export a default instance for convenience
export const piiScanner = new PIIScanner();
