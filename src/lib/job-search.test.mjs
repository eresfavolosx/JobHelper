import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseSearchQuery,
    evaluateJobMatch,
    extractJobFacets,
    sortJobsList,
    getJobRecencyTimestamp,
    formatRelativeSearchDate,
    extractMatchSnippet,
    STAGE_LABELS
} from './job-search.js';

const SAMPLE_JOBS = [
    {
        id: '1',
        role: 'AI Safety Fellow',
        company: 'Anthropic',
        location: 'San Francisco, CA (Hybrid)',
        status: 'interviewing',
        salary: '$185,000',
        resumeName: 'AI_Safety_Resume_v3.pdf',
        notes: 'Working on alignment and constitutional AI evaluations',
        updatedAt: '2026-10-20T12:00:00Z'
    },
    {
        id: '2',
        role: 'Senior Full Stack Engineer',
        company: 'Stripe',
        location: 'Remote',
        status: 'applied',
        salary: '$210,000',
        resumeName: 'FullStack_Resume.pdf',
        notes: 'Payments infrastructure team referral',
        updatedAt: '2026-10-10T12:00:00Z'
    },
    {
        id: '3',
        role: 'Product Engineer',
        company: 'Anthropic',
        location: 'London, UK',
        status: 'wishlist',
        salary: '',
        resumeName: '',
        notes: 'Claude workbench team',
        updatedAt: '2026-10-19T12:00:00Z'
    }
];

