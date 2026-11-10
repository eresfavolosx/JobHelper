#!/usr/bin/env node
/**
 * NovuJobs (JobHelper) Model Context Protocol (MCP) Server
 * 
 * Provides a secure, standardized MCP JSON-RPC 2.0 interface over stdio
 * to connect ChatGPT Desktop, Claude Desktop, Cursor, Antigravity, or any
 * MCP-compatible client with your job search pipeline.
 * 
 * Authentication modes supported:
 * 1. Firebase Admin SDK (via GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_KEY)
 * 2. Firestore REST API (via NOVUJOBS_USER_ID and optional FIREBASE_AUTH_TOKEN)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Environment variables configuration
const USER_ID = process.env.NOVUJOBS_USER_ID || process.env.FIREBASE_USER_ID;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'jobhelper-c3cd7';
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const AUTH_TOKEN = process.env.NOVUJOBS_AUTH_TOKEN || process.env.FIREBASE_AUTH_TOKEN;

// Validate configuration
if (!USER_ID) {
    console.error('[NovuJobs-MCP] Warning: NOVUJOBS_USER_ID is not set.');
    console.error('[NovuJobs-MCP] Set NOVUJOBS_USER_ID=<your-firebase-uid> in your client configuration environment variables.');
}

/**
 * Standard tool catalog metadata conforming to MCP schema specification.
 */
const TOOLS = [
    {
        name: 'novujobs_get_pipeline_summary',
        description: 'Get a comprehensive executive summary of your active job application pipeline, stage counts, and alert items (ghost alerts, follow-up windows).',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'novujobs_list_jobs',
        description: 'List tracked job applications with company, role, stage, salary, location, and dates. Can be filtered by pipeline stage.',
        inputSchema: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    description: 'Filter by stage: wishlist, applied, screening, interviewing, offer, accepted, rejected, archived, or all',
                    enum: ['all', 'wishlist', 'applied', 'screening', 'interviewing', 'offer', 'accepted', 'rejected', 'archived']
                },
                limit: {
                    type: 'integer',
                    description: 'Maximum number of applications to return (default: 25, max: 100)'
                }
            }
        }
    },
    {
        name: 'novujobs_search_jobs',
        description: 'Search tracked job applications across company name, role title, location, and notes.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search keyword (e.g. "Google", "AI Engineer", "Remote", "Austin")'
                }
            },
            required: ['query']
        }
    },
    {
        name: 'novujobs_get_job',
        description: 'Retrieve full details, notes, salary, recruiter info, and outreach history for a specific application ID.',
        inputSchema: {
            type: 'object',
            properties: {
                jobId: {
                    type: 'string',
                    description: 'The unique job document ID'
                }
            },
            required: ['jobId']
        }
    },
    {
        name: 'novujobs_add_job',
        description: 'Log and track a new job application into your NovuJobs command center.',
        inputSchema: {
            type: 'object',
            properties: {
                company: {
                    type: 'string',
                    description: 'Company name (e.g. "Anthropic", "Stripe")'
                },
                role: {
                    type: 'string',
                    description: 'Role title (e.g. "Software Engineer", "AI Researcher")'
                },
                status: {
                    type: 'string',
                    description: 'Initial pipeline stage (default: "applied")',
                    enum: ['wishlist', 'applied', 'screening', 'interviewing', 'offer', 'accepted', 'rejected']
                },
                salary: {
                    type: 'string',
                    description: 'Salary range or expected total comp (e.g. "$160k - $190k")'
                },
                location: {
                    type: 'string',
                    description: 'Location or Remote status (e.g. "San Francisco, CA", "Remote")'
                },
                url: {
                    type: 'string',
                    description: 'Job posting or application portal URL'
                },
                notes: {
                    type: 'string',
                    description: 'Initial notes, job description excerpt, or referral contacts'
                }
            },
            required: ['company', 'role']
        }
    },
    {
        name: 'novujobs_update_job',
        description: 'Update the pipeline stage, notes, salary, or other attributes of an existing job application.',
        inputSchema: {
            type: 'object',
            properties: {
                jobId: {
                    type: 'string',
                    description: 'The unique ID of the job application to update'
                },
                status: {
                    type: 'string',
                    description: 'New stage: wishlist, applied, screening, interviewing, offer, accepted, rejected, archived',
                    enum: ['wishlist', 'applied', 'screening', 'interviewing', 'offer', 'accepted', 'rejected', 'archived']
                },
                notes: {
                    type: 'string',
                    description: 'Updated or appended notes'
                },
                salary: {
                    type: 'string',
                    description: 'Updated salary compensation'
                },
                location: {
                    type: 'string',
                    description: 'Updated location'
                }
            },
            required: ['jobId']
        }
    },
    {
        name: 'novujobs_log_follow_up',
        description: 'Log an outreach or follow-up note for an application. Resets the inactivity timer and clears Ghost Alerts.',
        inputSchema: {
            type: 'object',
            properties: {
                jobId: {
                    type: 'string',
                    description: 'The unique ID of the job application'
                },
                channel: {
                    type: 'string',
                    description: 'Outreach channel: email, linkedin, phone, in-person, other (default: "email")',
                    enum: ['email', 'linkedin', 'phone', 'in-person', 'other']
                },
                note: {
                    type: 'string',
                    description: 'Summary of the follow-up message sent or recruiter response'
                }
            },
            required: ['jobId', 'note']
        }
    }
];

