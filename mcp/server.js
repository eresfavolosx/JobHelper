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
import { fileURLToPath } from 'node:url';

// Environment variables configuration
const USER_ID = process.env.NOVUJOBS_USER_ID || process.env.FIREBASE_USER_ID;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'jobhelper-c3cd7';
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const AUTH_TOKEN = process.env.NOVUJOBS_AUTH_TOKEN || process.env.FIREBASE_AUTH_TOKEN;

const VALID_DOC_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
const VALID_JOB_STATUSES = new Set([
    'wishlist', 'applied', 'screening', 'interviewing', 'offer', 'accepted', 'rejected', 'archived'
]);

function assertValidDocId(value, label = 'jobId') {
    if (typeof value !== 'string' || !VALID_DOC_ID_RE.test(value)) {
        throw new Error(`Invalid ${label}: must match /^[A-Za-z0-9_-]{1,100}$/.`);
    }
    return value;
}

function assertValidUserId(userId) {
    if (typeof userId !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(userId)) {
        throw new Error('NOVUJOBS_USER_ID is missing or invalid.');
    }
    return userId;
}

function sanitizeJobUrl(rawUrl) {
    if (typeof rawUrl !== 'string') return '';
    const trimmed = rawUrl.replace(/[\u0000-\u001F\u007F]/g, '').trim();
    if (!trimmed) return '';
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.href.slice(0, 2048);
        }
        return '';
    } catch {
        return '';
    }
}

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
                description: {
                    type: 'string',
                    description: 'Full job description text (up to 200,000 characters)'
                },
                notes: {
                    type: 'string',
                    description: 'Initial notes or referral contacts'
                }
            },
            required: ['company', 'role']
        }
    },
    {
        name: 'novujobs_update_job',
        description: 'Update the pipeline stage, notes, description, salary, or other attributes of an existing job application. Passing "" clears string fields.',
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
                description: {
                    type: 'string',
                    description: 'Full job description text (pass "" to clear)'
                },
                notes: {
                    type: 'string',
                    description: 'Updated notes (pass "" to clear)'
                },
                salary: {
                    type: 'string',
                    description: 'Updated salary compensation (pass "" to clear)'
                },
                location: {
                    type: 'string',
                    description: 'Updated location (pass "" to clear)'
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
        this.initPromise = this.init();
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
        await this.initPromise;
        const safeUserId = assertValidUserId(USER_ID);
        if (this.db) {
            const snapshot = await this.db.collection('users').doc(safeUserId).collection('jobs').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // Firestore REST API fallback
        return this.restFetchJobs();
    }

    async fetchJobById(jobId) {
        await this.initPromise;
        const safeUserId = assertValidUserId(USER_ID);
        const safeJobId = assertValidDocId(jobId, 'jobId');
        if (this.db) {
            const docSnap = await this.db.collection('users').doc(safeUserId).collection('jobs').doc(safeJobId).get();
            return docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null;
        }
        return this.restFetchJobById(safeJobId);
    }

    async restFetchJobById(jobId) {
        const safeUserId = assertValidUserId(USER_ID);
        const safeJobId = assertValidDocId(jobId, 'jobId');
        const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/(default)/documents/users/${encodeURIComponent(safeUserId)}/jobs/${encodeURIComponent(safeJobId)}`;
        const headers = { 'Content-Type': 'application/json' };
        if (AUTH_TOKEN) {
            headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
        }

        const res = await fetch(url, { headers });
        if (res.status === 404) {
            return null;
        }
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Firestore REST API returned ${res.status}: ${text}`);
        }
        const data = await res.json();
        return this.parseRestDocument(data);
    }

    async restFetchJobs() {
        const safeUserId = assertValidUserId(USER_ID);
        const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/(default)/documents/users/${encodeURIComponent(safeUserId)}/jobs`;
        const headers = { 'Content-Type': 'application/json' };
        if (AUTH_TOKEN) {
            headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
        }

        const allJobs = [];
        let pageToken = '';
        for (let page = 0; page < 100; page++) {
            const url = pageToken
                ? `${baseUrl}?pageSize=100&pageToken=${encodeURIComponent(pageToken)}`
                : `${baseUrl}?pageSize=100`;

            const res = await fetch(url, { headers });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Firestore REST API returned ${res.status}: ${text}`);
            }

            const data = await res.json();
            const documents = data.documents || [];
            for (const doc of documents) {
                allJobs.push(this.parseRestDocument(doc));
            }

            if (!data.nextPageToken) break;
            pageToken = data.nextPageToken;
        }
        return allJobs;
    }

    async addJob(jobData) {
        await this.initPromise;
        const safeUserId = assertValidUserId(USER_ID);
        const docId = assertValidDocId(`job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, 'jobId');
        const timestamp = new Date().toISOString();
        const status = VALID_JOB_STATUSES.has(jobData.status) ? jobData.status : 'applied';
        const cycleNumber = Number.isInteger(jobData.cycleNumber) && jobData.cycleNumber >= 1 && jobData.cycleNumber <= 10000
            ? jobData.cycleNumber
            : 1;
        const cleanJob = {
            id: docId,
            company: String(jobData.company || 'Unknown').slice(0, 200),
            role: String(jobData.role || 'Role').slice(0, 200),
            status,
            salary: String(jobData.salary || '').slice(0, 100),
            location: String(jobData.location || '').slice(0, 200),
            url: sanitizeJobUrl(jobData.url),
            description: String(jobData.description || '').slice(0, 200000),
            notes: String(jobData.notes || '').slice(0, 10000),
            cycleId: String(jobData.cycleId || 'cycle_1').slice(0, 100),
            cycleNumber,
            ...(status !== 'wishlist' && status !== 'archived' ? { appliedAt: timestamp } : {}),
            createdAt: timestamp,
            dateAdded: timestamp,
            updatedAt: timestamp,
            followUps: []
        };

        if (this.db) {
            await this.db.collection('users').doc(safeUserId).collection('jobs').doc(docId).set(cleanJob);
            return cleanJob;
        }

        // REST API write
        return this.restCreateJob(docId, cleanJob);
    }

    async updateJob(jobId, updates) {
        await this.initPromise;
        const safeUserId = assertValidUserId(USER_ID);
        const safeJobId = assertValidDocId(jobId, 'jobId');
        const nextUpdates = { ...updates, updatedAt: new Date().toISOString() };
        if (this.db) {
            await this.db.collection('users').doc(safeUserId).collection('jobs').doc(safeJobId).set(nextUpdates, { merge: true });
            const updated = await this.db.collection('users').doc(safeUserId).collection('jobs').doc(safeJobId).get();
            return { id: updated.id, ...updated.data() };
        }

        // REST API update
        return this.restPatchJob(safeJobId, nextUpdates);
    }

    async restCreateJob(docId, job) {
        const safeUserId = assertValidUserId(USER_ID);
        const safeDocId = assertValidDocId(docId, 'jobId');
        const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/(default)/documents/users/${encodeURIComponent(safeUserId)}/jobs?documentId=${encodeURIComponent(safeDocId)}`;
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
        const safeUserId = assertValidUserId(USER_ID);
        const safeJobId = assertValidDocId(jobId, 'jobId');
        const mask = Object.keys(updates).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
        const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/(default)/documents/users/${encodeURIComponent(safeUserId)}/jobs/${encodeURIComponent(safeJobId)}?${mask}`;
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

    parseRestValue(v) {
        if (!v || typeof v !== 'object') return v;
        if (v.stringValue !== undefined) return v.stringValue;
        if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
        if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
        if (v.booleanValue !== undefined) return v.booleanValue;
        if (v.timestampValue !== undefined) return v.timestampValue;
        if (v.nullValue !== undefined) return null;
        if (v.arrayValue !== undefined) {
            return (v.arrayValue.values || []).map(item => this.parseRestValue(item));
        }
        if (v.mapValue !== undefined) {
            return this.parseRestFields(v.mapValue.fields || {});
        }
        return v;
    }

    parseRestFields(fields) {
        const parsed = {};
        for (const [k, v] of Object.entries(fields || {})) {
            parsed[k] = this.parseRestValue(v);
        }
        return parsed;
    }

    parseRestDocument(doc) {
        const nameParts = (doc.name || '').split('/');
        const id = nameParts[nameParts.length - 1];
        const fields = doc.fields || {};
        return { id, ...this.parseRestFields(fields) };
    }

    formatRestValue(val) {
        if (val === null || val === undefined) {
            return { nullValue: null };
        }
        if (typeof val === 'string') {
            return { stringValue: val };
        }
        if (typeof val === 'number') {
            return Number.isInteger(val)
                ? { integerValue: String(val) }
                : { doubleValue: val };
        }
        if (typeof val === 'boolean') {
            return { booleanValue: val };
        }
        if (Array.isArray(val)) {
            return {
                arrayValue: {
                    values: val.map(item => this.formatRestValue(item))
                }
            };
        }
        if (typeof val === 'object') {
            return {
                mapValue: {
                    fields: this.formatRestFields(val)
                }
            };
        }
        return { stringValue: String(val) };
    }

    formatRestFields(data) {
        const fields = {};
        for (const [k, v] of Object.entries(data || {})) {
            fields[k] = this.formatRestValue(v);
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
                    const haystack = `${j.company || ''} ${j.role || ''} ${j.location || ''} ${j.notes || ''} ${j.description || ''}`.toLowerCase();
                    return haystack.includes(query);
                })
                .map(j => ({
                    id: j.id,
                    company: j.company,
                    role: j.role,
                    status: j.status,
                    location: j.location,
                    salary: j.salary,
                    notesPreview: (j.notes || '').slice(0, 160),
                    descriptionPreview: (j.description || '').slice(0, 200)
                }));

            return {
                query: args.query,
                matchCount: matches.length,
                results: matches
            };
        }

        case 'novujobs_get_job': {
            const safeJobId = assertValidDocId(args.jobId, 'jobId');
            const job = await db.fetchJobById(safeJobId);
            if (!job) {
                throw new Error(`Job application with ID "${safeJobId}" was not found.`);
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
            const safeJobId = assertValidDocId(args.jobId, 'jobId');
            const updates = {};
            if (args.status !== undefined) {
                if (!VALID_JOB_STATUSES.has(args.status)) {
                    throw new Error(`Invalid status: "${args.status}".`);
                }
                updates.status = args.status;
            }
            if (args.notes !== undefined) updates.notes = String(args.notes).slice(0, 10000);
            if (args.description !== undefined) updates.description = String(args.description).slice(0, 200000);
            if (args.salary !== undefined) updates.salary = String(args.salary).slice(0, 100);
            if (args.location !== undefined) updates.location = String(args.location).slice(0, 200);

            const updated = await db.updateJob(safeJobId, updates);
            return {
                success: true,
                message: `Successfully updated application "${safeJobId}".`,
                updates: updated
            };
        }

        case 'novujobs_log_follow_up': {
            const safeJobId = assertValidDocId(args.jobId, 'jobId');
            const job = await db.fetchJobById(safeJobId);
            if (!job) {
                throw new Error(`Job application with ID "${safeJobId}" was not found.`);
            }

            const todayStr = new Date().toISOString();
            const followUpEntry = {
                id: `fu_${Date.now()}`,
                date: todayStr,
                channel: args.channel || 'email',
                note: String(args.note || '').slice(0, 2000),
                createdAt: todayStr
            };

            const existingFollowUps = Array.isArray(job.followUps) ? job.followUps : [];
            const newFollowUps = [followUpEntry, ...existingFollowUps];

            await db.updateJob(safeJobId, {
                followUps: newFollowUps,
                lastFollowUpAt: todayStr,
                lastInteraction: todayStr,
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
let stdinQueue = Promise.resolve();

function enqueueJsonRpcLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;
    stdinQueue = stdinQueue
        .then(async () => {
            const msg = JSON.parse(trimmed);
            await handleJsonRpcMessage(msg);
        })
        .catch((err) => {
            console.error('[NovuJobs-MCP] Failed to process JSON-RPC message:', err);
        });
}

function startStdioServer() {
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // Retain remainder in buffer

        for (const line of lines) {
            enqueueJsonRpcLine(line);
        }
    });

    process.stdin.on('end', () => {
        if (buffer.trim()) {
            enqueueJsonRpcLine(buffer);
            buffer = '';
        }
    });

    // Log startup banner to stderr so stdout remains 100% pure JSON-RPC
    console.error('[NovuJobs-MCP] NovuJobs MCP Server running on stdio');
    console.error(`[NovuJobs-MCP] Target Project: ${PROJECT_ID} | User: ${USER_ID || '(pending config)'}`);
}

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

// Auto-start when executed directly from CLI or client config
const isDirectRun = Boolean(process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url)));
if (isDirectRun) {
    startStdioServer();
}

export { JobDatabase, TOOLS, handleToolCall, startStdioServer, db, assertValidDocId, sanitizeJobUrl };
