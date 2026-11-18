import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml, sanitizeUrl } from './utils.js';
import { sanitizeJobForFirestore } from './store.js';

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
        maliciousKey: 'drop_database'
      });

      assert.equal(sanitized.company, 'Stripe');
      assert.equal(sanitized.description, 'Payment API engineers');
      assert.equal(sanitized.maliciousKey, undefined);
    });
  });
});