/**
 * Firestore Database Access Layer
 * Supports Firebase Admin SDK if service account is provided, or Firestore REST API fallback.
 */
class JobDatabase {
    constructor() {
        this.admin = null;
        this.db = null;
        this.init();
    }

    async init() {
        if (SERVICE_ACCOUNT_PATH && existsSync(resolve(SERVICE_ACCOUNT_PATH))) {
            try {
                const adminSdk = await import('firebase-admin');
                const serviceAccount = JSON.parse(readFileSync(resolve(SERVICE_ACCOUNT_PATH), 'utf8'));
                if (!adminSdk.default.apps.length) {
                    adminSdk.default.initializeApp({
                        credential: adminSdk.default.credential.cert(serviceAccount),
                        projectId: PROJECT_ID
                    });
                }
                this.admin = adminSdk.default;
                this.db = adminSdk.default.firestore();
                return;
            } catch (err) {
                console.error('[NovuJobs-MCP] Failed to initialize Firebase Admin SDK, falling back to REST API:', err.message);
            }
        }
    }

    async fetchAllJobs() {
        if (this.db && USER_ID) {
            const snapshot = await this.db.collection('users').doc(USER_ID).collection('jobs').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // Firestore REST API fallback
        return this.restFetchJobs();
    }

    async restFetchJobs() {
        if (!USER_ID) {
            throw new Error('NOVUJOBS_USER_ID environment variable is missing.');
        }

        const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${USER_ID}/jobs?pageSize=100`;
        const headers = { 'Content-Type': 'application/json' };
        if (AUTH_TOKEN) {
            headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
        }

        const res = await fetch(url, { headers });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Firestore REST API returned ${res.status}: ${text}`);
        }

        const data = await res.json();
        const documents = data.documents || [];
        return documents.map(doc => this.parseRestDocument(doc));
    }

    async addJob(jobData) {
        const docId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const timestamp = new Date().toISOString();
        const cleanJob = {
            id: docId,
            company: jobData.company || 'Unknown',
            role: jobData.role || 'Role',
            status: jobData.status || 'applied',
            salary: jobData.salary || '',
            location: jobData.location || '',
            url: jobData.url || '',
            notes: jobData.notes || '',
            createdAt: timestamp,
            dateAdded: timestamp,
            updatedAt: timestamp,
            followUps: []
        };

        if (this.db && USER_ID) {
            await this.db.collection('users').doc(USER_ID).collection('jobs').doc(docId).set(cleanJob);
            return cleanJob;
        }

        // REST API write
        return this.restCreateJob(docId, cleanJob);
    }

    async updateJob(jobId, updates) {
        updates.updatedAt = new Date().toISOString();
        if (this.db && USER_ID) {
            await this.db.collection('users').doc(USER_ID).collection('jobs').doc(jobId).set(updates, { merge: true });
            const updated = await this.db.collection('users').doc(USER_ID).collection('jobs').doc(jobId).get();
            return { id: updated.id, ...updated.data() };
        }

        // REST API update
        return this.restPatchJob(jobId, updates);
    }

    async restCreateJob(docId, job) {
        const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${USER_ID}/jobs?documentId=${docId}`;
        const fields = this.formatRestFields(job);
        const headers = { 'Content-Type': 'application/json' };
        if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ fields })
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to create job: ${text}`);
        }
        return job;
    }

    async restPatchJob(jobId, updates) {
        const mask = Object.keys(updates).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
        const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${USER_ID}/jobs/${jobId}?${mask}`;
        const fields = this.formatRestFields(updates);
        const headers = { 'Content-Type': 'application/json' };
        if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;

        const res = await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields })
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to update job: ${text}`);
        }
        return updates;
    }

    parseRestDocument(doc) {
        const nameParts = (doc.name || '').split('/');
        const id = nameParts[nameParts.length - 1];
        const fields = doc.fields || {};
        const parsed = { id };
        for (const [k, v] of Object.entries(fields)) {
            if (v.stringValue !== undefined) parsed[k] = v.stringValue;
            else if (v.integerValue !== undefined) parsed[k] = parseInt(v.integerValue, 10);
            else if (v.booleanValue !== undefined) parsed[k] = v.booleanValue;
            else if (v.timestampValue !== undefined) parsed[k] = v.timestampValue;
            else if (v.arrayValue !== undefined) {
                parsed[k] = (v.arrayValue.values || []).map(item => item.stringValue || item);
            }
        }
        return parsed;
    }

    formatRestFields(data) {
        const fields = {};
        for (const [k, v] of Object.entries(data)) {
            if (typeof v === 'string') fields[k] = { stringValue: v };
            else if (typeof v === 'number') fields[k] = { integerValue: String(v) };
            else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
            else if (Array.isArray(v)) {
                fields[k] = { arrayValue: { values: v.map(item => ({ stringValue: String(item) })) } };
            }
        }
        return fields;
    }
}

