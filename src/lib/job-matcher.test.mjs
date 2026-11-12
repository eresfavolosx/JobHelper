import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_SALARY_FLOOR,
    TTKE_FALLBACK_SALARY_FLOOR,
    ELIGIBILITY_OUTCOMES,
    RECOMMENDATION_LABELS,
    DEFAULT_CANDIDATE_PROFILE,
    computeNonOverlappingMonths,
    extractPostingFacts,
    evaluateEligibilityGates,
    evaluateJobPosting,
    selectActionableRecommendations,
    checkDuplicateApplication,
    computePostingFingerprint,
} from './job-matcher.js';

test('1. Career history separates Co-Founder as evidence, not default target title, and welcomes non-senior MetLife roles', () => {
    assert.equal(DEFAULT_CANDIDATE_PROFILE.targetRoleFamilies.includes('Co-Founder'), false);
    assert.equal(DEFAULT_CANDIDATE_PROFILE.allowNonSeniorRoles, true);

    const metlifeRole = evaluateJobPosting({
        title: 'MetLife: Marketing Operations Specialist',
        link: 'https://careers.metlife.com/job/marketing-ops-specialist-101',
        source: 'MetLife Careers',
        description: `
            Location: Remote - Puerto Rico & US Territories eligible.
            Salary: $88,000 - $102,000 per year. Full-time.
            Req ID: ML-4421.
            Duties: Manage CRM lifecycle campaigns, HubSpot automation, campaign attribution, SQL KPI reporting, and cross-functional agency/vendor coordination.
            Occasional travel (10%) for quarterly team planning.
            Bachelor's degree or equivalent practical experience.
        `,
    });

    assert.equal(metlifeRole.eligibility.overall, ELIGIBILITY_OUTCOMES.PASS);
    assert.notEqual(metlifeRole.label, RECOMMENDATION_LABELS.SKIP);
    assert.ok(metlifeRole.relevanceScore >= 65);
});

test('2. India-only Koru and Philippines-only roles fail Puerto Rico location gate -> Skip', () => {
    const koruIndia = evaluateJobPosting({
        title: 'Koru: Growth Marketing Manager',
        link: 'https://example.com/koru-india',
        description: 'Remote - India only. Full-time. Paid media, growth experiments, and SQL reporting. Salary: $95,000/yr.',
    });

    assert.equal(koruIndia.puertoRicoStatus, ELIGIBILITY_OUTCOMES.FAIL);
    assert.equal(koruIndia.eligibility.overall, ELIGIBILITY_OUTCOMES.FAIL);
    assert.equal(koruIndia.label, RECOMMENDATION_LABELS.SKIP);

    const philippinesOnly = evaluateJobPosting({
        title: 'Acme: Marketing Ops Coordinator',
        link: 'https://example.com/ph-only',
        description: 'Philippines only — must reside in the Philippines. Lifecycle CRM, HubSpot automation, $90,000/yr.',
    });

    assert.equal(philippinesOnly.puertoRicoStatus, ELIGIBILITY_OUTCOMES.FAIL);
    assert.equal(philippinesOnly.label, RECOMMENDATION_LABELS.SKIP);
});

test('3. Nursing roles fail mandatory credential requirements -> Skip', () => {
    const nursingRole = evaluateJobPosting({
        title: 'HealthFirst: Clinical Telehealth Coordinator (RN)',
        link: 'https://example.com/rn-role',
        description: `
            Remote in Puerto Rico. Salary: $95,000 per year.
            Active RN (Registered Nurse) license required. BSN degree required.
            Provide clinical patient triage and bedside care coordination.
        `,
    });

    assert.equal(nursingRole.eligibility.gates.credentials.status, ELIGIBILITY_OUTCOMES.FAIL);
    assert.equal(nursingRole.eligibility.overall, ELIGIBILITY_OUTCOMES.FAIL);
    assert.equal(nursingRole.label, RECOMMENDATION_LABELS.SKIP);
});

