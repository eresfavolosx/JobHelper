## 2024-05-24 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found an app-wide pattern where custom icon-only buttons (like the password visibility toggle in `login/page.js`, modal close button in `AddJobModal.js`, and toast dismiss button in `UndoToast.js`) were missing `aria-label` and `title` attributes. This reduces accessibility for screen reader users and those relying on tooltips.
**Action:** Ensure all icon-only buttons receive descriptive `aria-label` (for screen readers) and `title` (for tooltips) attributes to maintain a high accessibility standard.

## 2024-06-25 - Avoid Native Alerts for Interaction Feedback
**Learning:** Using `alert()` for user feedback (like acknowledging an item was added to a list) interrupts the user flow by blocking the main thread and presenting a jarring, system-level dialog.
**Action:** Use inline visual feedback, such as changing button text to "Added!" with a temporary success state (e.g., green background and checkmark icon), to provide smooth, non-blocking confirmation.