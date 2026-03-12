## 2024-05-24 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found an app-wide pattern where custom icon-only buttons (like the password visibility toggle in `login/page.js`, modal close button in `AddJobModal.js`, and toast dismiss button in `UndoToast.js`) were missing `aria-label` and `title` attributes. This reduces accessibility for screen reader users and those relying on tooltips.
**Action:** Ensure all icon-only buttons receive descriptive `aria-label` (for screen readers) and `title` (for tooltips) attributes to maintain a high accessibility standard.
## 2024-05-25 - Inaccessible Div Navigation Cards
**Learning:** Found dashboard cards in `src/app/page.js` using `<div onClick={...}>` with inline `onMouseOver` for hover effects. This breaks keyboard accessibility (tabbing, Enter key) and standard link behavior (open in new tab).
**Action:** Replace navigational `div` elements with standard Next.js `<Link>` components to ensure native accessibility and interaction. Utilize the existing `.interactive-card` class to provide consistent, CSS-based `:focus-visible` and `:hover` states instead of inline JavaScript events.
