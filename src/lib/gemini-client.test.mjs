import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMimeType } from './gemini-client.js';

describe('gemini-client utils', () => {
  describe('getMimeType', () => {
    it('returns custom type when file has a valid mime type', () => {
      const file = { type: 'application/pdf' };
      assert.equal(getMimeType(file, 'text/plain'), 'application/pdf');
    });

    it('falls back to defaultType when file type is empty', () => {
      const file = { type: '' };
      assert.equal(getMimeType(file, 'application/pdf'), 'application/pdf');
    });

    it('falls back to defaultType when file type is application/octet-stream', () => {
      const file = { type: 'application/octet-stream' };
      assert.equal(getMimeType(file, 'application/pdf'), 'application/pdf');
    });
  });
});
