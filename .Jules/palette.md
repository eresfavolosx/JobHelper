## 2024-05-24 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found an app-wide pattern where custom icon-only buttons (like the password visibility toggle in `login/page.js`, modal close button in `AddJobModal.js`, and toast dismiss button in `UndoToast.js`) were missing `aria-label` and `title` attributes. This reduces accessibility for screen reader users and those relying on tooltips.
**Action:** Ensure all icon-only buttons receive descriptive `aria-label` (for screen readers) and `title` (for tooltips) attributes to maintain a high accessibility standard.
## 2026-03-09 - Replace blocking alerts with inline feedback
**Learning:** Native alert() dialogs interrupt user flow and are not accessible or pleasant for frequent actions like adding recommended jobs to a board.
**Action:** Use inline state-based feedback on buttons (e.g., swapping to a Check icon, updating text, and changing colors temporarily) to provide smooth, non-blocking confirmation.