test('4. Sezzle capped at $72k fails normal $85k salary floor -> Skip', () => {
    const sezzle = evaluateJobPosting({
        title: 'Sezzle: Lifecycle Marketing Specialist',
        link: 'https://example.com/sezzle-72k',
        description: `
            Location: Puerto Rico eligible, Remote.
            Compensation: $65,000 - $72,000 per year. Full-time.
            Manage email lifecycle, CRM automation, retention campaigns, and SQL performance reporting.
        `,
    });

    assert.equal(sezzle.eligibility.gates.salary.effectiveFloor, DEFAULT_SALARY_FLOOR);
    assert.equal(sezzle.eligibility.gates.salary.status, ELIGIBILITY_OUTCOMES.FAIL);
    assert.equal(sezzle.eligibility.overall, ELIGIBILITY_OUTCOMES.FAIL);
    assert.equal(sezzle.label, RECOMMENDATION_LABELS.SKIP);
});

test('5. Digible scores well on duties/skills but marks Remote US Puerto Rico eligibility as unknown -> Needs clarification', () => {
    const digible = evaluateJobPosting({
        title: 'Digible: Performance Marketing & BI Strategist',
        link: 'https://example.com/digible',
        description: `
            Location: Remote US.
            Compensation: $90,000 - $105,000 annually. Full-time.
            Own paid media acquisition, Google Ads & Meta Ads optimization, client budget management, SQL/Looker KPI dashboards, and marketing operations attribution.
            Occasional travel (<15%).
        `,
    });

    assert.ok(digible.relevanceScore >= 65);
    assert.equal(digible.puertoRicoStatus, ELIGIBILITY_OUTCOMES.UNKNOWN);
    assert.equal(digible.eligibility.overall, ELIGIBILITY_OUTCOMES.UNKNOWN);
    assert.equal(digible.label, RECOMMENDATION_LABELS.NEEDS_CLARIFICATION);
});

test('6. TTKE $70,000 role acts as a one-role fallback without lowering the global $85,000 floor', () => {
    const ttke = evaluateJobPosting({
        title: 'TTKE: Growth & Operations Manager',
        link: 'https://example.com/ttke',
        description: `
            Puerto Rico eligible remote role.
            Salary: $70,000 per year. Full-time.
            Lead paid acquisition, client delivery, CRM lifecycle, and AI workflow operations.
        `,
    });

    assert.equal(ttke.eligibility.gates.salary.isTtkeFallback, true);
    assert.equal(ttke.eligibility.gates.salary.effectiveFloor, TTKE_FALLBACK_SALARY_FLOOR);
    assert.equal(ttke.eligibility.gates.salary.status, ELIGIBILITY_OUTCOMES.PASS);
    assert.equal(ttke.eligibility.overall, ELIGIBILITY_OUTCOMES.PASS);
    assert.notEqual(ttke.label, RECOMMENDATION_LABELS.SKIP);

    // Ensure another non-TTKE role at $70k still fails the $85k floor
    const other70k = evaluateJobPosting({
        title: 'OtherCo: Growth Manager',
        link: 'https://example.com/other-70k',
        description: 'Puerto Rico eligible. Salary: $70,000 per year. Full-time. Growth marketing and CRM.',
    });
    assert.equal(other70k.eligibility.gates.salary.effectiveFloor, DEFAULT_SALARY_FLOOR);
    assert.equal(other70k.eligibility.gates.salary.status, ELIGIBILITY_OUTCOMES.FAIL);
});

