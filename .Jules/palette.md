## 2026-03-25 - Missing Tooltips on Icon-Only Buttons
**Learning:** Found that while some icon-only buttons (like the mobile menu toggle and FAB in `src/app/layout.js`) had `aria-label` attributes for screen readers, they lacked the `title` attribute, leaving mouse users without helpful native tooltips.
**Action:** Always include both `aria-label` (for screen readers) and `title` (for visual tooltips on hover) on icon-only buttons to ensure a universally accessible and intuitive experience.
