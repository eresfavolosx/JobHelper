import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseSearchQuery,
    evaluateJobMatch,
    extractJobFacets,
    sortJobsList,
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
        const parsed = parseSearchQuery('company:Anthropic location:"San Francisco" fellowship');
        assert.equal(parsed.fieldFilters.length, 2);
        assert.deepEqual(parsed.fieldFilters[0], { field: 'company', value: 'anthropic' });
        assert.deepEqual(parsed.fieldFilters[1], { field: 'location', value: 'san francisco' });
        assert.deepEqual(parsed.textTokens, ['fellowship']);
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
});
