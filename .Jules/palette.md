## 2024-05-24 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found an app-wide pattern where custom icon-only buttons (like the password visibility toggle in `login/page.js`, modal close button in `AddJobModal.js`, and toast dismiss button in `UndoToast.js`) were missing `aria-label` and `title` attributes. This reduces accessibility for screen reader users and those relying on tooltips.
**Action:** Ensure all icon-only buttons receive descriptive `aria-label` (for screen readers) and `title` (for tooltips) attributes to maintain a high accessibility standard.

## 2024-10-26 - Placeholder-Only Form Accessibility
**Learning:** Found that the login form (`src/app/login/page.js`) used placeholders instead of explicit `<label>` elements for inputs, which reduces screen reader compatibility and causes accessibility issues since placeholders are not meant to substitute labels.
**Action:** Always use `<label>` elements for inputs. If the design does not accommodate visual labels, use visually hidden `<label>` elements (with `htmlFor` matching the input's `id`) to ensure accessibility is maintained without altering the visual appearance.
## 2024-06-15 - Inaccessible Navigational Cards
**Learning:** Navigational cards implemented as `div` elements with `onClick` handlers and inline `onMouseOver` animations are not keyboard accessible by default and break semantic HTML.
**Action:** Replace clickable navigation `div` elements with Next.js `<Link>` components, and handle hover/focus states using existing CSS classes (like `.interactive-card`) to ensure proper keyboard navigation and standard focus styles.
## 2024-06-25 - Avoid Native Alerts for Interaction Feedback
**Learning:** Using `alert()` for user feedback (like acknowledging an item was added to a list) interrupts the user flow by blocking the main thread and presenting a jarring, system-level dialog.
**Action:** Use inline visual feedback, such as changing button text to "Added!" with a temporary success state (e.g., green background and checkmark icon), to provide smooth, non-blocking confirmation.
## 2024-05-25 - Missing input-label association for form inputs
**Learning:** Found an app-wide pattern where `<input>` and `<select>` elements in forms (like the profile preferences form in `src/app/profile/page.js`) were missing `id` attributes and corresponding `<label htmlFor="...">` bindings. This breaks screen reader functionality, as users cannot determine what the input is for. Additionally, hidden inputs (like the resume upload) or inputs without explicit text labels (like the API key) lacked `aria-label`s.
**Action:** Ensure all form controls have explicitly associated labels using `id` and `htmlFor`. For inputs without a visual text label, provide an `aria-label` attribute to describe the field.