test('7. Hourly contracts and course stipends are NOT treated as guaranteed annual salaries; undisclosed stays unknown', () => {
    const hourly = extractPostingFacts({
        title: 'Agency: Marketing Ops Contractor',
        description: 'Contract role. Pay: $45/hr. Manage HubSpot and SQL dashboards.',
    });
    assert.equal(hourly.salary.payPeriod, 'hourly');
    assert.equal(hourly.salary.isGuaranteedAnnualSalary, false);
    assert.equal(evaluateEligibilityGates(hourly).gates.salary.status, ELIGIBILITY_OUTCOMES.UNKNOWN);

    const stipend = extractPostingFacts({
        title: 'Bootcamp: AI Operations Fellow',
        description: 'Course stipend of $2,000 per month during 12-week fellowship.',
    });
    assert.equal(stipend.salary.payPeriod, 'stipend');
    assert.equal(stipend.salary.isGuaranteedAnnualSalary, false);

    const undisclosed = extractPostingFacts({
        title: 'SaaS Co: Product Marketing Manager',
        description: 'Puerto Rico remote. Lead GTM launches and positioning.',
    });
    assert.equal(undisclosed.salary.payPeriod, 'undisclosed');
    assert.equal(evaluateEligibilityGates(undisclosed).gates.salary.status, ELIGIBILITY_OUTCOMES.UNKNOWN);
});

test('8. Overlapping job periods are unioned without inflating experience, and domain non-equivalences hold', () => {
    const months = computeNonOverlappingMonths([
        { start: '2020-01', end: '2023-12' }, // 48 months
        { start: '2022-01', end: '2023-12' }, // completely overlapping 24 months
    ]);
    assert.equal(months, 48);

    const dataEngRole = evaluateJobPosting({
        title: 'DataCo: Production Data Engineer',
        description: 'Puerto Rico remote. $120,000/yr. Build Spark, Airflow, Kafka ETL pipelines and distributed data systems with SQL.',
    });
    assert.ok(dataEngRole.realGaps.some(g => g.includes('SQL analytics is not production data engineering')));

    const hipaaRole = evaluateJobPosting({
        title: 'MedCorp: HIPAA Compliance Officer',
        description: 'Puerto Rico remote. $110,000/yr. Healthcare company seeking HIPAA privacy officer to own regulatory HIPAA audits.',
    });
    assert.ok(hipaaRole.realGaps.some(g => g.includes('healthcare marketing is not HIPAA compliance ownership')));
});

test('9. Duplicate check matches employer+requisitionId or canonicalUrl, while allowing different roles at same company', () => {
    const trackedJobs = [
        {
            company: 'MetLife',
            role: 'Marketing Operations Specialist',
            requisitionId: 'ML-100',
            url: 'https://careers.metlife.com/job/ml-100?utm_source=linkedin',
            status: 'applied',
        },
    ];

    const sameByUrl = extractPostingFacts({
        title: 'MetLife: Marketing Operations Specialist',
        link: 'https://careers.metlife.com/job/ml-100?ref=rss',
    });
    assert.equal(checkDuplicateApplication(sameByUrl, trackedJobs).isDuplicate, true);

    const sameByReqId = extractPostingFacts({
        title: 'MetLife Inc.: Marketing Ops Specialist',
        link: 'https://other-mirror.com/job/999',
        description: 'Req ID: ML-100.',
    });
    assert.equal(checkDuplicateApplication(sameByReqId, trackedJobs).isDuplicate, true);

    const differentRoleSameCompany = extractPostingFacts({
        title: 'MetLife: Technical Program Manager',
        link: 'https://careers.metlife.com/job/ml-202',
        description: 'Req ID: ML-202.',
    });
    assert.equal(checkDuplicateApplication(differentRoleSameCompany, trackedJobs).isDuplicate, false);
});

test('10. Zero recommendations returned when none qualify (no padding) & fingerprints detect unchanged postings', () => {
    const rejectedOnly = [
        evaluateJobPosting({
            title: 'Koru: Growth Lead',
            link: 'https://example.com/koru',
            description: 'India only. $95,000/yr.',
        }),
        evaluateJobPosting({
            title: 'Sezzle: Lifecycle Specialist',
            link: 'https://example.com/sezzle',
            description: 'Puerto Rico. $72,000/yr.',
        }),
    ];

    assert.deepEqual(selectActionableRecommendations(rejectedOnly), []);

    const job = { title: 'Role A', link: 'https://example.com/a?utm_source=rss', description: 'GTM & Lifecycle' };
    const fp1 = computePostingFingerprint(job);
    const fp2 = computePostingFingerprint({ ...job, link: 'https://example.com/a' });
    assert.equal(fp1, fp2);
});
