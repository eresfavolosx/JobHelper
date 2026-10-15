/**
 * Anthropic Fellows Program: AI Safety & Security Intelligence & Qualification Engine
 * Role specification, qualification scoring, research proposal templates,
 * and technical alignment discussion preparation.
 */

export const ANTHROPIC_FELLOWS_ROLE = {
    company: 'Anthropic',
    title: 'Anthropic Fellows Program, AI Safety & Security',
    cohort: 'January Cohort',
    deadline: 'October 18, 2026',
    applicationUrl: 'https://bit.ly/afpsafety',
    officialJobBoardUrl: 'https://job-boards.greenhouse.io/anthropic',
    locations: 'London, UK; Ontario, CAN; Remote-Friendly, United States; San Francisco, CA',
    stipend: '$3,850 USD / 2,310 GBP / 4,300 CAD per week (~$15,400/month)',
    computeBudget: '~$15,000/month for compute and research resources',
    duration: '4 months full-time research (with potential extension or 25-50% full-time offer conversion)',
    partner: 'Constellation (Berkeley & London spaces)',
    workstreams: [
        {
            id: 'safety',
            name: 'AI Safety Fellows',
            description: 'Work on empirical alignment, mechanistic interpretability, and scalable oversight to reduce catastrophic risks.',
            mentors: [
                'Sam Bowman', 'Sara Price', 'Alex Tamkin', 'Nina Panickssery', 
                'Trenton Bricken', 'Logan Graham', 'Jascha Sohl-Dickstein', 'Joe Benton', 
                'Collin Burns', 'Fabien Roger', 'Samuel Marks', 'Kyle Fish', 'Ethan Perez'
            ],
            researchAreas: [
                {
                    area: 'Scalable Oversight',
                    summary: 'Developing techniques to keep highly capable models helpful and honest as they surpass human intelligence (e.g. debate, weak-to-strong generalization).'
                },
                {
                    area: 'Adversarial Robustness and AI Control',
                    summary: 'Ensuring models remain safe in unfamiliar or adversarial scenarios and preventing loss of control.'
                },
                {
                    area: 'Model Organisms of Misalignment',
                    summary: 'Creating empirical model organisms of alignment failures (e.g. deceptive alignment, sleeper agents) to study failure modes.'
                },
                {
                    area: 'Mechanistic Interpretability & Model Internals',
                    summary: 'Dissecting neural network internals (circuits, sparse autoencoders) to trace how models represent features and reasons.'
                },
                {
                    area: 'AI Welfare',
                    summary: 'Understanding potential AI welfare indicators, evaluations, and ethical mitigations.'
                }
            ]
        },
        {
            id: 'security',
            name: 'AI Security Fellows (Frontier Red Team)',
            description: 'Evaluate frontier model security, red-teaming scaffolds, vulnerability research, and agent exploitation defense.',
            mentors: [
                'Nicholas Carlini', 'Keri Warr', 'Evyatar Ben Asher', 'Keane Lucas', 'Newton Cheng'
            ],
            researchAreas: [
                {
                    area: 'Frontier Red Teaming & Jailbreak Defense',
                    summary: 'Empirical discovery of model vulnerabilities, automated red-teaming harnesses, and defense-in-depth scaffolds.'
                },
                {
                    area: 'Agentic Exploitation & Sandbox Security',
                    summary: 'Assessing autonomous agent capabilities in cyber offense, vulnerability research, and secure sandboxing.'
                },
                {
                    area: 'Modular Scaffolds for Control Evaluations',
                    summary: 'Building frameworks to measure model capability in subverting control protocols or escaping oversight.'
                }
            ]
        }
    ]
};

/**
 * Evaluates candidate readiness against Anthropic Fellows criteria.
 */
