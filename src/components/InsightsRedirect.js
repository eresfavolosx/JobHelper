"use client";

import { useEffect } from 'react';

/**
 * Lightweight client-side redirect used by legacy analytics routes
 * (/sankey, /gantt, /trends) that are now consolidated under /insights.
 */
export default function InsightsRedirect({ tab }) {
    useEffect(() => {
        window.location.replace(`/insights#${tab}`);
    }, [tab]);

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <div className="spinner" />
        </div>
    );
}
