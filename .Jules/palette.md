## 2024-05-24 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found an app-wide pattern where custom icon-only buttons (like the password visibility toggle in `login/page.js`, modal close button in `AddJobModal.js`, and toast dismiss button in `UndoToast.js`) were missing `aria-label` and `title` attributes. This reduces accessibility for screen reader users and those relying on tooltips.
**Action:** Ensure all icon-only buttons receive descriptive `aria-label` (for screen readers) and `title` (for tooltips) attributes to maintain a high accessibility standard.
## 2026-03-10 - Replacing Native Alerts with Inline Feedback
**Learning:** Found instances where native `alert()` calls were used to provide success feedback (e.g., adding a job to the board from AI recommendations). This blocks the UI, interrupts the user's flow, and creates a jarring experience.
**Action:** Replace blocking native alerts with inline visual feedback. For example, temporarily change the clicked button's state to visually confirm the action (e.g., changing text to 'Added!', color to success theme, and disabling it).
