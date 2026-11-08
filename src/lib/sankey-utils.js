/**
 * Job Pipeline Sankey Diagram & Conversion Analytics Engine
 *
 * Computes:
 * 1. Comprehensive job search success rates, stage conversion metrics, and funnel diagnostics
 * 2. Multi-column Sankey node + cubic-Bézier ribbon layout with guaranteed flow conservation
 *    across both Progressive Funnel ('funnel') and Direct Stage ('direct') modes.
 */

import { subDays } from 'date-fns';
import { safeDate } from './utils.js';

export const SANKEY_STAGE_META = {
    tracked: { label: 'Tracked Opportunities', shortLabel: 'Tracked', color: '#6366f1' },
    submitted: { label: 'Submitted Applications', shortLabel: 'Submitted', color: '#6B7E67' },
    wishlist_entry: { label: 'Saved in Wishlist', shortLabel: 'Wishlist', color: '#9DA7AE' },
    progressed: { label: 'Reached Screening / Interview', shortLabel: 'Progressed', color: '#0ea5e9' },
    applied_active: { label: 'Awaiting Reply (Applied)', shortLabel: 'Applied', color: '#6B7E67' },
    rejected_early: { label: 'Rejected (Resume Screen)', shortLabel: 'Rejected (App)', color: '#ef4444' },
    archived_early: { label: 'Archived / No Response', shortLabel: 'Archived', color: '#94a3b8' },
    wishlist_active: { label: 'Active Wishlist', shortLabel: 'Wishlist', color: '#9DA7AE' },
    wishlist_archived: { label: 'Archived from Wishlist', shortLabel: 'Skipped', color: '#64748b' },
    screening_active: { label: 'In Initial Screening', shortLabel: 'Screening', color: '#0ea5e9' },
    interview_reached: { label: 'Advanced to Interviews', shortLabel: 'Interviewed', color: '#D4A373' },
    screening_closed: { label: 'Ended After Screening', shortLabel: 'Closed (Screen)', color: '#f97316' },
    interview_active: { label: 'Active Interviewing', shortLabel: 'Interviewing', color: '#D4A373' },
    offer_reached: { label: 'Offer Received', shortLabel: 'Offer Received', color: '#10b981' },
    interview_closed: { label: 'Ended After Interview', shortLabel: 'Closed (Interview)', color: '#ef4444' },
    offer_pending: { label: 'Pending Offer Decision', shortLabel: 'Pending Offer', color: '#10b981' },
    accepted_final: { label: 'Offer Accepted', shortLabel: 'Accepted', color: '#22c55e' },
    offer_declined: { label: 'Offer Declined / Closed', shortLabel: 'Declined', color: '#f59e0b' },
    // Direct stage nodes
    stage_wishlist: { label: 'Wishlist', shortLabel: 'Wishlist', color: '#9DA7AE', boardStage: 'wishlist' },
    stage_applied: { label: 'Applied', shortLabel: 'Applied', color: '#6B7E67', boardStage: 'applied' },
    stage_screening: { label: 'Initial Screening', shortLabel: 'Screening', color: '#0ea5e9', boardStage: 'screening' },
    stage_interviewing: { label: 'Interviewing', shortLabel: 'Interviewing', color: '#D4A373', boardStage: 'interviewing' },
    stage_offer: { label: 'Offer', shortLabel: 'Offer', color: '#10b981', boardStage: 'offer' },
    stage_accepted: { label: 'Accepted', shortLabel: 'Accepted', color: '#22c55e', boardStage: 'accepted' },
    stage_rejected: { label: 'Rejected', shortLabel: 'Rejected', color: '#ef4444', boardStage: 'rejected' },
    stage_archived: { label: 'Archived', shortLabel: 'Archived', color: '#94a3b8', boardStage: 'archived' }
};

export const SANKEY_TIME_RANGES = [
    { id: 'all', label: 'All Time', days: null },
    { id: '90d', label: '90D', days: 90 },
    { id: '30d', label: '30D', days: 30 },
    { id: '14d', label: '14D', days: 14 }
];

/**
 * Formats a ratio (numerator / denominator) as a percentage number with 1 decimal place.
 */
