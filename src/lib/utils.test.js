import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml, sanitizeUrl } from './utils.js';

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

    it('should block javascript: scheme', () => {
      assert.equal(sanitizeUrl('javascript:alert(1)'), null);
    });

    it('should block schemes with control characters', () => {
      assert.equal(sanitizeUrl('\x01javascript:alert(1)'), null);
      assert.equal(sanitizeUrl('java\x01script:alert(1)'), null);
      assert.equal(sanitizeUrl('vbscript\x00:msgbox(1)'), null);
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
});
