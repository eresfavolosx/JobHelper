import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('NovuJobs MCP Server Protocol Test Suite', async (t) => {
    const serverPath = resolve(__dirname, 'server.js');

    await t.test('1. Server starts and answers MCP initialize handshake', async () => {
        const child = spawn(process.execPath, [serverPath], {
            env: {
                ...process.env,
                NOVUJOBS_USER_ID: 'test_user_123',
                FIREBASE_PROJECT_ID: 'jobhelper-c3cd7'
            },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        const responses = [];
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            const lines = chunk.trim().split('\n');
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        responses.push(JSON.parse(line.trim()));
                    } catch {
                        // ignore
                    }
                }
            }
        });

        // Send initialize
        const initReq = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'test-client', version: '1.0.0' }
            }
        }) + '\n';

        child.stdin.write(initReq);

        await new Promise(r => setTimeout(r, 600));

        const initRes = responses.find(r => r.id === 1);
        assert.ok(initRes, 'Expected response for id: 1');
        assert.equal(initRes.result.serverInfo.name, 'novujobs-mcp-server');
        assert.equal(initRes.result.protocolVersion, '2024-11-05');
        assert.ok(initRes.result.capabilities.tools);

        // Send tools/list
        const toolsReq = JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {}
        }) + '\n';

        child.stdin.write(toolsReq);

        await new Promise(r => setTimeout(r, 600));

        const toolsRes = responses.find(r => r.id === 2);
        assert.ok(toolsRes, 'Expected response for id: 2');
        assert.ok(Array.isArray(toolsRes.result.tools));
        
        const toolNames = toolsRes.result.tools.map(t => t.name);
        assert.ok(toolNames.includes('novujobs_get_pipeline_summary'));
        assert.ok(toolNames.includes('novujobs_list_jobs'));
        assert.ok(toolNames.includes('novujobs_search_jobs'));
        assert.ok(toolNames.includes('novujobs_add_job'));
        assert.ok(toolNames.includes('novujobs_update_job'));
        assert.ok(toolNames.includes('novujobs_log_follow_up'));

        child.kill();
    });

    await t.test('2. Server handles ping message gracefully', async () => {
        const child = spawn(process.execPath, [serverPath], {
            env: {
                ...process.env,
                NOVUJOBS_USER_ID: 'test_user_123'
            },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        const responses = [];
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            const lines = chunk.trim().split('\n');
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        responses.push(JSON.parse(line.trim()));
                    } catch {}
                }
            }
        });

        const pingReq = JSON.stringify({
            jsonrpc: '2.0',
            id: 99,
            method: 'ping'
        }) + '\n';

        child.stdin.write(pingReq);
        await new Promise(r => setTimeout(r, 500));

        const pingRes = responses.find(r => r.id === 99);
        assert.ok(pingRes);
        assert.deepEqual(pingRes.result, {});

        child.kill();
    });

    await t.test('3. Firestore REST value serializer handles nested followUps correctly', async () => {
        const { JobDatabase } = await import('./server.js');
        const dbInstance = new JobDatabase();

        const rawData = {
            company: 'Anthropic',
            role: 'Research Engineer',
            status: 'interviewing',
            salary: '$220,000',
            active: true,
            attempts: 3,
            followUps: [
                {
                    id: 'fu_1700000001',
                    date: '2026-11-09T18:00:00Z',
                    channel: 'email',
                    note: 'Followed up with recruiter Sarah'
                },
                {
                    id: 'fu_1700000002',
                    date: '2026-11-10T09:30:00Z',
                    channel: 'linkedin',
                    note: 'Sent portfolio link'
                }
            ]
        };

        const restFields = dbInstance.formatRestFields(rawData);

        // Verify string and primitives
        assert.equal(restFields.company.stringValue, 'Anthropic');
        assert.equal(restFields.active.booleanValue, true);
        assert.equal(restFields.attempts.integerValue, '3');

        // Verify array of maps is properly structured, NOT stringified as "[object Object]"
        assert.ok(restFields.followUps.arrayValue, 'followUps should have arrayValue');
        assert.equal(restFields.followUps.arrayValue.values.length, 2);

        const firstItem = restFields.followUps.arrayValue.values[0];
        assert.ok(firstItem.mapValue, 'Array item should be a mapValue, not stringValue');
        assert.equal(firstItem.mapValue.fields.channel.stringValue, 'email');
        assert.equal(firstItem.mapValue.fields.note.stringValue, 'Followed up with recruiter Sarah');

        // Now test round-trip parsing back into clean JS object
        const mockDoc = {
            name: 'projects/jobhelper-c3cd7/databases/(default)/documents/users/test_user/jobs/job_test_123',
            fields: restFields
        };

        const parsed = dbInstance.parseRestDocument(mockDoc);
        assert.equal(parsed.id, 'job_test_123');
        assert.equal(parsed.company, 'Anthropic');
        assert.equal(parsed.active, true);
        assert.equal(parsed.attempts, 3);
        assert.equal(parsed.followUps.length, 2);
        assert.equal(parsed.followUps[0].channel, 'email');
        assert.equal(parsed.followUps[0].note, 'Followed up with recruiter Sarah');
        assert.equal(parsed.followUps[1].channel, 'linkedin');
    });
});
