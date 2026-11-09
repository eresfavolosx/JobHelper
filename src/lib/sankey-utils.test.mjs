import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    classifyJobProgression,
    calculatePipelineStats,
    buildJobSankeyData,
    formatPipelineSummaryMarkdown,
    splitLabel
} from './sankey-utils.js';

describe('sankey-utils — Job Search Pipeline Sankey & Conversion Analytics', () => {
    const sampleJobs = [
        { id: '1', company: 'Stripe', role: 'Staff Engineer', status: 'wishlist', dateAdded: '2026-10-01T10:00:00Z' },
        { id: '2', company: 'Vercel', role: 'Frontend Architect', status: 'applied', previousStatus: 'wishlist', dateAdded: '2026-10-05T10:00:00Z' },
        { id: '3', company: 'Linear', role: 'Product Engineer', status: 'applied', dateAdded: '2026-10-08T10:00:00Z' },
        { id: '4', company: 'Anthropic', role: 'Research Engineer', status: 'screening', previousStatus: 'applied', dateAdded: '2026-10-12T10:00:00Z' },
        { id: '5', company: 'OpenAI', role: 'Systems Engineer', status: 'interviewing', previousStatus: 'screening', dateAdded: '2026-10-15T10:00:00Z' },
        { id: '6', company: 'Figma', role: 'Design Engineer', status: 'offer', previousStatus: 'interviewing', dateAdded: '2026-10-18T10:00:00Z' },
        { id: '7', company: 'Datadog', role: 'Platform Engineer', status: 'accepted', previousStatus: 'offer', dateAdded: '2026-10-20T10:00:00Z' },
        { id: '8', company: 'Meta', role: 'Senior SWE', status: 'rejected', previousStatus: 'applied', dateAdded: '2026-10-22T10:00:00Z' },
        { id: '9', company: 'Apple', role: 'UI Engineer', status: 'rejected', previousStatus: 'screening', dateAdded: '2026-10-24T10:00:00Z' },
        { id: '10', company: 'Netflix', role: 'Distributed Systems', status: 'rejected', previousStatus: 'interviewing', dateAdded: '2026-10-26T10:00:00Z' },
        { id: '11', company: 'Airbnb', role: 'Fullstack Engineer', status: 'archived', previousStatus: 'wishlist', dateAdded: '2026-10-28T10:00:00Z' },
        { id: '12', company: 'Notion', role: 'Web Engineer', status: 'archived', previousStatus: 'applied', dateAdded: '2026-10-30T10:00:00Z' },
        { id: '13', company: 'TrashCorp', role: 'Deleted Role', status: 'deleted', dateAdded: '2026-10-30T10:00:00Z' }
    ];

    test('classifyJobProgression accurately classifies each stage and previousStatus transition', () => {
        const wishlistProg = classifyJobProgression(sampleJobs[0]);
        assert.equal(wishlistProg.isWishlistOnly, true);
        assert.equal(wishlistProg.isSubmitted, false);
        assert.equal(wishlistProg.funnelCategory, 'wishlist_active');

        const screeningProg = classifyJobProgression(sampleJobs[3]);
        assert.equal(screeningProg.isSubmitted, true);
        assert.equal(screeningProg.reachedScreening, true);
        assert.equal(screeningProg.reachedInterview, false);
        assert.equal(screeningProg.funnelCategory, 'screening_active');

        const interviewRejectedProg = classifyJobProgression(sampleJobs[9]);
        assert.equal(interviewRejectedProg.isSubmitted, true);
        assert.equal(interviewRejectedProg.reachedScreening, true);
        assert.equal(interviewRejectedProg.reachedInterview, true);
        assert.equal(interviewRejectedProg.reachedOffer, false);
        assert.equal(interviewRejectedProg.funnelCategory, 'interview_closed');

        const acceptedProg = classifyJobProgression(sampleJobs[6]);
        assert.equal(acceptedProg.reachedScreening, true);
        assert.equal(acceptedProg.reachedInterview, true);
        assert.equal(acceptedProg.reachedOffer, true);
        assert.equal(acceptedProg.isAccepted, true);
        assert.equal(acceptedProg.funnelCategory, 'accepted_final');
    });

    test('calculatePipelineStats computes exact conversion rates, funnel stages, and insights', () => {
        const stats = calculatePipelineStats(sampleJobs);

        // 13 total minus 1 deleted = 12 tracked roles
        assert.equal(stats.totalTracked, 12);
        // 2 wishlist track roles (id 1 wishlist, id 11 archived from wishlist)
        assert.equal(stats.wishlistCount, 2);
        // 10 submitted applications
        assert.equal(stats.totalApplied, 10);

        // Reached Screening+: Anthropic (screening), OpenAI (interviewing), Figma (offer),
        // Datadog (accepted), Apple (rejected after screening), Netflix (rejected after interview) = 6
        assert.equal(stats.screeningReachedCount, 6);
        assert.equal(stats.rates.screeningRate, 60);

        // Reached Interview+: OpenAI, Figma, Datadog, Netflix = 4
        assert.equal(stats.interviewReachedCount, 4);
        assert.equal(stats.rates.interviewRate, 40);

        // Reached Offer+: Figma, Datadog = 2
        assert.equal(stats.offerReachedCount, 2);
        assert.equal(stats.rates.offerRate, 20);

        // Interview-to-Offer Win Rate: 2 offers / 4 interviews = 50%
        assert.equal(stats.rates.interviewToOfferRate, 50);

        // Stage Funnel has 5 progressive steps
        assert.equal(stats.stageFunnel.length, 5);
        assert.equal(stats.stageFunnel[0].count, 10);
        assert.equal(stats.stageFunnel[1].count, 6);
        assert.equal(stats.stageFunnel[2].count, 4);
        assert.equal(stats.stageFunnel[3].count, 2);
        assert.equal(stats.stageFunnel[4].count, 1);

        assert.ok(stats.insights.length >= 2);
    });

    test('buildJobSankeyData generates valid SVG nodes and ribbons in both funnel and direct modes', () => {
        const funnelGraph = buildJobSankeyData(sampleJobs, { mode: 'funnel', width: 920, height: 420 });
        assert.equal(funnelGraph.isEmpty, false);
        assert.ok(funnelGraph.nodes.length >= 8);
        assert.ok(funnelGraph.links.length >= 8);

        // Verify submitted and wishlist_entry nodes sum to all 12 non-deleted jobs
        const submittedNode = funnelGraph.nodes.find(n => n.id === 'submitted');
        const wishlistNode = funnelGraph.nodes.find(n => n.id === 'wishlist_entry');
        assert.ok(submittedNode);
        assert.ok(wishlistNode);
        assert.equal(submittedNode.value + wishlistNode.value, 12);

        // Verify every link has a valid closed SVG ribbonPath string
        for (const link of funnelGraph.links) {
            assert.ok(typeof link.ribbonPath === 'string' && link.ribbonPath.startsWith('M '));
            assert.ok(link.value > 0);
        }

        const directGraph = buildJobSankeyData(sampleJobs, { mode: 'direct', width: 920, height: 420 });
        assert.equal(directGraph.isEmpty, false);
        assert.ok(directGraph.nodes.some(n => n.id === 'stage_interviewing'));
        assert.ok(directGraph.nodes.some(n => n.id === 'stage_offer'));

        // Verify every node contains divided lines array for clean SVG rendering
        for (const node of funnelGraph.nodes) {
            assert.ok(Array.isArray(node.lines) && node.lines.length >= 1, `node ${node.id} should have lines`);
            for (const line of node.lines) {
                assert.ok(typeof line === 'string' && line.length > 0);
            }
        }
    });

    test('splitLabel cleanly divides long labels across spaces, slashes, and parentheticals', () => {
        assert.deepEqual(splitLabel('Wishlist'), ['Wishlist']);
        assert.deepEqual(splitLabel('Reached Screening / Interview'), ['Reached Screening', '/ Interview']);
        assert.deepEqual(splitLabel('Rejected (Resume Screen)'), ['Rejected', '(Resume Screen)']);
        assert.deepEqual(splitLabel('Offer Declined / Closed'), ['Offer Declined', '/ Closed']);
        assert.deepEqual(splitLabel('Very Long Generic Pipeline Stage Name'), ['Very Long Generic', 'Pipeline Stage Name']);
    });

    test('buildJobSankeyData handles empty job list gracefully', () => {
        const emptyGraph = buildJobSankeyData([], { mode: 'funnel' });
        assert.equal(emptyGraph.isEmpty, true);
        assert.equal(emptyGraph.nodes.length, 0);
        assert.equal(emptyGraph.links.length, 0);
    });

    test('formatPipelineSummaryMarkdown produces a readable markdown summary', () => {
        const stats = calculatePipelineStats(sampleJobs);
        const md = formatPipelineSummaryMarkdown(stats);
        assert.ok(md.includes('Job Search Pipeline & Conversion Summary'));
        assert.ok(md.includes('60%'));
        assert.ok(md.includes('40%'));
        assert.ok(md.includes('20%'));
    });
});
