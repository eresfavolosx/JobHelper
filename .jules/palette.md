## 2024-05-22 - Form Accessibility & Clarity
**Learning:** Forms lacking explicit label-input association (`htmlFor` + `id`) fail accessibility standards and reduce usability for all users (e.g., clicking label doesn't focus input). Visual indicators for required fields are also critical for clarity.
**Action:** Always link labels to inputs with unique IDs and use a distinct visual marker (e.g., red asterisk) for required fields.

## 2025-05-23 - Keyboard Accessibility for Drag-and-Drop
**Learning:** Default drag-and-drop implementations often rely solely on mouse/touch events, excluding keyboard users. Libraries like `@dnd-kit` provide specific sensors (`KeyboardSensor`) and coordinate getters (`sortableKeyboardCoordinates`) that must be explicitly configured to enable keyboard interaction.
**Action:** Always verify keyboard accessibility for interactive components. For `@dnd-kit`, ensure `KeyboardSensor` is added to `useSensors` and configured with appropriate coordinates.
