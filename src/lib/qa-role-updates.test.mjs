import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
    normalizeCompanyName, 
    extractDomainFromEmail, 
    findMatchingJob, 
    calculateJobAlertStatus, 
    classifyEmailIntent 
} from './email-matcher.js';

describe('QA Test Suite: Role Updates & Email Synchronization', () => {

    describe('1. Company Name Normalization & Domain Extraction', () => {
        it('should strip corporate legal suffixes', () => {
            assert.equal(normalizeCompanyName('Stripe, Inc.'), 'stripe');
            assert.equal(normalizeCompanyName('Google LLC'), 'google');
            assert.equal(normalizeCompanyName('Netflix Corp.'), 'netflix');
            assert.equal(normalizeCompanyName('Datadog Technologies Ltd'), 'datadog');
        });

        it('should extract company name from recruiter email domain', () => {
            assert.equal(extractDomainFromEmail('recruiting@stripe.com'), 'stripe');
            assert.equal(extractDomainFromEmail('jobs@google.com'), 'google');
            assert.equal(extractDomainFromEmail('sara.recruiter@figma.com'), 'figma');
        });

        it('should ignore generic email providers and ATS domains as company names', () => {
            assert.equal(extractDomainFromEmail('recruiter@gmail.com'), '');
            assert.equal(extractDomainFromEmail('no-reply@greenhouse-mail.io'), '');
            assert.equal(extractDomainFromEmail('notifications@ashbyhq.com'), '');
            assert.equal(extractDomainFromEmail('updates@lever.co'), '');
        });
    });

    describe('2. Matching Incoming Emails to Tracked Applications', () => {
        const activeJobs = [
            { id: 'job-1', company: 'Stripe', role: 'Full Stack Engineer', status: 'applied' },
            { id: 'job-2', company: 'Google', role: 'Staff Software Engineer', status: 'interviewing' },
            { id: 'job-3', company: 'Figma', role: 'Frontend Engineer', status: 'applied' }
        ];

        it('should match an email by sender domain', () => {
            const email = {
                from: 'talent@stripe.com',
                subject: 'Next steps with our engineering team',
                snippet: 'We loved your background and would like to chat.'
            };
            const match = findMatchingJob(email, activeJobs);
            assert.ok(match, 'Should have matched a job');
            assert.equal(match.id, 'job-1');
            assert.equal(match.company, 'Stripe');
        });

        it('should match an ATS email by subject line mentioning the company', () => {
            const email = {
                from: 'no-reply@greenhouse-mail.io',
                subject: 'Update regarding your Figma application',
                snippet: 'Thank you for your interest in our Frontend Engineer role.'
            };
            const match = findMatchingJob(email, activeJobs);
            assert.ok(match, 'Should have matched Figma from subject');
            assert.equal(match.id, 'job-3');
            assert.equal(match.company, 'Figma');
        });

        it('should match by company name appearing in email snippet', () => {
            const email = {
                from: 'recruiter@ashbyhq.com',
                subject: 'Exciting news regarding your candidacy',
                snippet: 'The team at Google is excited to invite you to our virtual onsite.'
            };
            const match = findMatchingJob(email, activeJobs);
            assert.ok(match, 'Should have matched Google from snippet');
            assert.equal(match.id, 'job-2');
        });

        it('should NOT produce false positives for unrelated companies', () => {
            const email = {
                from: 'talent@apple.com',
                subject: 'Apple Careers: New open roles',
                snippet: 'Explore our latest hardware and software engineering positions.'
            };
            const match = findMatchingJob(email, activeJobs);
            assert.equal(match, null, 'Apple should not match Stripe, Google, or Figma');
        });
    });

    describe('3. Role Timeline & Alert Logic (Ghost Alerts vs. Follow-up Windows)', () => {
        const NOW = 1718000000000; // Reference timestamp
        const ONE_DAY = 1000 * 60 * 60 * 24;

        it('should flag jobs applied >= 10 days ago as Ghost Alerts', () => {
            const ghostJob = {
                id: 'ghost-1',
                company: 'Airbnb',
                role: 'Backend Engineer',
                status: 'applied',
                appliedAt: new Date(NOW - 12 * ONE_DAY).toISOString()
            };
            const alert = calculateJobAlertStatus(ghostJob, NOW);
            assert.equal(alert.isAlert, true);
            assert.equal(alert.type, 'ghost');
            assert.equal(alert.days, 12);
        });

        it('should flag jobs applied 5-9 days ago as Follow-Up Windows', () => {
            const followUpJob = {
                id: 'follow-1',
                company: 'Uber',
                role: 'Senior Engineer',
                status: 'applied',
                appliedAt: new Date(NOW - 6 * ONE_DAY).toISOString()
            };
            const alert = calculateJobAlertStatus(followUpJob, NOW);
            assert.equal(alert.isAlert, true);
            assert.equal(alert.type, 'followup');
            assert.equal(alert.days, 6);
        });

        it('should mark recently applied jobs (< 5 days) as Healthy / Active', () => {
            const freshJob = {
                id: 'fresh-1',
                company: 'Vercel',
                role: 'Next.js Developer',
                status: 'applied',
                appliedAt: new Date(NOW - 2 * ONE_DAY).toISOString()
            };
            const alert = calculateJobAlertStatus(freshJob, NOW);
            assert.equal(alert.isAlert, false);
            assert.equal(alert.type, 'healthy');
        });

        it('should immediately clear Ghost Alert when updatedAt is refreshed with a new update', () => {
            const updatedJob = {
                id: 'ghost-1',
                company: 'Airbnb',
                role: 'Backend Engineer',
                status: 'applied',
                appliedAt: new Date(NOW - 14 * ONE_DAY).toISOString(),
                // Recruiter email received today!
                updatedAt: new Date(NOW).toISOString()
            };
            const alert = calculateJobAlertStatus(updatedJob, NOW);
            assert.equal(alert.isAlert, false, 'Alert should be cleared because updatedAt is recent');
            assert.equal(alert.type, 'healthy');
        });

        it('should reset no comms counter and clear Ghost Alert when a follow-up marker is logged (lastFollowUpAt)', () => {
            const followedUpJob = {
                id: 'ghost-fu',
                company: 'Stripe',
                role: 'Staff Engineer',
                status: 'applied',
                appliedAt: new Date(NOW - 18 * ONE_DAY).toISOString(),
                // Followed up 1 day ago
                lastFollowUpAt: new Date(NOW - 1 * ONE_DAY).toISOString()
            };
            const alert = calculateJobAlertStatus(followedUpJob, NOW);
            assert.equal(alert.isAlert, false, 'Ghost alert should be cleared because a follow-up was logged');
            assert.equal(alert.type, 'healthy');
            assert.equal(alert.days, 1);
        });

        it('should reset no comms counter when followUps array contains recent outreach', () => {
            const followedUpJobWithList = {
                id: 'ghost-list',
                company: 'Linear',
                role: 'Product Engineer',
                status: 'applied',
                appliedAt: new Date(NOW - 25 * ONE_DAY).toISOString(),
                followUps: [
                    {
                        id: 'fu-1',
                        date: new Date(NOW).toISOString(),
                        channel: 'email',
                        note: 'Followed up with hiring manager'
                    }
                ]
            };
            const alert = calculateJobAlertStatus(followedUpJobWithList, NOW);
            assert.equal(alert.isAlert, false);
            assert.equal(alert.type, 'healthy');
            assert.equal(alert.days, 0);
        });

        it('should never trigger alerts for terminal statuses (offer, rejected, deleted)', () => {
            const rejectedJob = {
                id: 'rej-1',
                company: 'Meta',
                status: 'rejected',
                appliedAt: new Date(NOW - 30 * ONE_DAY).toISOString()
            };
            const offerJob = {
                id: 'off-1',
                company: 'Amazon',
                status: 'offer',
                appliedAt: new Date(NOW - 20 * ONE_DAY).toISOString()
            };
            assert.equal(calculateJobAlertStatus(rejectedJob, NOW).isAlert, false);
            assert.equal(calculateJobAlertStatus(offerJob, NOW).isAlert, false);
        });
    });

    describe('4. Email Intent & Status Transition Classification', () => {
        it('should classify interview invitation and suggest "interviewing"', () => {
            const email = "We were impressed with your resume and would like to schedule a 30-minute phone screen next week. Please pick a slot on my calendly.com/recruiter link.";
            const intent = classifyEmailIntent(email);
            assert.equal(intent.category, 'interview_invite');
            assert.equal(intent.suggestedStatus, 'interviewing');
        });

        it('should classify technical coding assessment and suggest "interviewing"', () => {
            const email = "As the next round of our hiring process, please complete the following 75-minute HackerRank coding challenge within 5 business days.";
            const intent = classifyEmailIntent(email);
            assert.equal(intent.category, 'interview_invite');
            assert.equal(intent.suggestedStatus, 'interviewing');
        });

        it('should classify job offer letter and suggest "offer"', () => {
            const email = "We are pleased to offer you the position of Senior Full Stack Developer at Acme Corp! Attached is your formal offer letter detailing compensation and benefits.";
            const intent = classifyEmailIntent(email);
            assert.equal(intent.category, 'offer');
            assert.equal(intent.suggestedStatus, 'offer');
        });

        it('should classify polite rejection and suggest "rejected"', () => {
            const email = "Thank you for taking the time to interview with us. After careful consideration, we have decided to move forward with other candidates whose experience more closely aligns with our current needs.";
            const intent = classifyEmailIntent(email);
            assert.equal(intent.category, 'rejection');
            assert.equal(intent.suggestedStatus, 'rejected');
        });

        it('should classify application confirmation and keep status as "applied"', () => {
            const email = "Thank you for applying to Stripe! We have received your application for Senior Software Engineer and our recruiting team is currently reviewing your profile.";
            const intent = classifyEmailIntent(email);
            assert.equal(intent.category, 'confirmation');
            assert.equal(intent.suggestedStatus, 'applied');
        });

        it('should ignore generic marketing / newsletter emails', () => {
            const email = "Check out our weekly engineering blog post about scaling microservices with Redis.";
            const intent = classifyEmailIntent(email);
            assert.equal(intent.category, 'unknown');
            assert.equal(intent.suggestedStatus, null);
        });
    });

    describe('5. End-to-End Simulation: Resolving a Ghost Alert via Email Sync', () => {
        it('simulates receiving an interview invite for a 12-day ghosted role and updating the pipeline', () => {
            const NOW = 1718000000000;
            const ONE_DAY = 1000 * 60 * 60 * 24;

            // 1. Initial State: Job has been silent for 12 days
            let job = {
                id: 'job-stripe-99',
                company: 'Stripe',
                role: 'Software Engineer',
                status: 'applied',
                appliedAt: new Date(NOW - 12 * ONE_DAY).toISOString(),
                notes: 'Applied via company careers page.'
            };

            // 2. Verify it is flagged as a Ghost Alert
            const initialAlert = calculateJobAlertStatus(job, NOW);
            assert.equal(initialAlert.isAlert, true);
            assert.equal(initialAlert.type, 'ghost');
            assert.equal(initialAlert.days, 12);

            // 3. New incoming email from Stripe recruiter arrives
            const incomingEmail = {
                from: 'recruiting@stripe.com',
                subject: 'Interview Invitation: Stripe Software Engineering',
                snippet: 'We would love to schedule a time to speak with our engineering manager next Tuesday.'
            };

            // 4. Match email to job
            const matchedJob = findMatchingJob(incomingEmail, [job]);
            assert.ok(matchedJob);
            assert.equal(matchedJob.id, job.id);

            // 5. Classify intent
            const intent = classifyEmailIntent(incomingEmail.snippet + ' ' + incomingEmail.subject);
            assert.equal(intent.suggestedStatus, 'interviewing');

            // 6. Apply Status Move and Refresh Timestamp
            job = {
                ...job,
                status: intent.suggestedStatus,
                updatedAt: new Date(NOW).toISOString(),
                notes: `${job.notes}\n\n[AI Email Update]: Invitation to speak with engineering manager.`
            };

            // 7. Verify that Ghost Alert is now completely resolved!
            const postAlert = calculateJobAlertStatus(job, NOW);
            assert.equal(postAlert.isAlert, false);
            assert.equal(postAlert.type, 'healthy');
            assert.equal(job.status, 'interviewing');
        });
    });

    describe('6. End-to-End Simulation: Atlassian Recruiter Update & Fallback Ingestion', () => {
        it('should accurately match an Atlassian email update and transition status to interviewing', () => {
            const activeJobs = [
                { id: 'job-atlassian-1', company: 'Atlassian', role: 'Full Stack Engineer', status: 'applied' },
                { id: 'job-google-2', company: 'Google', role: 'Software Engineer', status: 'applied' }
            ];

            const atlassianEmail = {
                from: 'talent-acquisition@atlassian.com',
                subject: 'Next steps regarding your application at Atlassian',
                snippet: 'We would love to invite you to schedule a 45-minute technical screen with one of our Engineering Managers next week.'
            };

            // 1. Deterministic match must pinpoint the Atlassian card
            const match = findMatchingJob(atlassianEmail, activeJobs);
            assert.ok(match, 'Should match the Atlassian job');
            assert.equal(match.id, 'job-atlassian-1');
            assert.equal(match.company, 'Atlassian');

            // 2. Classify intent must suggest interviewing
            const intent = classifyEmailIntent(`${atlassianEmail.subject} ${atlassianEmail.snippet}`);
            assert.equal(intent.category, 'interview_invite');
            assert.equal(intent.suggestedStatus, 'interviewing');
            assert.ok(intent.confidence >= 90);
        });
    });
});
