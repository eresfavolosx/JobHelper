## 2024-05-24 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found an app-wide pattern where custom icon-only buttons (like the password visibility toggle in `login/page.js`, modal close button in `AddJobModal.js`, and toast dismiss button in `UndoToast.js`) were missing `aria-label` and `title` attributes. This reduces accessibility for screen reader users and those relying on tooltips.
**Action:** Ensure all icon-only buttons receive descriptive `aria-label` (for screen readers) and `title` (for tooltips) attributes to maintain a high accessibility standard.
## 2024-06-15 - Inaccessible Navigational Cards
**Learning:** Navigational cards implemented as `div` elements with `onClick` handlers and inline `onMouseOver` animations are not keyboard accessible by default and break semantic HTML.
**Action:** Replace clickable navigation `div` elements with Next.js `<Link>` components, and handle hover/focus states using existing CSS classes (like `.interactive-card`) to ensure proper keyboard navigation and standard focus styles.