export function toPct(numerator, denominator) {
    if (!denominator || denominator <= 0 || !numerator || numerator <= 0) return 0;
    return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Filter active (non-deleted) jobs optionally constrained by a time window or company query.
 */
export function filterJobsForSankey(jobs, options = {}) {
    if (!Array.isArray(jobs)) return [];
    const { range = 'all', now = new Date(), companyFilter = 'all' } = options;
    const rangeObj = SANKEY_TIME_RANGES.find(r => r.id === range);
    const cutoffMs = rangeObj?.days ? subDays(now, rangeObj.days).getTime() : null;
    const normalizedCompany = companyFilter && companyFilter !== 'all'
        ? String(companyFilter).trim().toLowerCase()
        : null;

    return jobs.filter(job => {
        if (!job || job.status === 'deleted') return false;
        if (normalizedCompany) {
            const comp = String(job.company || '').trim().toLowerCase();
            if (comp !== normalizedCompany) return false;
        }
        if (cutoffMs !== null) {
            const rawDate = job.appliedAt || job.dateAdded || job.createdAt || job.updatedAt;
            if (rawDate) {
                const d = safeDate(rawDate);
                if (!isNaN(d.getTime()) && d.getTime() < cutoffMs) {
                    return false;
                }
            }
        }
        return true;
    });
}

/**
 * Classifies a single job's progression history across the hiring funnel.
 * Uses `status`, `previousStatus`, and `appliedAt` to determine the exact stage path.
 *
 * @param {object} job
 * @returns {{
 *   isSubmitted: boolean,
 *   isWishlistOnly: boolean,
 *   reachedScreening: boolean,
 *   reachedInterview: boolean,
 *   reachedOffer: boolean,
 *   isAccepted: boolean,
 *   isActive: boolean,
 *   currentStatus: string,
 *   previousStatus: string | null,
 *   funnelCategory: string
 * }}
 */
export function classifyJobProgression(job) {
    const status = job?.status || 'wishlist';
    const prev = job?.previousStatus || null;
    const hasAppliedAt = Boolean(job?.appliedAt);

    // Determine if the job never left the wishlist track
    const isWishlistOnly =
        status === 'wishlist' ||
        ((status === 'archived' || status === 'rejected') && prev === 'wishlist' && !hasAppliedAt);

    const isSubmitted = !isWishlistOnly;

    // Determine highest stage reached for submitted applications
    const reachedOffer =
        isSubmitted && (
            status === 'offer' ||
            status === 'accepted' ||
            prev === 'offer' ||
            prev === 'accepted'
        );

    const reachedInterview =
        reachedOffer ||
        (isSubmitted && (
            status === 'interviewing' ||
            prev === 'interviewing'
        ));

    const reachedScreening =
        reachedInterview ||
        (isSubmitted && (
            status === 'screening' ||
            prev === 'screening'
        ));

    const isAccepted = status === 'accepted';
    const isActive = ['applied', 'screening', 'interviewing', 'offer'].includes(status);

    let funnelCategory = 'applied_active';
    if (isWishlistOnly) {
        funnelCategory = status === 'wishlist' ? 'wishlist_active' : 'wishlist_archived';
    } else if (status === 'accepted') {
        funnelCategory = 'accepted_final';
    } else if (status === 'offer') {
        funnelCategory = 'offer_pending';
    } else if (reachedOffer && (status === 'rejected' || status === 'archived')) {
        funnelCategory = 'offer_declined';
    } else if (status === 'interviewing') {
        funnelCategory = 'interview_active';
    } else if (reachedInterview && (status === 'rejected' || status === 'archived')) {
        funnelCategory = 'interview_closed';
    } else if (status === 'screening') {
        funnelCategory = 'screening_active';
    } else if (reachedScreening && (status === 'rejected' || status === 'archived')) {
        funnelCategory = 'screening_closed';
    } else if (status === 'rejected') {
        funnelCategory = 'rejected_early';
    } else if (status === 'archived') {
        funnelCategory = 'archived_early';
    } else {
        funnelCategory = 'applied_active';
    }

    return {
        isSubmitted,
        isWishlistOnly,
        reachedScreening,
        reachedInterview,
        reachedOffer,
        isAccepted,
        isActive,
        currentStatus: status,
        previousStatus: prev,
        funnelCategory
    };
}

/**
 * Computes comprehensive job search conversion metrics, success rates, and diagnostic insights.
 */
export function calculatePipelineStats(jobs, options = {}) {
    const filtered = filterJobsForSankey(jobs, options);

    const counts = {
        totalTracked: filtered.length,
        totalApplied: 0,
        wishlistCount: 0,
        wishlistActiveCount: 0,
        wishlistArchivedCount: 0,
        progressedCount: 0,
        screeningReachedCount: 0,
        interviewReachedCount: 0,
        offerReachedCount: 0,
        acceptedCount: 0,
        offerPendingCount: 0,
        activePipelineCount: 0,
        appliedActiveCount: 0,
        screeningActiveCount: 0,
        interviewActiveCount: 0,
        rejectedTotalCount: 0,
        rejectedEarlyCount: 0,
        screeningClosedCount: 0,
        interviewClosedCount: 0,
        offerDeclinedCount: 0,
        archivedTotalCount: 0,
        archivedEarlyCount: 0
    };

    const byStatus = {
        wishlist: [],
        applied: [],
        screening: [],
        interviewing: [],
        offer: [],
        accepted: [],
        rejected: [],
        archived: []
    };

    for (const job of filtered) {
        const c = classifyJobProgression(job);
        const st = byStatus[c.currentStatus] ? c.currentStatus : 'wishlist';
        byStatus[st].push(job);

        if (c.isWishlistOnly) {
            counts.wishlistCount++;
            if (c.currentStatus === 'wishlist') counts.wishlistActiveCount++;
            else counts.wishlistArchivedCount++;
            continue;
        }

        counts.totalApplied++;
        if (c.isActive) counts.activePipelineCount++;
        if (c.reachedScreening) {
            counts.progressedCount++;
            counts.screeningReachedCount++;
        }
        if (c.reachedInterview) counts.interviewReachedCount++;
        if (c.reachedOffer) counts.offerReachedCount++;
        if (c.isAccepted) counts.acceptedCount++;

        if (c.currentStatus === 'applied') counts.appliedActiveCount++;
        if (c.currentStatus === 'screening') counts.screeningActiveCount++;
        if (c.currentStatus === 'interviewing') counts.interviewActiveCount++;
        if (c.currentStatus === 'offer') counts.offerPendingCount++;
        if (c.currentStatus === 'rejected') counts.rejectedTotalCount++;
        if (c.currentStatus === 'archived') counts.archivedTotalCount++;

        if (c.funnelCategory === 'rejected_early') counts.rejectedEarlyCount++;
        if (c.funnelCategory === 'archived_early') counts.archivedEarlyCount++;
        if (c.funnelCategory === 'screening_closed') counts.screeningClosedCount++;
        if (c.funnelCategory === 'interview_closed') counts.interviewClosedCount++;
        if (c.funnelCategory === 'offer_declined') counts.offerDeclinedCount++;
    }

    // Conversion & Success Rates
    const applicationSubmissionRate = toPct(counts.totalApplied, counts.totalTracked);
    const progressionRate = toPct(counts.progressedCount, counts.totalApplied);
    const screeningRate = toPct(counts.screeningReachedCount, counts.totalApplied);
    const interviewRate = toPct(counts.interviewReachedCount, counts.totalApplied);
    const offerRate = toPct(counts.offerReachedCount, counts.totalApplied);
    const acceptanceRate = toPct(counts.acceptedCount, counts.offerReachedCount);
    const screeningToInterviewRate = toPct(counts.interviewReachedCount, counts.screeningReachedCount);
    const interviewToOfferRate = toPct(counts.offerReachedCount, counts.interviewReachedCount);
    const activeRate = toPct(counts.activePipelineCount, counts.totalApplied);
    const rejectionRate = toPct(counts.rejectedTotalCount, counts.totalApplied);
    const noResponseRate = toPct(counts.appliedActiveCount + counts.archivedEarlyCount, counts.totalApplied);

    // Stage-by-Stage Funnel Progression
    const stageFunnel = [
        {
            id: 'submitted',
            label: 'Submitted',
            count: counts.totalApplied,
            pctOfApplied: counts.totalApplied > 0 ? 100 : 0,
            stepConversionPct: applicationSubmissionRate,
            stepLabel: `${applicationSubmissionRate}% of tracked`,
            color: SANKEY_STAGE_META.submitted.color
        },
        {
            id: 'screening',
            label: 'Screening+',
            count: counts.screeningReachedCount,
            pctOfApplied: screeningRate,
            stepConversionPct: screeningRate,
            stepLabel: `${screeningRate}% of applied`,
            color: SANKEY_STAGE_META.screening_active.color
        },
        {
            id: 'interviewing',
            label: 'Interviewing+',
            count: counts.interviewReachedCount,
            pctOfApplied: interviewRate,
            stepConversionPct: counts.screeningReachedCount > 0 ? screeningToInterviewRate : interviewRate,
            stepLabel: counts.screeningReachedCount > 0
                ? `${screeningToInterviewRate}% of screened`
                : `${interviewRate}% of applied`,
            color: SANKEY_STAGE_META.interview_active.color
        },
        {
            id: 'offer',
            label: 'Offer Received',
            count: counts.offerReachedCount,
            pctOfApplied: offerRate,
            stepConversionPct: counts.interviewReachedCount > 0 ? interviewToOfferRate : offerRate,
            stepLabel: counts.interviewReachedCount > 0
                ? `${interviewToOfferRate}% of interviewed`
                : `${offerRate}% of applied`,
            color: SANKEY_STAGE_META.offer_reached.color
        },
        {
            id: 'accepted',
            label: 'Accepted',
            count: counts.acceptedCount,
            pctOfApplied: toPct(counts.acceptedCount, counts.totalApplied),
            stepConversionPct: acceptanceRate,
            stepLabel: counts.offerReachedCount > 0
                ? `${acceptanceRate}% of offers`
                : '0% of offers',
            color: SANKEY_STAGE_META.accepted_final.color
        }
    ];

    // Actionable diagnostic insights
    const insights = [];
    if (counts.totalApplied === 0 && counts.wishlistCount > 0) {
        insights.push({
            tone: 'info',
            text: `You have ${counts.wishlistCount} saved ${counts.wishlistCount === 1 ? 'role' : 'roles'} in Wishlist. Move roles to Applied as you submit applications to unlock conversion rates.`
        });
    } else if (counts.totalApplied > 0) {
        if (counts.offerReachedCount > 0) {
            insights.push({
                tone: 'success',
                text: `Strong closing momentum: ${counts.offerReachedCount} ${counts.offerReachedCount === 1 ? 'offer' : 'offers'} earned (${offerRate}% overall offer rate · ${interviewToOfferRate}% interview-to-offer conversion).`
            });
        } else if (counts.interviewReachedCount > 0) {
            insights.push({
                tone: 'accent',
                text: `${counts.interviewReachedCount} of ${counts.totalApplied} applications (${interviewRate}%) reached interviews. Focus on AI Career Coach prep to convert active interviews into offers.`
            });
        } else if (counts.screeningReachedCount > 0) {
            insights.push({
                tone: 'accent',
                text: `${counts.screeningReachedCount} of ${counts.totalApplied} applications (${screeningRate}%) advanced to screening.`
            });
        } else {
            insights.push({
                tone: 'info',
                text: `${counts.appliedActiveCount} ${counts.appliedActiveCount === 1 ? 'application is' : 'applications are'} awaiting initial recruiter response. Update card stages on the Board as callbacks arrive.`
            });
        }

        if (counts.wishlistActiveCount > 0) {
            insights.push({
                tone: 'neutral',
                text: `${counts.wishlistActiveCount} ${counts.wishlistActiveCount === 1 ? 'opportunity remains' : 'opportunities remain'} in Wishlist ready to be submitted.`
            });
        }
    }

    return {
        ...counts,
        rates: {
            applicationSubmissionRate,
            progressionRate,
            screeningRate,
            interviewRate,
            offerRate,
            acceptanceRate,
            screeningToInterviewRate,
            interviewToOfferRate,
            activeRate,
            rejectionRate,
            noResponseRate
        },
        byStatus,
        stageFunnel,
        insights
    };
}

/**
 * Builds the raw nodes and links for the Sankey diagram, then computes exact
 * 2D coordinates (columns, vertical positions, node heights, and cubic-Bézier link paths).
 *
 * @param {Array} jobs - List of job objects
 * @param {object} [options]
 * @param {'funnel' | 'direct'} [options.mode='funnel']
 * @param {string} [options.range='all']
 * @param {string} [options.companyFilter='all']
 * @param {number} [options.width=860]
 * @param {number} [options.height=380]
 */
export function buildJobSankeyData(jobs, options = {}) {
    const mode = options.mode || 'funnel';
    const width = Math.max(480, Number(options.width) || 860);
    const height = Math.max(260, Number(options.height) || 380);
    const filtered = filterJobsForSankey(jobs, options);
    const stats = calculatePipelineStats(filtered);

    if (filtered.length === 0) {
        return {
            nodes: [],
            links: [],
            columns: [],
            stats,
            width,
            height,
            isEmpty: true
        };
    }

    // Bucket jobs by classification
    const buckets = {
        submitted: [],
        wishlist_entry: [],
        progressed: [],
        applied_active: [],
        rejected_early: [],
        archived_early: [],
        wishlist_active: [],
        wishlist_archived: [],
        screening_active: [],
        interview_reached: [],
        screening_closed: [],
        interview_active: [],
        offer_reached: [],
        interview_closed: [],
        offer_pending: [],
        accepted_final: [],
        offer_declined: []
    };

    for (const job of filtered) {
        const c = classifyJobProgression(job);
        if (c.isWishlistOnly) {
            buckets.wishlist_entry.push(job);
            if (c.funnelCategory === 'wishlist_active') buckets.wishlist_active.push(job);
            else buckets.wishlist_archived.push(job);
        } else {
            buckets.submitted.push(job);
            if (c.reachedScreening) {
                buckets.progressed.push(job);
                if (c.reachedInterview) {
                    buckets.interview_reached.push(job);
                    if (c.reachedOffer) {
                        buckets.offer_reached.push(job);
                        if (c.funnelCategory === 'accepted_final') buckets.accepted_final.push(job);
                        else if (c.funnelCategory === 'offer_pending') buckets.offer_pending.push(job);
                        else buckets.offer_declined.push(job);
                    } else if (c.funnelCategory === 'interview_active') {
                        buckets.interview_active.push(job);
                    } else {
                        buckets.interview_closed.push(job);
                    }
                } else if (c.funnelCategory === 'screening_active') {
                    buckets.screening_active.push(job);
                } else {
                    buckets.screening_closed.push(job);
                }
            } else if (c.funnelCategory === 'applied_active') {
                buckets.applied_active.push(job);
            } else if (c.funnelCategory === 'rejected_early') {
                buckets.rejected_early.push(job);
            } else if (c.funnelCategory === 'archived_early') {
                buckets.archived_early.push(job);
            }
        }
    }

    const rawNodes = new Map();
    const rawLinks = [];

    function ensureNode(id, column, jobsList, customMeta = {}) {
        if (!jobsList || jobsList.length === 0) return;
        const meta = SANKEY_STAGE_META[id] || {};
        rawNodes.set(id, {
            id,
            column,
            label: customMeta.label || meta.label || id,
            shortLabel: customMeta.shortLabel || meta.shortLabel || id,
            color: customMeta.color || meta.color || '#6B7E67',
            boardStage: customMeta.boardStage || meta.boardStage || null,
            value: jobsList.length,
            jobs: jobsList
        });
    }

    function addLink(sourceId, targetId, jobsList) {
        if (!jobsList || jobsList.length === 0) return;
        if (!rawNodes.has(sourceId) || !rawNodes.has(targetId)) return;
        const sourceNode = rawNodes.get(sourceId);
        const targetNode = rawNodes.get(targetId);
        rawLinks.push({
            id: `${sourceId}->${targetId}`,
            source: sourceId,
            target: targetId,
            value: jobsList.length,
            jobs: jobsList,
            sourceColor: sourceNode.color,
            targetColor: targetNode.color,
            conversionPct: toPct(jobsList.length, sourceNode.value),
            totalPct: toPct(jobsList.length, filtered.length)
        });
    }

    const hasProgressionBeyondApplied = buckets.progressed.length > 0;

    if (mode === 'direct' || !hasProgressionBeyondApplied) {
        // Direct Stage View (or automatic compact view when no jobs have moved past 'applied' yet):
        // Column 0: Tracked Opportunities (if both Submitted & Wishlist exist) or Submitted Applications
        // Column 1: Submitted Applications / Saved in Wishlist
        // Column 2: Current Kanban Stage Buckets
        const useRootNode = buckets.submitted.length > 0 && buckets.wishlist_entry.length > 0;
        const entryCol = useRootNode ? 1 : 0;
        const stageCol = useRootNode ? 2 : 1;

        if (useRootNode) {
            ensureNode('tracked', 0, filtered);
        }
        ensureNode('submitted', entryCol, buckets.submitted);
        ensureNode('wishlist_entry', entryCol, buckets.wishlist_entry);

        if (useRootNode) {
            addLink('tracked', 'submitted', buckets.submitted);
            addLink('tracked', 'wishlist_entry', buckets.wishlist_entry);
        }

        // Group submitted jobs by their current status
        const statusOrder = ['accepted', 'offer', 'interviewing', 'screening', 'applied', 'rejected', 'archived'];
        for (const st of statusOrder) {
            const list = buckets.submitted.filter(j => j.status === st);
            if (list.length > 0) {
                const nodeId = `stage_${st}`;
                ensureNode(nodeId, stageCol, list);
                addLink('submitted', nodeId, list);
            }
        }

        // Group wishlist-only jobs by their current status
        const wishlistActive = buckets.wishlist_entry.filter(j => j.status === 'wishlist');
        const wishlistClosed = buckets.wishlist_entry.filter(j => j.status !== 'wishlist');
        if (wishlistActive.length > 0) {
            ensureNode('stage_wishlist', stageCol, wishlistActive);
            addLink('wishlist_entry', 'stage_wishlist', wishlistActive);
        }
        if (wishlistClosed.length > 0) {
            const existingArchived = rawNodes.get('stage_archived');
            if (existingArchived) {
                existingArchived.jobs = [...existingArchived.jobs, ...wishlistClosed];
                existingArchived.value = existingArchived.jobs.length;
                addLink('wishlist_entry', 'stage_archived', wishlistClosed);
            } else {
                ensureNode('stage_archived', stageCol, wishlistClosed);
                addLink('wishlist_entry', 'stage_archived', wishlistClosed);
            }
        }
    } else {
        // Progressive Multi-Stage Funnel Mode:
        // Column 0: Submitted Applications & Wishlist
        ensureNode('submitted', 0, buckets.submitted);
        ensureNode('wishlist_entry', 0, buckets.wishlist_entry);

        // Column 1: Application Triage (Progressed vs Awaiting vs Rejected vs Archived)
        ensureNode('progressed', 1, buckets.progressed, { boardStage: 'screening' });
        ensureNode('applied_active', 1, buckets.applied_active, { boardStage: 'applied' });
        ensureNode('rejected_early', 1, buckets.rejected_early, { boardStage: 'rejected' });
        ensureNode('archived_early', 1, buckets.archived_early, { boardStage: 'archived' });
        ensureNode('wishlist_active', 1, buckets.wishlist_active, { boardStage: 'wishlist' });
        ensureNode('wishlist_archived', 1, buckets.wishlist_archived, { boardStage: 'archived' });

        addLink('submitted', 'progressed', buckets.progressed);
        addLink('submitted', 'applied_active', buckets.applied_active);
        addLink('submitted', 'rejected_early', buckets.rejected_early);
        addLink('submitted', 'archived_early', buckets.archived_early);
        addLink('wishlist_entry', 'wishlist_active', buckets.wishlist_active);
        addLink('wishlist_entry', 'wishlist_archived', buckets.wishlist_archived);

        // Column 2: Screening Outcomes (Advanced to Interview vs In Screening vs Closed at Screening)
        ensureNode('interview_reached', 2, buckets.interview_reached, { boardStage: 'interviewing' });
        ensureNode('screening_active', 2, buckets.screening_active, { boardStage: 'screening' });
        ensureNode('screening_closed', 2, buckets.screening_closed, { boardStage: 'rejected' });

        addLink('progressed', 'interview_reached', buckets.interview_reached);
        addLink('progressed', 'screening_active', buckets.screening_active);
        addLink('progressed', 'screening_closed', buckets.screening_closed);

        // Column 3: Interview Outcomes (Offer Received vs Active Interviewing vs Closed After Interview)
        if (buckets.interview_reached.length > 0) {
            ensureNode('offer_reached', 3, buckets.offer_reached, { boardStage: 'offer' });
            ensureNode('interview_active', 3, buckets.interview_active, { boardStage: 'interviewing' });
            ensureNode('interview_closed', 3, buckets.interview_closed, { boardStage: 'rejected' });

            addLink('interview_reached', 'offer_reached', buckets.offer_reached);
            addLink('interview_reached', 'interview_active', buckets.interview_active);
            addLink('interview_reached', 'interview_closed', buckets.interview_closed);
        }

        // Column 4: Offer Decisions (Accepted vs Pending Offer vs Declined)
        if (buckets.offer_reached.length > 0) {
            ensureNode('accepted_final', 4, buckets.accepted_final, { boardStage: 'accepted' });
            ensureNode('offer_pending', 4, buckets.offer_pending, { boardStage: 'offer' });
            ensureNode('offer_declined', 4, buckets.offer_declined, { boardStage: 'rejected' });

            addLink('offer_reached', 'accepted_final', buckets.accepted_final);
            addLink('offer_reached', 'offer_pending', buckets.offer_pending);
            addLink('offer_reached', 'offer_declined', buckets.offer_declined);
        }
    }

    // Normalize active columns so there are no gaps
    const distinctCols = Array.from(new Set(Array.from(rawNodes.values()).map(n => n.column))).sort((a, b) => a - b);
    const colIndexMap = new Map(distinctCols.map((c, idx) => [c, idx]));
    const numCols = distinctCols.length;

    const padTop = 28;
    const padBottom = 28;
    const padLeft = 20;
    const padRight = 20;
    const nodeWidth = 18;
    const nodeGap = 16;

    const usableWidth = Math.max(200, width - padLeft - padRight - nodeWidth);
    const usableHeight = Math.max(160, height - padTop - padBottom);
    const colStep = numCols > 1 ? usableWidth / (numCols - 1) : 0;

    // Group nodes by normalized column index
    const columns = Array.from({ length: numCols }, () => []);
    for (const node of rawNodes.values()) {
        node.colIndex = colIndexMap.get(node.column);
        columns[node.colIndex].push(node);
    }

    // Determine global vertical scale (pixels per job unit) so node heights are proportional across columns
    let minScale = Infinity;
    for (const colNodes of columns) {
        const totalVal = colNodes.reduce((sum, n) => sum + n.value, 0);
        const totalGaps = Math.max(0, colNodes.length - 1) * nodeGap;
        const availableH = Math.max(60, usableHeight - totalGaps);
        const scale = totalVal > 0 ? availableH / totalVal : availableH;
        if (scale < minScale) minScale = scale;
    }
    const valueScale = Number.isFinite(minScale) ? minScale : 10;

    // Position nodes within each column
    for (let cIdx = 0; cIdx < numCols; cIdx++) {
        const colNodes = columns[cIdx];
        const x0 = Math.round(padLeft + cIdx * colStep);
        const x1 = x0 + nodeWidth;

        // Compute raw heights with a readable minimum height of 10px
        const rawHeights = colNodes.map(n => Math.max(10, n.value * valueScale));
        const totalNodesH = rawHeights.reduce((a, b) => a + b, 0);
        const totalGapsH = Math.max(0, colNodes.length - 1) * nodeGap;
        let totalColH = totalNodesH + totalGapsH;

        // If min-height clamping caused overflow, scale down proportionally
        let adjustFactor = 1;
        if (totalColH > usableHeight && totalNodesH > 0) {
            adjustFactor = Math.max(0.4, (usableHeight - totalGapsH) / totalNodesH);
            totalColH = totalNodesH * adjustFactor + totalGapsH;
        }

        // Vertically center the column within the SVG canvas
        let currentY = padTop + Math.max(0, (usableHeight - totalColH) / 2);

        colNodes.forEach((node, idx) => {
            const h = Math.max(8, rawHeights[idx] * adjustFactor);
            node.x0 = x0;
            node.x1 = x1;
            node.y0 = currentY;
            node.y1 = currentY + h;
            node.height = h;
            node.pctOfTotal = toPct(node.value, filtered.length);
            node.pctOfApplied = toPct(node.value, stats.totalApplied || filtered.length);
            node.outOffset = 0;
            node.inOffset = 0;
            currentY += h + nodeGap;
        });
    }

    // Compute cubic-Bézier ribbon geometry for each link
    const computedLinks = rawLinks.map(link => {
        const sourceNode = rawNodes.get(link.source);
        const targetNode = rawNodes.get(link.target);

        const sourceOutTotal = rawLinks
            .filter(l => l.source === link.source)
            .reduce((s, l) => s + l.value, 0);
        const targetInTotal = rawLinks
            .filter(l => l.target === link.target)
            .reduce((s, l) => s + l.value, 0);

        const sourceThickness = sourceOutTotal > 0
            ? (link.value / sourceOutTotal) * sourceNode.height
            : sourceNode.height;
        const targetThickness = targetInTotal > 0
            ? (link.value / targetInTotal) * targetNode.height
            : targetNode.height;

        const sy0 = sourceNode.y0 + sourceNode.outOffset;
        const sy1 = sy0 + sourceThickness;
        sourceNode.outOffset += sourceThickness;

        const ty0 = targetNode.y0 + targetNode.inOffset;
        const ty1 = ty0 + targetThickness;
        targetNode.inOffset += targetThickness;

        const sx = sourceNode.x1;
        const tx = targetNode.x0;
        const cx0 = sx + (tx - sx) * 0.45;
        const cx1 = sx + (tx - sx) * 0.55;

        // Closed cubic-Bézier ribbon polygon for exact variable-thickness rendering
        const ribbonPath = [
            `M ${sx} ${sy0}`,
            `C ${cx0} ${sy0}, ${cx1} ${ty0}, ${tx} ${ty0}`,
            `L ${tx} ${ty1}`,
            `C ${cx1} ${ty1}, ${cx0} ${sy1}, ${sx} ${sy1}`,
            'Z'
        ].join(' ');

        const centerY0 = (sy0 + sy1) / 2;
        const centerY1 = (ty0 + ty1) / 2;
        const strokePath = `M ${sx} ${centerY0} C ${cx0} ${centerY0}, ${cx1} ${centerY1}, ${tx} ${centerY1}`;

        return {
            ...link,
            sourceLabel: sourceNode.label,
            targetLabel: targetNode.label,
            sx,
            tx,
            sy0,
            sy1,
            ty0,
            ty1,
            thickness: (sourceThickness + targetThickness) / 2,
            ribbonPath,
            strokePath
        };
    });

    const columnHeaders = columns.map((colNodes, idx) => {
        const x = colNodes[0] ? (colNodes[0].x0 + colNodes[0].x1) / 2 : 0;
        let title = `Stage ${idx + 1}`;
        if (mode === 'direct' || !hasProgressionBeyondApplied) {
            if (numCols === 2) {
                title = idx === 0 ? 'Pipeline Entry' : 'Current Stage';
            } else {
                title = idx === 0 ? 'All Tracked' : idx === 1 ? 'Entry Track' : 'Current Stage';
            }
        } else {
            const titles = ['1. Pipeline Entry', '2. Initial Triage', '3. Screening Loop', '4. Interview Loop', '5. Offer Decision'];
            title = titles[idx] || `Stage ${idx + 1}`;
        }
        return { index: idx, x, title };
    });

    return {
        nodes: Array.from(rawNodes.values()),
        links: computedLinks,
        columns: columnHeaders,
        numCols,
        stats,
        width,
        height,
        isEmpty: false,
        effectiveMode: (mode === 'direct' || !hasProgressionBeyondApplied) ? 'direct' : 'funnel'
    };
}

/**
 * Generates a plain-text / Markdown summary of the user's pipeline stats and Sankey flows
 * for 1-click clipboard sharing.
 */
export function formatPipelineSummaryMarkdown(stats) {
    if (!stats || stats.totalTracked === 0) {
        return 'Job Search Pipeline Summary: 0 tracked opportunities.';
    }
    const { rates } = stats;
    const lines = [
        `📊 **Job Search Pipeline & Conversion Summary**`,
        `- **Total Tracked Opportunities:** ${stats.totalTracked} (${stats.totalApplied} Applied · ${stats.wishlistCount} Wishlist)`,
        `- **Screening / Callback Rate:** ${rates.screeningRate}% (${stats.screeningReachedCount} of ${stats.totalApplied} applied)`,
        `- **Interview Conversion Rate:** ${rates.interviewRate}% (${stats.interviewReachedCount} reached interviews)`,
        `- **Offer Success Rate:** ${rates.offerRate}% (${stats.offerReachedCount} offers · ${rates.interviewToOfferRate}% interview-to-offer)`,
        `- **Active Pipeline:** ${stats.activePipelineCount} roles in play (${stats.appliedActiveCount} Applied, ${stats.screeningActiveCount} Screening, ${stats.interviewActiveCount} Interviewing, ${stats.offerPendingCount} Offer)`,
        `- **Resolved:** ${stats.acceptedCount} Accepted · ${stats.rejectedTotalCount} Rejected (${rates.rejectionRate}%) · ${stats.archivedTotalCount} Archived`
    ];
    return lines.join('\n');
}
