/**
 * Shared configuration and accessible metadata for layout-preserving Skeleton Loaders.
 * Ensures zero Cumulative Layout Shift (CLS) and consistent screen-reader semantics.
 */
export const SKELETON_PRESETS = Object.freeze({
    appShell: {
        label: 'Loading your career workspace',
        sidebarWidth: '240px',
        statCards: 4,
        mainCards: 3,
    },
    dashboard: {
        label: 'Loading dashboard',
        statPills: 3,
        quickCards: 4,
    },
    kanban: {
        label: 'Loading application board',
        columns: 4,
        cardsPerColumn: 3,
    },
    insights: {
        label: 'Loading insights and analytics',
        kpiCards: 4,
        chartHeight: '340px',
    },
    recommendations: {
        label: 'Loading job recommendations',
        defaultCount: 6,
        cardMinHeight: '330px',
    },
    profile: {
        label: 'Loading profile settings',
        sections: 3,
    },
    careerCoach: {
        label: 'Consulting AI Career Agent',
        strategyCards: 3,
    },
});

export function createSkeletonProgressProps(label = 'Loading content') {
    const cleanLabel = typeof label === 'string' && label.trim() ? label.trim() : 'Loading content';
    return {
        'aria-label': cleanLabel,
        className: 'sr-only',
    };
}
