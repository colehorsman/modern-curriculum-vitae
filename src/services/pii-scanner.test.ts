/**
 * Unit tests for PIIScanner
 * 
 * Tests PII detection and redaction functionality
 * @see Requirements 8.1, 8.2, 8.5 - Privacy and PII Protection
 * @see Requirements 8.3 - Configurable allowlist for approved PII
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PIIScanner, PIIType, AllowlistEntry } from './pii-scanner.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('PIIScanner', () => {
  let scanner: PIIScanner;

  beforeEach(() => {
    scanner = new PIIScanner();
  });

  describe('Phone Number Detection', () => {
    it('should detect phone numbers in (XXX) XXX-XXXX format', async () => {
      const content = 'Call me at (555) 123-4567 for more info.';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('phone');
      expect(result.items[0].value).toBe('(555) 123-4567');
      expect(result.items[0].confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should detect phone numbers in XXX-XXX-XXXX format', async () => {
      const content = 'My number is 555-123-4567.';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('phone');
      expect(result.items[0].value).toBe('555-123-4567');
    });

    it('should detect phone numbers in XXX.XXX.XXXX format', async () => {
      const content = 'Contact: 555.123.4567';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('phone');
      expect(result.items[0].value).toBe('555.123.4567');
    });

    it('should detect phone numbers in +1XXXXXXXXXX format', async () => {
      const content = 'International: +15551234567';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('phone');
      expect(result.items[0].value).toBe('+15551234567');
    });

    it('should detect phone numbers in 1-XXX-XXX-XXXX format', async () => {
      const content = 'Toll free: 1-800-555-1234';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items.some(item => item.type === 'phone')).toBe(true);
    });

    it('should detect multiple phone numbers', async () => {
      const content = 'Home: (555) 123-4567, Work: 555-987-6543';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      const phoneItems = result.items.filter(item => item.type === 'phone');
      expect(phoneItems.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('SSN Detection', () => {
    it('should detect SSN in XXX-XX-XXXX format', async () => {
      const content = 'SSN: 123-45-6789';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items.some(item => item.type === 'ssn')).toBe(true);
      const ssnItem = result.items.find(item => item.type === 'ssn');
      expect(ssnItem?.value).toBe('123-45-6789');
    });

    it('should have high confidence for SSN with dashes', async () => {
      const content = 'My SSN is 123-45-6789';
      const result = await scanner.scan(content);

      const ssnItem = result.items.find(item => item.type === 'ssn');
      expect(ssnItem?.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should flag SSN as high risk', async () => {
      const content = 'SSN: 123-45-6789';
      const result = await scanner.scan(content);

      expect(result.riskLevel).toBe('high');
    });
  });

  describe('Email Detection', () => {
    it('should detect standard email addresses', async () => {
      const content = 'Contact me at john.doe@example.com';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items.some(item => item.type === 'email')).toBe(true);
      const emailItem = result.items.find(item => item.type === 'email');
      expect(emailItem?.value).toBe('john.doe@example.com');
    });

    it('should detect emails with subdomains', async () => {
      const content = 'Email: user@mail.company.co.uk';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      const emailItem = result.items.find(item => item.type === 'email');
      expect(emailItem?.value).toBe('user@mail.company.co.uk');
    });

    it('should detect emails with plus signs', async () => {
      const content = 'Send to: user+tag@gmail.com';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      const emailItem = result.items.find(item => item.type === 'email');
      expect(emailItem?.value).toBe('user+tag@gmail.com');
    });
  });

  describe('Address Detection', () => {
    it('should detect street addresses', async () => {
      const content = 'I live at 123 Main Street';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items.some(item => item.type === 'address')).toBe(true);
    });

    it('should detect addresses with city, state, zip', async () => {
      const content = 'Located in Seattle, WA 98101';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      const addressItem = result.items.find(item => item.type === 'address');
      expect(addressItem).toBeDefined();
    });

    it('should detect full addresses', async () => {
      const content = 'Ship to: 456 Oak Avenue, Portland, OR 97201';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items.some(item => item.type === 'address')).toBe(true);
    });

    it('should detect PO Box addresses', async () => {
      const content = 'Mail to P.O. Box 12345';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      const addressItem = result.items.find(item => item.type === 'address');
      expect(addressItem).toBeDefined();
    });

    it('should detect various street types', async () => {
      const testCases = [
        '100 First Avenue',
        '200 Second Blvd',
        '300 Third Drive',
        '400 Fourth Lane',
        '500 Fifth Court',
      ];

      for (const content of testCases) {
        const result = await scanner.scan(content);
        expect(result.hasPII).toBe(true);
        expect(result.items.some(item => item.type === 'address')).toBe(true);
      }
    });
  });

  describe('Date of Birth Detection', () => {
    it('should detect dates in MM/DD/YYYY format', async () => {
      const content = 'Born on 01/15/1990';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items.some(item => item.type === 'dob')).toBe(true);
    });

    it('should detect dates in YYYY-MM-DD format', async () => {
      const content = 'DOB: 1990-01-15';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items.some(item => item.type === 'dob')).toBe(true);
    });

    it('should detect written date formats', async () => {
      const content = 'Birthday: January 15, 1990';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items.some(item => item.type === 'dob')).toBe(true);
    });

    it('should detect labeled DOB', async () => {
      const content = 'Date of Birth: 01/15/1990';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items.some(item => item.type === 'dob')).toBe(true);
    });
  });

  describe('Financial Information Detection', () => {
    it('should detect credit card numbers', async () => {
      const content = 'Card: 4111-1111-1111-1111';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items.some(item => item.type === 'financial')).toBe(true);
    });

    it('should detect credit card numbers with spaces', async () => {
      const content = 'Payment: 4111 1111 1111 1111';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items.some(item => item.type === 'financial')).toBe(true);
    });

    it('should detect bank account numbers', async () => {
      const content = 'Account #: 12345678901';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items.some(item => item.type === 'financial')).toBe(true);
    });

    it('should detect routing numbers', async () => {
      const content = 'Routing: 123456789';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items.some(item => item.type === 'financial')).toBe(true);
    });

    it('should flag financial info as high risk', async () => {
      const content = 'Card: 4111-1111-1111-1111';
      const result = await scanner.scan(content);

      expect(result.riskLevel).toBe('high');
    });
  });

  describe('Risk Level Calculation', () => {
    it('should return none risk level for clean content', async () => {
      const content = 'This is a clean text with no PII.';
      const result = await scanner.scan(content);

      expect(result.riskLevel).toBe('none');
      expect(result.hasPII).toBe(false);
    });

    it('should return low risk level for email only', async () => {
      const content = 'Contact: test@example.com';
      const result = await scanner.scan(content);

      expect(result.riskLevel).toBe('low');
    });

    it('should return medium risk level for address', async () => {
      const content = 'Address: 123 Main Street';
      const result = await scanner.scan(content);

      expect(result.riskLevel).toBe('medium');
    });

    it('should return high risk level for SSN', async () => {
      const content = 'SSN: 123-45-6789';
      const result = await scanner.scan(content);

      expect(result.riskLevel).toBe('high');
    });

    it('should elevate to medium risk with multiple low-risk items', async () => {
      const content = 'Email: a@b.com, Phone: 555-123-4567, Alt: c@d.com';
      const result = await scanner.scan(content);

      // With 3+ low-risk items, should be medium
      if (result.items.length >= 3) {
        expect(result.riskLevel).toBe('medium');
      }
    });
  });

  describe('Redaction', () => {
    it('should redact phone numbers', async () => {
      const content = 'Call me at (555) 123-4567';
      const result = await scanner.scan(content);
      const redacted = scanner.redact(content, result.items);

      expect(redacted).toBe('Call me at [PHONE REDACTED]');
      expect(redacted).not.toContain('555');
    });

    it('should redact SSN', async () => {
      const content = 'My SSN is 123-45-6789';
      const result = await scanner.scan(content);
      const redacted = scanner.redact(content, result.items);

      expect(redacted).toContain('[SSN REDACTED]');
      expect(redacted).not.toContain('123-45-6789');
    });

    it('should redact email addresses', async () => {
      const content = 'Email: john@example.com';
      const result = await scanner.scan(content);
      const redacted = scanner.redact(content, result.items);

      expect(redacted).toContain('[EMAIL REDACTED]');
      expect(redacted).not.toContain('john@example.com');
    });

    it('should redact multiple PII items', async () => {
      const content = 'Phone: (555) 123-4567, Email: test@example.com';
      const result = await scanner.scan(content);
      const redacted = scanner.redact(content, result.items);

      expect(redacted).toContain('[PHONE REDACTED]');
      expect(redacted).toContain('[EMAIL REDACTED]');
      expect(redacted).not.toContain('555');
      expect(redacted).not.toContain('test@example.com');
    });

    it('should return original content when no PII items provided', () => {
      const content = 'No PII here';
      const redacted = scanner.redact(content, []);

      expect(redacted).toBe(content);
    });

    it('should handle scanAndRedact convenience method', async () => {
      const content = 'Call (555) 123-4567';
      const { redactedContent, scanResult } = await scanner.scanAndRedact(content);

      expect(scanResult.hasPII).toBe(true);
      expect(redactedContent).toContain('[PHONE REDACTED]');
    });
  });

  describe('Allowlist', () => {
    it('should not flag allowlisted values', async () => {
      const email = 'public@company.com';
      scanner.addToAllowlist(email);

      const content = `Contact us at ${email}`;
      const result = await scanner.scan(content);

      expect(result.items.find(item => item.value === email)).toBeUndefined();
    });

    it('should be case-insensitive for allowlist', async () => {
      scanner.addToAllowlist('PUBLIC@COMPANY.COM');

      const content = 'Contact us at public@company.com';
      const result = await scanner.scan(content);

      expect(result.items.find(item => item.value === 'public@company.com')).toBeUndefined();
    });

    it('should remove values from allowlist', async () => {
      const email = 'test@example.com';
      scanner.addToAllowlist(email);
      scanner.removeFromAllowlist(email);

      const content = `Email: ${email}`;
      const result = await scanner.scan(content);

      expect(result.items.find(item => item.value === email)).toBeDefined();
    });

    it('should clear allowlist', async () => {
      scanner.addToAllowlist('a@b.com');
      scanner.addToAllowlist('c@d.com');
      scanner.clearAllowlist();

      expect(scanner.getAllowlist()).toHaveLength(0);
    });

    it('should set allowlist from array', () => {
      scanner.setAllowlist(['a@b.com', 'c@d.com']);

      expect(scanner.getAllowlist()).toHaveLength(2);
      expect(scanner.getAllowlist()).toContain('a@b.com');
      expect(scanner.getAllowlist()).toContain('c@d.com');
    });
  });

  describe('Batch Scanning', () => {
    it('should scan multiple contents', async () => {
      const contents = [
        'Phone: (555) 123-4567',
        'Email: test@example.com',
        'Clean content here',
      ];

      const results = await scanner.scanBatch(contents);

      expect(results).toHaveLength(3);
      expect(results[0].hasPII).toBe(true);
      expect(results[1].hasPII).toBe(true);
      expect(results[2].hasPII).toBe(false);
    });
  });

  describe('Position Tracking', () => {
    it('should track correct positions for PII items', async () => {
      const content = 'Call (555) 123-4567 now';
      const result = await scanner.scan(content);

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(content.substring(item.position.start, item.position.end)).toBe(item.value);
    });

    it('should sort items by position', async () => {
      const content = 'Email: a@b.com, Phone: (555) 123-4567';
      const result = await scanner.scan(content);

      for (let i = 1; i < result.items.length; i++) {
        expect(result.items[i].position.start).toBeGreaterThan(result.items[i - 1].position.start);
      }
    });
  });

  describe('Review Flag', () => {
    it('should set requiresReview to true when PII is found', async () => {
      const content = 'Phone: (555) 123-4567';
      const result = await scanner.scan(content);

      expect(result.requiresReview).toBe(true);
    });

    it('should set requiresReview to false when no PII is found', async () => {
      const content = 'Clean content with no PII';
      const result = await scanner.scan(content);

      expect(result.requiresReview).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', async () => {
      const result = await scanner.scan('');

      expect(result.hasPII).toBe(false);
      expect(result.items).toHaveLength(0);
      expect(result.riskLevel).toBe('none');
    });

    it('should handle content with only whitespace', async () => {
      const result = await scanner.scan('   \n\t  ');

      expect(result.hasPII).toBe(false);
      expect(result.items).toHaveLength(0);
    });

    it('should not flag partial matches', async () => {
      // This should not match as a phone number
      const content = 'Version 1.2.3.4';
      const result = await scanner.scan(content);

      expect(result.items.filter(item => item.type === 'phone')).toHaveLength(0);
    });

    it('should handle special characters in content', async () => {
      const content = 'Email: test@example.com! Phone: (555) 123-4567?';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle unicode content', async () => {
      const content = 'Téléphone: (555) 123-4567 日本語';
      const result = await scanner.scan(content);

      expect(result.hasPII).toBe(true);
      expect(result.items.some(item => item.type === 'phone')).toBe(true);
    });
  });

  describe('Allowlist Entries with Metadata', () => {
    it('should store allowlist entries with type and reason', () => {
      scanner.addToAllowlist('public@company.com', 'email', 'Company public email');

      const entry = scanner.getAllowlistEntry('public@company.com');
      expect(entry).toBeDefined();
      expect(entry?.type).toBe('email');
      expect(entry?.reason).toBe('Company public email');
      expect(entry?.addedAt).toBeInstanceOf(Date);
    });

    it('should get all allowlist entries with metadata', () => {
      scanner.addToAllowlist('email1@test.com', 'email', 'Test email 1');
      scanner.addToAllowlist('555-123-4567', 'phone', 'Office phone');

      const entries = scanner.getAllowlistEntries();
      expect(entries).toHaveLength(2);
      expect(entries.some(e => e.type === 'email')).toBe(true);
      expect(entries.some(e => e.type === 'phone')).toBe(true);
    });

    it('should set allowlist from entries array', () => {
      const entries: AllowlistEntry[] = [
        { value: 'test@example.com', type: 'email', reason: 'Test', addedAt: new Date() },
        { value: '555-111-2222', type: 'phone', reason: 'Office', addedAt: new Date() },
      ];

      scanner.setAllowlistEntries(entries);

      expect(scanner.getAllowlist()).toHaveLength(2);
      expect(scanner.getAllowlistEntry('test@example.com')?.type).toBe('email');
      expect(scanner.getAllowlistEntry('555-111-2222')?.type).toBe('phone');
    });

    it('should normalize values when setting entries', () => {
      const entries: AllowlistEntry[] = [
        { value: '  TEST@EXAMPLE.COM  ', type: 'email', addedAt: new Date() },
      ];

      scanner.setAllowlistEntries(entries);

      expect(scanner.getAllowlist()).toContain('test@example.com');
      expect(scanner.isAllowlisted('TEST@EXAMPLE.COM')).toBe(true);
    });
  });

  describe('Allowlist Persistence', () => {
    let tempDir: string;
    let tempFilePath: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pii-scanner-test-'));
      tempFilePath = path.join(tempDir, 'allowlist.json');
    });

    afterEach(() => {
      // Clean up temp files
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir);
      }
    });

    it('should save allowlist to file', async () => {
      scanner.addToAllowlist('test@example.com', 'email', 'Test email');
      scanner.addToAllowlist('555-123-4567', 'phone', 'Office phone');

      await scanner.saveAllowlist(tempFilePath);

      expect(fs.existsSync(tempFilePath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(tempFilePath, 'utf-8'));
      expect(content.version).toBe('1.0');
      expect(content.entries).toHaveLength(2);
      expect(content.lastModified).toBeDefined();
    });

    it('should load allowlist from file', async () => {
      // First save
      scanner.addToAllowlist('saved@example.com', 'email', 'Saved email');
      await scanner.saveAllowlist(tempFilePath);

      // Create new scanner and load
      const newScanner = new PIIScanner();
      const loaded = await newScanner.loadAllowlist(tempFilePath);

      expect(loaded).toBe(true);
      expect(newScanner.getAllowlist()).toContain('saved@example.com');
      expect(newScanner.getAllowlistEntry('saved@example.com')?.type).toBe('email');
    });

    it('should return false when loading non-existent file', async () => {
      const loaded = await scanner.loadAllowlist(path.join(tempDir, 'nonexistent.json'));
      expect(loaded).toBe(false);
    });

    it('should throw error when saving without file path', async () => {
      await expect(scanner.saveAllowlist()).rejects.toThrow('No file path specified');
    });

    it('should throw error when loading without file path', async () => {
      await expect(scanner.loadAllowlist()).rejects.toThrow('No file path specified');
    });

    it('should use constructor path for persistence', async () => {
      const scannerWithPath = new PIIScanner(tempFilePath);
      scannerWithPath.addToAllowlist('constructor@test.com', 'email');

      await scannerWithPath.saveAllowlist();

      expect(fs.existsSync(tempFilePath)).toBe(true);

      const newScanner = new PIIScanner(tempFilePath);
      await newScanner.loadAllowlist();
      expect(newScanner.getAllowlist()).toContain('constructor@test.com');
    });

    it('should get and set allowlist path', () => {
      expect(scanner.getAllowlistPath()).toBeNull();

      scanner.setAllowlistPath(tempFilePath);
      expect(scanner.getAllowlistPath()).toBe(tempFilePath);
    });

    it('should throw error for invalid allowlist file format', async () => {
      fs.writeFileSync(tempFilePath, JSON.stringify({ invalid: 'format' }), 'utf-8');

      await expect(scanner.loadAllowlist(tempFilePath)).rejects.toThrow('Invalid allowlist file format');
    });

    it('should create directory if it does not exist', async () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'allowlist.json');
      scanner.addToAllowlist('test@example.com');

      await scanner.saveAllowlist(nestedPath);

      expect(fs.existsSync(nestedPath)).toBe(true);

      // Clean up nested directories
      fs.unlinkSync(nestedPath);
      fs.rmdirSync(path.join(tempDir, 'nested', 'dir'));
      fs.rmdirSync(path.join(tempDir, 'nested'));
    });

    it('should preserve entry dates when loading', async () => {
      const originalDate = new Date('2023-01-15T10:30:00Z');
      const entries: AllowlistEntry[] = [
        { value: 'test@example.com', type: 'email', addedAt: originalDate },
      ];
      scanner.setAllowlistEntries(entries);
      await scanner.saveAllowlist(tempFilePath);

      const newScanner = new PIIScanner();
      await newScanner.loadAllowlist(tempFilePath);

      const loadedEntry = newScanner.getAllowlistEntry('test@example.com');
      expect(loadedEntry?.addedAt).toBeInstanceOf(Date);
      expect(loadedEntry?.addedAt.toISOString()).toBe(originalDate.toISOString());
    });
  });

  describe('isAllowlisted public method', () => {
    it('should check if value is allowlisted', () => {
      scanner.addToAllowlist('test@example.com');

      expect(scanner.isAllowlisted('test@example.com')).toBe(true);
      expect(scanner.isAllowlisted('TEST@EXAMPLE.COM')).toBe(true);
      expect(scanner.isAllowlisted('other@example.com')).toBe(false);
    });

    it('should handle whitespace in isAllowlisted check', () => {
      scanner.addToAllowlist('test@example.com');

      expect(scanner.isAllowlisted('  test@example.com  ')).toBe(true);
    });
  });
});
