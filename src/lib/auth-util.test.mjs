import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyAuth } from './auth-util.js';

describe('auth-util', () => {
  describe('verifyAuth', () => {
    it('returns null if Authorization header is missing', async () => {
      const mockReq = {
        headers: new Headers()
      };
      const result = await verifyAuth(mockReq);
      assert.equal(result, null);
    });

    it('returns null if Authorization header does not start with Bearer', async () => {
      const mockReq = {
        headers: new Headers({
          'Authorization': 'Basic 123456'
        })
      };
      const result = await verifyAuth(mockReq);
      assert.equal(result, null);
    });

    it('returns null if Bearer token is empty', async () => {
      const mockReq = {
        headers: new Headers({
          'Authorization': 'Bearer '
        })
      };
      const result = await verifyAuth(mockReq);
      assert.equal(result, null);
    });
  });
});