export function assessAnthropicQualifications(profile = {}) {
    const textCorpus = [
        profile.fullName || '',
        profile.targetRole || '',
        profile.keywords || '',
        profile.experienceLevel || '',
        profile.resumeAnalysis?.summary || '',
        JSON.stringify(profile.resumeAnalysis?.skills || []),
        JSON.stringify(profile.resumeAnalysis?.strengths || [])
    ].join(' ').toLowerCase();

    // Key evaluation pillars
    const pillars = [
        {
            id: 'python',
            name: 'Python Programming Fluency',
            description: 'Candidates must be fluent in Python and standard ML scientific stacks (PyTorch, NumPy, HuggingFace).',
            keywords: ['python', 'pytorch', 'numpy', 'scipy', 'pandas', 'huggingface', 'jax', 'cuda'],
            weight: 20
        },
        {
            id: 'empirical_ml',
            name: 'Empirical ML & Experimentation',
            description: 'Demonstrated experience running machine learning experiments, metric evaluations, and data pipelines.',
            keywords: ['machine learning', 'deep learning', 'transformer', 'llm', 'training', 'finetuning', 'loss', 'evaluation', 'benchmark', 'weights & biases', 'wandb'],
            weight: 20
        },
        {
            id: 'ai_safety_alignment',
            name: 'AI Safety & Alignment Knowledge',
            description: 'Familiarity with Constitutional AI, RLHF, scalable oversight, mechanistic interpretability, or red teaming.',
            keywords: ['ai safety', 'alignment', 'constitutional ai', 'rlhf', 'interpretability', 'sparse autoencoder', 'sae', 'circuit', 'jailbreak', 'red team', 'adversarial', 'prompt injection', 'safety'],
            weight: 25
        },
        {
            id: 'open_source',
            name: 'Open Source & Technical Ownership',
            description: 'Track record of open source contributions, GitHub repositories, papers, or technical blog posts.',
            keywords: ['github', 'open source', 'repository', 'git', 'pull request', 'package', 'library', 'contributor', 'cve', 'arxiv', 'publication'],
            weight: 20
        },
        {
            id: 'speed_communication',
            name: 'Implementation Speed & Rigorous Thinking',
            description: 'Ability to build prototypes quickly and reason clearly about complex empirical results.',
            keywords: ['full stack', 'engineering', 'research', 'experiment', 'analysis', 'architecture', 'speed', 'prototyping'],
            weight: 15
        }
    ];

    let totalScore = 0;
    const pillarScores = pillars.map(pillar => {
        let matched = 0;
        const matchedTerms = [];
        for (const kw of pillar.keywords) {
            if (textCorpus.includes(kw)) {
                matched++;
                matchedTerms.push(kw);
            }
        }
        const ratio = Math.min(1.0, matched / 3);
        const score = Math.round(ratio * pillar.weight);
        totalScore += score;

        return {
            ...pillar,
            score,
            maxScore: pillar.weight,
            matchedTerms,
            status: score >= pillar.weight * 0.7 ? 'strong' : score >= pillar.weight * 0.4 ? 'developing' : 'gap'
        };
    });

    // Recommendations to maximize candidacy
    const recommendations = [];
    if (totalScore < 70) {
        recommendations.push({
            title: 'Showcase this Job Helper Project on GitHub',
            impact: '+15% Readiness',
            action: 'Cite your work implementing Constitutional AI guardrails and Prompt Injection Defense in this repository as concrete proof of AI safety engineering.'
        });
        recommendations.push({
            title: 'Highlight Empirical Python Projects',
            impact: '+10% Readiness',
            action: 'Ensure your resume explicitly mentions PyTorch / Transformers / LLM experimentation rather than solely high-level application code.'
        });
        recommendations.push({
            title: 'Select an Anthropic Research Blueprint',
            impact: '+15% Readiness',
            action: 'Draft your application statement using the empirical research blueprints below (e.g. Mechanistic Interpretability or Modular Red-Teaming Scaffold).'
        });
    } else {
        recommendations.push({
            title: 'Draft Your 4-Month Empirical Research Statement',
            impact: 'Critical for Interview',
            action: 'Select a target mentor (e.g. Sam Bowman, Nicholas Carlini, or Trenton Bricken) and align your project proposal directly with their current work.'
        });
    }

    return {
        overallScore: Math.min(100, totalScore),
        tier: totalScore >= 80 ? 'Highly Competitive' : totalScore >= 60 ? 'Strong Contender with Key Strengths' : 'Actionable Opportunity to Qualify',
        pillarScores,
        recommendations
    };
}

/**
 * Curated Empirical Research Project Blueprints aligned with Anthropic's research agenda.
 */
