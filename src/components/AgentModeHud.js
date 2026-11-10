"use client";
import React, { useState } from 'react';
import { Bot, Copy, Check, X, ShieldAlert, Cpu } from 'lucide-react';
import { useUIStore } from '@/lib/uiStore';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { buildAgentSnapshot } from '@/lib/agent-helper';

export default function AgentModeHud() {
    const isAgentMode = useUIStore(state => state.isAgentMode);
    const toggleAgentMode = useUIStore(state => state.toggleAgentMode);
    const [copied, setCopied] = useState(false);
    const { user } = useAuth();

    if (!isAgentMode) return null;

    const handleCopySnapshot = async () => {
        try {
            const snapshot = buildAgentSnapshot({
                appStoreState: useAppStore.getState(),
                uiStoreState: useUIStore.getState(),
                user
            });
            await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Failed to copy agent snapshot:', e);
        }
    };

    return (
        <aside
            data-agent-target="hud"
            className="agent-mode-hud"
            role="region"
            aria-label="Agent Navigation Mode HUD"
        >
            <div className="agent-mode-hud-inner">
                <div className="agent-mode-hud-badge">
                    <Bot size={15} className="agent-mode-hud-icon" />
                    <span className="agent-mode-hud-title">AGENT MODE</span>
                    <span className="agent-mode-hud-status">ACTIVE</span>
                </div>

                <div className="agent-mode-hud-info">
                    <span>Zero animations · OCR contrast · Programmatic bridge enabled</span>
                </div>

                <div className="agent-mode-hud-actions">
                    <button
                        type="button"
                        data-agent-action="hud-copy-snapshot"
                        onClick={handleCopySnapshot}
                        className="agent-mode-hud-btn"
                        title="Copy current structured state JSON to clipboard for LLM inspection"
                    >
                        {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        <span>{copied ? 'Copied JSON!' : 'Copy State'}</span>
                    </button>

                    <kbd className="agent-mode-hud-kbd" title="Shortcut to toggle Agent Mode">
                        ⌘⇧A
                    </kbd>

                    <button
                        type="button"
                        data-agent-action="hud-disable-agent-mode"
                        onClick={() => toggleAgentMode()}
                        className="agent-mode-hud-close"
                        aria-label="Disable Agent Navigation Mode"
                        title="Disable Agent Navigation Mode (⌘⇧A)"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
