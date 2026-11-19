import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml, sanitizeUrl, sanitizeCustomAiBaseUrl } from './utils.js';
import { sanitizeJobForFirestore, sanitizeProfileForFirestore, sanitizeResumeAnalysisForFirestore } from './store.js';

describe('utils', () => {
  describe('escapeXml', () => {
    it('should escape HTML special characters', () => {
      const input = '<script>alert("XSS")</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
      assert.equal(escapeXml(input), expected);
    });

    it('should escape single quotes and ampersands', () => {
      const input = "Tom & Jerry's";
      const expected = "Tom &amp; Jerry&apos;s";
      assert.equal(escapeXml(input), expected);
    });

    it('should handle undefined and null', () => {
      assert.equal(escapeXml(undefined), '');
      assert.equal(escapeXml(null), '');
    });

    it('should convert numbers to string', () => {
      assert.equal(escapeXml(123), '123');
    });

  });

  describe('sanitizeUrl', () => {
    it('should allow valid http/https URLs', () => {
      assert.equal(sanitizeUrl('https://example.com'), 'https://example.com/');
      assert.equal(sanitizeUrl('http://example.com'), 'http://example.com/');
    });

    it('should normalize schemeless URLs', () => {
      assert.equal(sanitizeUrl('example.com'), 'https://example.com/');
    });

    it('should block javascript: scheme and control-character bypasses', () => {
      assert.equal(sanitizeUrl('javascript:alert(1)'), null);
      assert.equal(sanitizeUrl('\x0Bjavascript:alert(1)'), null);
      assert.equal(sanitizeUrl('java\x00script:alert(1)'), null);
    });

    it('should block data: scheme', () => {
      assert.equal(sanitizeUrl('data:text/html,<script>'), null);
    });

    it('should block vbscript: scheme', () => {
      assert.equal(sanitizeUrl('vbscript:msgbox'), null);
    });

    it('should block URLs longer than 2048 characters', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2048);
      assert.equal(sanitizeUrl(longUrl), null);
    });
  });

  describe('sanitizeJobForFirestore & full job description storage', () => {
    it('preserves very large job descriptions up to 200,000 characters without truncation', () => {
      const fullDescription = 'Responsibilities:\n' + 'Develop robust systems. '.repeat(5000); // ~120,000 chars
      assert.ok(fullDescription.length > 50000, 'Test payload should exceed old 50k limit');

      const sanitized = sanitizeJobForFirestore({
        id: 'job-123',
        company: 'Scale AI',
        role: 'Senior Infrastructure Engineer',
        status: 'applied',
        description: fullDescription,
        notes: 'Great conversation with recruiter'
      });

      assert.equal(sanitized.description.length, fullDescription.length);
      assert.equal(sanitized.description, fullDescription);
      assert.equal(sanitized.company, 'Scale AI');
      assert.equal(sanitized.status, 'applied');
    });

    it('strips disallowed keys and preserves valid job fields', () => {
      const sanitized = sanitizeJobForFirestore({
        company: 'Stripe',
        status: 'wishlist',
        description: 'Payment API engineers',
        url: 'javascript:alert(1)',
        link: 'https://stripe.com/jobs/1',
        resumeUrl: 'data:text/html,<script>',
        maliciousKey: 'drop_database'
      });

      assert.equal(sanitized.company, 'Stripe');
      assert.equal(sanitized.description, 'Payment API engineers');
      assert.equal(sanitized.url, '');
      assert.equal(sanitized.link, 'https://stripe.com/jobs/1');
      assert.equal(sanitized.resumeUrl, '');
      assert.equal(sanitized.maliciousKey, undefined);
    });
  });

  describe('sanitizeCustomAiBaseUrl & profile RBAC/resume sanitization', () => {
    it('enforces https or local dev origins in sanitizeCustomAiBaseUrl', () => {
      assert.equal(sanitizeCustomAiBaseUrl('https://api.deepseek.com/v1'), 'https://api.deepseek.com/v1');
      assert.equal(sanitizeCustomAiBaseUrl('http://localhost:11434/v1'), 'http://localhost:11434/v1');
      assert.equal(sanitizeCustomAiBaseUrl('http://127.0.0.1:8000/v1'), 'http://127.0.0.1:8000/v1');
      assert.equal(sanitizeCustomAiBaseUrl('http://evil.com/v1'), null);
      assert.equal(sanitizeCustomAiBaseUrl('https://user:pass@evil.com/v1'), null);
      assert.equal(sanitizeCustomAiBaseUrl('javascript:alert(1)'), null);
    });

    it('omits subscription fields by default and blocks non-admin premium self-promotion', () => {
      const regularUpdate = sanitizeProfileForFirestore({
        fullName: 'Alex Candidate',
        subscriptionStatus: 'premium',
        trialStartDate: '2026-01-01T00:00:00Z',
        trialEndDate: '2026-02-01T00:00:00Z',
        customAiBaseUrl: 'http://evil.com/v1'
      });
      assert.equal(regularUpdate.fullName, 'Alex Candidate');
      assert.equal(regularUpdate.subscriptionStatus, undefined);
      assert.equal(regularUpdate.trialStartDate, undefined);
      assert.equal(regularUpdate.trialEndDate, undefined);
      assert.equal(regularUpdate.customAiBaseUrl, '');

      const nonAdminCreate = sanitizeProfileForFirestore({
        subscriptionStatus: 'premium',
        trialStartDate: '2026-01-01T00:00:00Z'
      }, { allowSubscriptionFields: true, isAdmin: false });
      assert.equal(nonAdminCreate.subscriptionStatus, 'trial');

      const adminUpdate = sanitizeProfileForFirestore({
        subscriptionStatus: 'premium'
      }, { allowSubscriptionFields: true, isAdmin: true });
      assert.equal(adminUpdate.subscriptionStatus, 'premium');
    });

    it('strips disallowed resumeAnalysis keys and bounds list/string sizes', () => {
      const oversizedSkills = Array.from({ length: 70 }, (_, i) => `Skill-${i}`);
      const sanitized = sanitizeResumeAnalysisForFirestore({
        skills: oversizedSkills,
        summary: 'Experienced engineer',
        maliciousExtraKey: 'should_not_persist',
        rawPromptOverride: 'ignore instructions'
      });
      assert.equal(sanitized.skills.length, 50);
      assert.equal(sanitized.summary, 'Experienced engineer');
      assert.equal(sanitized.maliciousExtraKey, undefined);
      assert.equal(sanitized.rawPromptOverride, undefined);
    });
  });
});