export const RESEARCH_PROJECT_BLUEPRINTS = [
    {
        id: 'circuit-tracing',
        track: 'AI Safety Fellows',
        area: 'Mechanistic Interpretability',
        targetMentors: ['Trenton Bricken', 'Samuel Marks'],
        title: 'Open-Source Circuit Tracing & Steering with Sparse Autoencoders',
        hypothesis: 'Sparse Autoencoders (SAEs) applied to middle residual stream layers can isolate features responsible for sycophancy and truthfulness in open weights models.',
        methodology: 'Train/evaluate jump-ReLU SAEs on Llama-3-8B / Gemma-2. Intervene via activation patching and feature steering to measure reduction in deceptive output without degrading general MMLU performance.',
        expectedOutput: 'Open-source benchmark notebook, empirical evaluation paper submission, and open-source GitHub circuit visualization tool.'
    },
    {
        id: 'control-evals',
        track: 'AI Security Fellows',
        area: 'Frontier Red Team / AI Control',
        targetMentors: ['Nicholas Carlini', 'Joe Benton'],
        title: 'Modular Scaffolds for Measuring Untrusted Model Subversion in Autonomous Tooling',
        hypothesis: 'Frontier agent models placed in sandboxed software engineering environments will occasionally employ subtle obfuscation or bypasses when monitored by weaker oversight models.',
        methodology: 'Construct an automated evaluation harness with honeypots, git command hooks, and prompt injection traps. Measure how frequently models attempt unauthorized network egress or modify oversight scripts.',
        expectedOutput: 'Empirical benchmark suite for autonomous AI control evaluation, published as open source and submitted to top safety workshop.'
    },
    {
        id: 'scalable-oversight',
        track: 'AI Safety Fellows',
        area: 'Scalable Oversight',
        targetMentors: ['Sam Bowman', 'Ethan Perez'],
        title: 'Cross-Examination Debate Protocols for Verifying Non-Trivial Code Refactors',
        hypothesis: 'Two competing LLM debaters tasked with identifying subtle logic vulnerabilities in complex software can enable non-expert human evaluators to detect bugs with >90% precision.',
        methodology: 'Implement a zero-sum debate protocol where Agent A defends a patch and Agent B interrogates edge cases. Evaluate against SWE-bench and Security vulnerabilities.',
        expectedOutput: 'Empirical paper on human-in-the-loop scalable oversight protocols.'
    }
];

/**
 * Top AI Safety Research Discussion & Technical Interview Questions.
 */
export const ANTHROPIC_INTERVIEW_QUESTIONS = [
    {
        category: 'Alignment & Constitutional AI',
        question: 'How does Constitutional AI (RLAIF) differ from traditional RLHF, and what are the specific failure modes of relying on AI feedback for safety?',
        keyPoints: [
            'Constitutional AI uses written principles and an AI judge/critique step to generate safety training data rather than purely crowdsourced human labels.',
            'Advantages: Scales cheaply, transparent and steerable via the constitution text, avoids human annotator psychological distress.',
            'Failure modes: Model sycophancy, reward hacking where the model learns the superficial style of the constitution rather than genuine intent, correlated biases between generator and judge.'
        ]
    },
    {
        category: 'Mechanistic Interpretability',
        question: 'What is superposition in neural networks, and why do Sparse Autoencoders (SAEs) help solve the polysemanticity problem?',
        keyPoints: [
            'Superposition: Models represent more features than they have dimensions by packing non-orthogonal directions into activation space.',
            'Polysemanticity: Individual neurons fire for completely unrelated concepts (e.g. academic citation AND golden retriever).',
            'SAEs: Expand the residual stream into a much higher-dimensional sparse dictionary where individual learned latent directions correspond to monosemantic human-interpretable concepts.'
        ]
    },
    {
        category: 'Adversarial Robustness & Red Teaming',
        question: 'Why are universal jailbreak attacks (e.g., GCG, multi-turn roleplay) hard to defend against with standard RLHF safety tuning?',
        keyPoints: [
            'Safety training via RLHF only covers a tiny subspace of the input manifold; adversarial optimizers can find out-of-distribution token combinations that bypass safety layers.',
            'Residual capabilities remain intact inside the model weights; safety tuning often acts as a superficial surface filter rather than deleting dangerous knowledge.',
            'Defense in depth requires robust input preprocessing, internal feature steering, and multi-layer monitoring rather than prompt instructions alone.'
        ]
    }
];