const db = new JobDatabase();

/**
 * Tool Execution Handlers
 */
async function handleToolCall(name, args) {
    switch (name) {
        case 'novujobs_get_pipeline_summary': {
            const jobs = await db.fetchAllJobs();
            const activeJobs = jobs.filter(j => j && j.status !== 'deleted');
            const now = Date.now();

            const byStage = {
                wishlist: 0,
                applied: 0,
                screening: 0,
                interviewing: 0,
                offer: 0,
                accepted: 0,
                rejected: 0,
                archived: 0
            };

            const ghostAlerts = [];
            const followUpAlerts = [];

            for (const j of activeJobs) {
                if (byStage[j.status] !== undefined) byStage[j.status]++;

                // Calculate days since last update or application
                const refTime = new Date(j.lastFollowUpAt || j.updatedAt || j.createdAt || j.dateAdded || now).getTime();
                const days = Math.floor((now - refTime) / (1000 * 60 * 60 * 24));

                if (['applied', 'screening'].includes(j.status)) {
                    if (days >= 10) {
                        ghostAlerts.push({ id: j.id, company: j.company, role: j.role, daysInactive: days });
                    } else if (days >= 5) {
                        followUpAlerts.push({ id: j.id, company: j.company, role: j.role, daysInactive: days });
                    }
                }
            }

            return {
                totalActiveApplications: activeJobs.length,
                pipelineStages: byStage,
                urgentAlerts: {
                    ghostAlertsCount: ghostAlerts.length,
                    ghostAlertsList: ghostAlerts,
                    followUpDueCount: followUpAlerts.length,
                    followUpDueList: followUpAlerts
                },
                healthStatus: ghostAlerts.length === 0 ? 'Optimal (No ghosted roles)' : 'Attention Required (Outreach recommended)'
            };
        }

        case 'novujobs_list_jobs': {
            const jobs = await db.fetchAllJobs();
            const filterStatus = args.status && args.status !== 'all' ? args.status : null;
            const limit = Math.min(100, Math.max(1, args.limit || 25));

            let filtered = jobs.filter(j => j && j.status !== 'deleted');
            if (filterStatus) {
                filtered = filtered.filter(j => j.status === filterStatus);
            }

            const results = filtered.slice(0, limit).map(j => ({
                id: j.id,
                company: j.company,
                role: j.role,
                status: j.status,
                salary: j.salary || 'Unspecified',
                location: j.location || 'Unspecified',
                url: j.url || null,
                dateAdded: j.createdAt || j.dateAdded || null,
                lastFollowUpAt: j.lastFollowUpAt || null
            }));

            return {
                totalMatching: filtered.length,
                returned: results.length,
                jobs: results
            };
        }

        case 'novujobs_search_jobs': {
            const query = (args.query || '').trim().toLowerCase();
            if (!query) return { results: [] };

            const jobs = await db.fetchAllJobs();
            const matches = jobs
                .filter(j => j && j.status !== 'deleted')
                .filter(j => {
                    const haystack = `${j.company || ''} ${j.role || ''} ${j.location || ''} ${j.notes || ''}`.toLowerCase();
                    return haystack.includes(query);
                })
                .map(j => ({
                    id: j.id,
                    company: j.company,
                    role: j.role,
                    status: j.status,
                    location: j.location,
                    salary: j.salary,
                    notesPreview: (j.notes || '').slice(0, 160)
                }));

            return {
                query: args.query,
                matchCount: matches.length,
                results: matches
            };
        }

        case 'novujobs_get_job': {
            const jobs = await db.fetchAllJobs();
            const job = jobs.find(j => j && j.id === args.jobId);
            if (!job) {
                throw new Error(`Job application with ID "${args.jobId}" was not found.`);
            }
            return job;
        }

        case 'novujobs_add_job': {
            const created = await db.addJob(args);
            return {
                success: true,
                message: `Successfully logged application for "${created.role}" at ${created.company} (${created.status}).`,
                job: created
            };
        }

        case 'novujobs_update_job': {
            const updates = {};
            if (args.status) updates.status = args.status;
            if (args.notes) updates.notes = args.notes;
            if (args.salary) updates.salary = args.salary;
            if (args.location) updates.location = args.location;

            const updated = await db.updateJob(args.jobId, updates);
            return {
                success: true,
                message: `Successfully updated application "${args.jobId}".`,
                updates: updated
            };
        }

        case 'novujobs_log_follow_up': {
            const jobs = await db.fetchAllJobs();
            const job = jobs.find(j => j && j.id === args.jobId);
            if (!job) {
                throw new Error(`Job application with ID "${args.jobId}" was not found.`);
            }

            const todayStr = new Date().toISOString();
            const followUpEntry = {
                id: `fu_${Date.now()}`,
                date: todayStr,
                channel: args.channel || 'email',
                note: args.note
            };

            const existingFollowUps = Array.isArray(job.followUps) ? job.followUps : [];
            const newFollowUps = [...existingFollowUps, followUpEntry];

            await db.updateJob(args.jobId, {
                followUps: newFollowUps,
                lastFollowUpAt: todayStr,
                updatedAt: todayStr
            });

            return {
                success: true,
                message: `Follow-up logged via ${args.channel || 'email'}. Ghost Alert cleared.`,
                followUp: followUpEntry
            };
        }

        default:
            throw new Error(`Unknown MCP tool name: "${name}"`);
    }
}

