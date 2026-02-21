## 2024-05-22 - Form Accessibility & Clarity
**Learning:** Forms lacking explicit label-input association (`htmlFor` + `id`) fail accessibility standards and reduce usability for all users (e.g., clicking label doesn't focus input). Visual indicators for required fields are also critical for clarity.
**Action:** Always link labels to inputs with unique IDs and use a distinct visual marker (e.g., red asterisk) for required fields.

## 2025-02-20 - Drag and Drop Keyboard Accessibility
**Learning:** Drag and drop interfaces often neglect keyboard users. `@dnd-kit` requires explicit configuration of `KeyboardSensor` and `sortableKeyboardCoordinates` to enable keyboard interactions. Without this, the feature is completely inaccessible to users who cannot use a mouse.
**Action:** Always verify keyboard accessibility for complex interactions like drag-and-drop and ensure visible focus indicators (`:focus-visible`) are present.
