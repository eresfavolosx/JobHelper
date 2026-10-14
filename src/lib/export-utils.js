/**
 * Utility functions for exporting NovuJobs application board data.
 * Supports:
 * 1. CSV export (compatible with Excel, Google Sheets, Airtable)
 * 2. JSON export (high-fidelity data for AI agents and backups)
 * 3. AI Agent Markdown Briefing (optimized for feeding into LLMs)
 */

function downloadFile(content, fileName, mimeType) {
    if (typeof window === 'undefined') return;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function escapeCsvField(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
}

/**
 * Export jobs array as a clean CSV spreadsheet.
 */
export function exportBoardToCsv(jobs = []) {
    const activeJobs = jobs.filter(j => j && j.status !== 'deleted');
    const headers = [
        'ID',
        'Company',
        'Role',
        'Status',
        'Location',
        'Salary',
        'Commute Time',
        'Relevance Score',
        'Match Reason',
        'Job URL',
        'Created At',
        'Notes'
    ];

    const rows = activeJobs.map(job => [
        escapeCsvField(job.id),
        escapeCsvField(job.company),
        escapeCsvField(job.role || job.title),
        escapeCsvField(job.status),
        escapeCsvField(job.location),
        escapeCsvField(job.salary),
        escapeCsvField(job.commuteTime),
        escapeCsvField(job.relevanceScore ? `${job.relevanceScore}%` : ''),
        escapeCsvField(job.matchReason),
        escapeCsvField(job.url || job.link),
        escapeCsvField(job.createdAt || job.dateAdded),
        escapeCsvField(job.notes)
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(csvContent, `novujobs-board-${dateStr}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Export jobs array as high-fidelity JSON for AI agents or migration.
 */
export function exportBoardToJson(jobs = [], profile = null) {
    const payload = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        platform: 'NovuJobs',
        user: profile?.fullName || 'Anonymous',
        totalJobs: jobs.length,
        jobs: jobs
    };

    const jsonContent = JSON.stringify(payload, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(jsonContent, `novujobs-agent-export-${dateStr}.json`, 'application/json');
}

/**
 * Generates a clean Markdown briefing of active job applications designed specifically for AI Agents.
 */
export function exportAgentBriefing(jobs = []) {
    const activeJobs = jobs.filter(j => j && j.status !== 'deleted');
    const dateStr = new Date().toISOString().slice(0, 10);

    let md = `# NovuJobs Career Agent Briefing\n`;
    md += `*Generated: ${new Date().toLocaleString()}*\n`;
    md += `*Total Active Applications: ${activeJobs.length}*\n\n`;

    const byStatus = {};
    activeJobs.forEach(job => {
        const st = job.status || 'wishlist';
        if (!byStatus[st]) byStatus[st] = [];
        byStatus[st].push(job);
    });

    const statusOrder = ['offer', 'interviewing', 'applied', 'wishlist', 'rejected'];

    statusOrder.forEach(statusKey => {
        const list = byStatus[statusKey] || [];
        if (list.length === 0) return;

        md += `## Stage: ${statusKey.toUpperCase()} (${list.length})\n\n`;
        list.forEach(job => {
            const refDate = job.updatedAt || job.appliedAt || job.createdAt || job.dateAdded;
            let daysAgo = 'Unknown';
            if (refDate) {
                const diff = Date.now() - new Date(refDate).getTime();
                daysAgo = `${Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))} days ago`;
            }

            md += `### ${job.role || job.title} @ ${job.company || 'Unknown'}\n`;
            md += `- **Status**: ${job.status}\n`;
            md += `- **Last Activity**: ${daysAgo}\n`;
            if (job.location) md += `- **Location**: ${job.location}\n`;
            if (job.salary) md += `- **Salary**: ${job.salary}\n`;
            if (job.relevanceScore) md += `- **AI Match**: ${job.relevanceScore}% (${job.matchReason || 'N/A'})\n`;
            if (job.url) md += `- **Listing URL**: ${job.url}\n`;
            if (job.notes) md += `- **Notes**: ${job.notes}\n`;
            md += `\n`;
        });
    });

    downloadFile(md, `novujobs-agent-briefing-${dateStr}.md`, 'text/markdown;charset=utf-8;');
}