/**
 * Standard Model Context Protocol (MCP) JSON-RPC 2.0 stdio engine
 */
let buffer = '';

process.stdin.setEncoding('utf8');

process.stdin.on('data', async (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Retain remainder in buffer

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
            const msg = JSON.parse(trimmed);
            await handleJsonRpcMessage(msg);
        } catch (err) {
            console.error('[NovuJobs-MCP] Failed to parse JSON-RPC line:', err);
        }
    }
});

async function handleJsonRpcMessage(msg) {
    const { id, method, params } = msg;

    // Handle MCP Handshake
    if (method === 'initialize') {
        sendResponse(id, {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: {}
            },
            serverInfo: {
                name: 'novujobs-mcp-server',
                version: '1.0.0'
            }
        });
        return;
    }

    // Handle Client Notifications
    if (method === 'notifications/initialized') {
        // Handshake confirmed by client
        return;
    }

    if (method === 'ping') {
        sendResponse(id, {});
        return;
    }

    // Handle Tools Listing
    if (method === 'tools/list') {
        sendResponse(id, {
            tools: TOOLS
        });
        return;
    }

    // Handle Tool Execution
    if (method === 'tools/call') {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        try {
            const result = await handleToolCall(toolName, toolArgs);
            sendResponse(id, {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            });
        } catch (err) {
            sendResponse(id, {
                content: [
                    {
                        type: 'text',
                        text: `Error executing ${toolName}: ${err.message}`
                    }
                ],
                isError: true
            });
        }
        return;
    }

    // Method not recognized
    if (id !== undefined) {
        sendError(id, -32601, `Method not found: ${method}`);
    }
}

function sendResponse(id, result) {
    const out = JSON.stringify({
        jsonrpc: '2.0',
        id,
        result
    });
    process.stdout.write(out + '\n');
}

function sendError(id, code, message) {
    const out = JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: { code, message }
    });
    process.stdout.write(out + '\n');
}

// Log startup banner to stderr so stdout remains 100% pure JSON-RPC
console.error('[NovuJobs-MCP] NovuJobs MCP Server running on stdio');
console.error(`[NovuJobs-MCP] Target Project: ${PROJECT_ID} | User: ${USER_ID || '(pending config)'}`);
