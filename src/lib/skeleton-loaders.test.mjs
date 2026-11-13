import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SKELETON_PRESETS, createSkeletonProgressProps } from './skeleton-config.js';

test('Skeleton presets define layout-preserving counts for all views', () => {
    assert.ok(SKELETON_PRESETS.appShell.statCards >= 3);
    assert.ok(SKELETON_PRESETS.dashboard.quickCards >= 3);
    assert.ok(SKELETON_PRESETS.kanban.columns >= 3);
    assert.ok(SKELETON_PRESETS.insights.kpiCards >= 4);
    assert.ok(SKELETON_PRESETS.recommendations.defaultCount >= 4);
    assert.ok(SKELETON_PRESETS.profile.sections >= 2);
    assert.ok(SKELETON_PRESETS.careerCoach.strategyCards >= 3);
});

test('createSkeletonProgressProps returns semantic indeterminate <progress> attributes', () => {
    const props = createSkeletonProgressProps('Loading job recommendations');
    assert.equal(props['aria-label'], 'Loading job recommendations');
    assert.equal(props.className, 'sr-only');
    assert.equal('value' in props, false);

    const fallback = createSkeletonProgressProps('   ');
    assert.equal(fallback['aria-label'], 'Loading content');
});

test('SkeletonLoaders components mark decorative blocks aria-hidden and use semantic <progress>', () => {
    const source = fs.readFileSync(new URL('../components/SkeletonLoaders.js', import.meta.url), 'utf8');
    assert.ok(source.includes('aria-hidden="true"'), 'Decorative skeleton blocks must be aria-hidden');
    assert.ok(source.includes('<progress {...progressProps} />'), 'Must use semantic indeterminate <progress>');
    assert.equal(source.includes('aria-live='), false, 'Must not emit noisy aria-live interstitial announcements');
});