describe('Multi-Parameter Job Search & Facet Engine', () => {
    it('parses structured field prefix tokens and free-text terms', () => {
        const parsed = parseSearchQuery('company:Anthropic location:"San Francisco" desc:"reinforcement learning" fellowship');
        assert.equal(parsed.fieldFilters.length, 3);
        assert.deepEqual(parsed.fieldFilters[0], { field: 'company', value: 'anthropic' });
        assert.deepEqual(parsed.fieldFilters[1], { field: 'location', value: 'san francisco' });
        assert.deepEqual(parsed.fieldFilters[2], { field: 'description', value: 'reinforcement learning' });
        assert.deepEqual(parsed.textTokens, ['fellowship']);
    });

    it('matches jobs by full job description content', () => {
        const jobWithDesc = {
            id: '5',
            role: 'ML Engineer',
            company: 'Google DeepMind',
            location: 'Mountain View, CA',
            status: 'applied',
            description: 'Looking for experts in transformer architectures, FlashAttention, and TPU kernel optimization.',
            notes: 'Referred by team lead',
            updatedAt: '2026-10-22T12:00:00Z'
        };

        const matchDesc = evaluateJobMatch(jobWithDesc, { query: 'FlashAttention' });
        assert.equal(matchDesc.matches, true);
        assert.ok(matchDesc.matchedFields.includes('description'));

        const matchPrefix = evaluateJobMatch(jobWithDesc, { query: 'desc:"TPU kernel"' });
        assert.equal(matchPrefix.matches, true);
        assert.ok(matchPrefix.matchedFields.includes('description'));
    });

    it('matches multi-word queries across company, role, location, salary, and notes', () => {
        const match1 = evaluateJobMatch(SAMPLE_JOBS[0], { query: 'anthropic hybrid' });
        assert.equal(match1.matches, true);
        assert.ok(match1.matchedFields.includes('company'));
        assert.ok(match1.matchedFields.includes('location'));

        const nonMatch = evaluateJobMatch(SAMPLE_JOBS[0], { query: 'anthropic remote' });
        assert.equal(nonMatch.matches, false);
    });

    it('filters by structured companyFilter, stageFilter, locationFilter, and quickFilter', () => {
        const byCompany = evaluateJobMatch(SAMPLE_JOBS[0], { companyFilter: 'Anthropic' });
        assert.equal(byCompany.matches, true);

        const wrongCompany = evaluateJobMatch(SAMPLE_JOBS[1], { companyFilter: 'Anthropic' });
        assert.equal(wrongCompany.matches, false);

        const byStage = evaluateJobMatch(SAMPLE_JOBS[0], { stageFilter: 'interviewing' });
        assert.equal(byStage.matches, true);

        const byRemote = evaluateJobMatch(SAMPLE_JOBS[1], { locationFilter: 'remote' });
        assert.equal(byRemote.matches, true);

        const byHasSalary = evaluateJobMatch(SAMPLE_JOBS[2], { quickFilter: 'has-salary' });
        assert.equal(byHasSalary.matches, false);
    });

    it('extracts company, location, and stage facets sorted by count', () => {
        const facets = extractJobFacets(SAMPLE_JOBS);
        assert.equal(facets.companies[0].name, 'Anthropic');
        assert.equal(facets.companies[0].count, 2);
        assert.equal(facets.companies[1].name, 'Stripe');
        assert.equal(facets.companies[1].count, 1);
        assert.equal(facets.stages.interviewing, 1);
    });

    it('sorts jobs by company-asc and role-asc accurately', () => {
        const byRole = sortJobsList(SAMPLE_JOBS, 'role-asc');
        assert.equal(byRole[0].role, 'AI Safety Fellow');
        assert.equal(byRole[1].role, 'Product Engineer');
        assert.equal(byRole[2].role, 'Senior Full Stack Engineer');
    });

    it('supports Initial Screening ("screening") stage filtering and metadata', () => {
        assert.equal(STAGE_LABELS.screening, 'Initial Screening');

        const screeningJob = {
            id: '4',
            role: 'Research Engineer',
            company: 'OpenAI',
            location: 'San Francisco, CA',
            status: 'screening',
            updatedAt: '2026-10-12T12:00:00Z'
        };

        const matchStage = evaluateJobMatch(screeningJob, { stageFilter: 'screening' });
        assert.equal(matchStage.matches, true);

        const matchFollowup = evaluateJobMatch(screeningJob, {
            quickFilter: 'followup',
            nowMs: new Date('2026-10-21T12:00:00Z').getTime()
        });
        assert.equal(matchFollowup.matches, true, 'Initial screening roles >5d should qualify for followup');

        const facets = extractJobFacets([...SAMPLE_JOBS, screeningJob]);
        assert.equal(facets.stages.screening, 1);
    });

    it('matches spacing/punctuation variants ("open works" <-> "OpenWorks", "Open-Works", "OpenWork")', () => {
        const openWorksJob = {
            id: 'ow-1',
            company: 'OpenWorks',
            title: 'Operations Lead',
            location: 'San José, CA',
            link: 'https://boards.greenhouse.io/openworks/jobs/42',
            status: 'applied',
            updatedAt: '2026-10-20T12:00:00Z'
        };
        const hyphenJob = {
            id: 'ow-2',
            company: 'Open-Works',
            role: 'Growth Manager',
            status: 'applied',
            updatedAt: '2026-10-20T12:00:00Z'
        };
        const singularJob = {
            id: 'ow-3',
            company: 'OpenWork',
            role: 'Growth Manager',
            status: 'applied',
            updatedAt: '2026-10-20T12:00:00Z'
        };
        const spacedJob = {
            id: 'ow-4',
            company: 'Open Works',
            role: 'Product Manager',
            status: 'applied',
            updatedAt: '2026-10-20T12:00:00Z'
        };

        assert.equal(evaluateJobMatch(openWorksJob, { query: 'open works' }).matches, true);
        assert.equal(evaluateJobMatch(hyphenJob, { query: 'open works' }).matches, true);
        assert.equal(evaluateJobMatch(singularJob, { query: 'open works' }).matches, true);
        assert.equal(evaluateJobMatch(spacedJob, { query: 'openworks' }).matches, true);
        assert.equal(evaluateJobMatch(openWorksJob, { query: 'company:"open works"' }).matches, true);

        // Diacritics folding & job.title / job.link indexing
        assert.equal(evaluateJobMatch(openWorksJob, { query: 'san jose' }).matches, true);
        assert.equal(evaluateJobMatch(openWorksJob, { query: 'operations' }).matches, true);
        assert.equal(evaluateJobMatch(openWorksJob, { query: 'greenhouse' }).matches, true);
    });

    it('handles minor typos ("open wroks", "ropen works", "anthrpic") while keeping non-matches strict', () => {
        const openWorksJob = {
            id: 'ow-t1',
            company: 'OpenWorks',
            role: 'Operations Engineer',
            location: 'Remote',
            status: 'applied'
        };
        assert.equal(evaluateJobMatch(openWorksJob, { query: 'open wroks' }).matches, true);
        assert.equal(evaluateJobMatch(openWorksJob, { query: 'ropen works' }).matches, true);
        assert.equal(evaluateJobMatch(SAMPLE_JOBS[0], { query: 'anthrpic' }).matches, true);
        assert.equal(evaluateJobMatch(SAMPLE_JOBS[0], { query: 'anthropic remote' }).matches, false);
    });

    it('computes recency timestamps, relative labels, and contextual match snippets', () => {
        const nowMs = new Date('2026-10-25T12:00:00Z').getTime();
        const recentJob = {
            id: 'r1',
            company: 'OpenWorks',
            role: 'Ops Lead',
            updatedAt: '2026-10-25T09:00:00Z',
            appliedAt: '2026-10-20T12:00:00Z',
            description: 'Join OpenWorks to scale enterprise automation. '.repeat(5) +
                'Requires deep expertise in Firestore security rules and React telemetry dashboards across multiple teams.'
        };
        const olderJob = {
            id: 'r2',
            company: 'Acme',
            role: 'Engineer',
            appliedAt: '2026-10-22T12:00:00Z',
            notes: 'Recruiter confirmed technical screen with engineering manager next Tuesday.'
        };

        assert.equal(getJobRecencyTimestamp(recentJob), new Date('2026-10-25T09:00:00Z').getTime());
        assert.equal(getJobRecencyTimestamp(olderJob), new Date('2026-10-22T12:00:00Z').getTime());
        assert.equal(getJobRecencyTimestamp({}), 0);

        assert.equal(formatRelativeSearchDate(recentJob, nowMs), 'Today');
        assert.equal(formatRelativeSearchDate({ updatedAt: '2026-10-24T12:00:00Z' }, nowMs), 'Yesterday');
        assert.equal(formatRelativeSearchDate(olderJob, nowMs), '3d ago');
        assert.equal(formatRelativeSearchDate({ updatedAt: '2026-09-10T12:00:00Z' }, nowMs), 'Sep 10');
        assert.equal(formatRelativeSearchDate({}, nowMs), '');

        const snippetDesc = extractMatchSnippet(recentJob, 'Firestore telemetry', ['description'], 110);
        assert.ok(snippetDesc);
        assert.equal(snippetDesc.field, 'description');
        assert.ok(snippetDesc.text.includes('Firestore security rules'));
        assert.ok(snippetDesc.text.length <= 125);

        const snippetNotes = extractMatchSnippet(olderJob, 'technical screen', ['notes'], 110);
        assert.ok(snippetNotes);
        assert.equal(snippetNotes.field, 'notes');
        assert.ok(snippetNotes.text.includes('technical screen'));

        assert.equal(extractMatchSnippet(SAMPLE_JOBS[0], 'anthropic', ['company']), null);
    });
});
