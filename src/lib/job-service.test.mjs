import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRSS, scoreJobsWithGemini } from './job-service.js';

describe('job-service', () => {
  describe('parseRSS', () => {
    it('correctly extracts items with standard tags', () => {
      const xml = `
        <rss version="2.0">
          <channel>
            <item>
              <title>Senior Growth Engineer</title>
              <link>https://example.com/job/1</link>
              <description>Full-time remote role</description>
              <pubDate>Mon, 12 Oct 2026 12:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>
      `;

      const result = parseRSS(xml);
      assert.equal(result.length, 1);
      assert.equal(result[0].title, 'Senior Growth Engineer');
      assert.equal(result[0].link, 'https://example.com/job/1');
      assert.equal(result[0].description, 'Full-time remote role');
      assert.equal(result[0].source, 'RSS');
    });

    it('handles CDATA wrapped fields', () => {
      const xml = `
        <rss>
          <item>
            <title><![CDATA[Technical PM & Growth]]></title>
            <link>https://example.com/job/2</link>
            <description><![CDATA[Leading AI & ad-tech roadmap]]></description>
          </item>
        </rss>
      `;

      const result = parseRSS(xml);
      assert.equal(result.length, 1);
      assert.equal(result[0].title, 'Technical PM & Growth');
      assert.equal(result[0].description, 'Leading AI & ad-tech roadmap');
    });

    it('returns empty array when no item tags exist', () => {
      const xml = '<rss><channel><title>Empty</title></channel></rss>';
      const result = parseRSS(xml);
      assert.deepEqual(result, []);
    });
  });

  describe('scoreJobsWithGemini', () => {
    it('returns original jobs array when empty jobs list is provided', async () => {
      const result = await scoreJobsWithGemini([], { targetRole: 'Engineer' });
      assert.deepEqual(result, []);
    });

    it('returns original jobs array when resumeData is missing', async () => {
      const jobs = [{ title: 'Dev' }];
      const result = await scoreJobsWithGemini(jobs, null);
      assert.deepEqual(result, jobs);
    });
  });
});
