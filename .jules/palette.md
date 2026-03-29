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
## 2024-05-15 - Dashboard Navigation Cards Accessibility
**Learning:** The dashboard used `div` elements with `onClick` handlers and `router.push()` for navigation, which failed to provide native keyboard navigability (`tabIndex`), screen reader semantics (role), and native link behaviors (open in new tab). Wrapping cards in Next.js `<Link>` components seamlessly adds these accessibility features while maintaining the grid layout.
**Action:** When creating large clickable areas for navigation (like cards), always prefer wrapping the content in semantic `<Link>` or `<a>` tags instead of using `div` with `onClick` handlers. Ensure interactive focus styles (like `.interactive-card`) are applied to the `Link` element itself.
## 2026-03-09 - Replace blocking alerts with inline feedback
**Learning:** Native alert() dialogs interrupt user flow and are not accessible or pleasant for frequent actions like adding recommended jobs to a board.
**Action:** Use inline state-based feedback on buttons (e.g., swapping to a Check icon, updating text, and changing colors temporarily) to provide smooth, non-blocking confirmation.
## 2024-05-25 - Inaccessible Div Navigation Cards
**Learning:** Found dashboard cards in `src/app/page.js` using `<div onClick={...}>` with inline `onMouseOver` for hover effects. This breaks keyboard accessibility (tabbing, Enter key) and standard link behavior (open in new tab).
**Action:** Replace navigational `div` elements with standard Next.js `<Link>` components to ensure native accessibility and interaction. Utilize the existing `.interactive-card` class to provide consistent, CSS-based `:focus-visible` and `:hover` states instead of inline JavaScript events.
## 2026-03-10 - Replacing Native Alerts with Inline Feedback
**Learning:** Found instances where native `alert()` calls were used to provide success feedback (e.g., adding a job to the board from AI recommendations). This blocks the UI, interrupts the user's flow, and creates a jarring experience.
**Action:** Replace blocking native alerts with inline visual feedback. For example, temporarily change the clicked button's state to visually confirm the action (e.g., changing text to 'Added!', color to success theme, and disabling it).
## 2026-03-10 - Replace native blocking alerts with inline feedback
**Learning:** Native `alert()` calls for user feedback (such as missing premium features, simulated redirects, or deletion errors) interrupt user flow and present a jarring experience.
**Action:** Replaced `alert()` calls with inline visual feedback. For example, temporarily changing button text and color to indicate a premium feature, or showing an inline error message using an `aria-live="assertive"` region.
## 2024-05-24 - Missing ARIA Labels on Destructive Actions
**Learning:** Found an app-wide pattern where destructive actions (like deleting an account) with confirmation states lacked explicit ARIA labels on both the initial trigger and the subsequent confirmation/cancellation buttons. This reduces accessibility for screen reader users.
**Action:** Ensure all destructive actions and their confirmation states receive descriptive `aria-label` attributes to clearly communicate intent to assistive technologies.
