## 2026-02-18 - Kanban Column Memoization
**Learning:** Extracting list components (like Kanban columns) into memoized children is critical when using `dnd-kit`. Drag operations cause state changes (`activeId`) in the parent container, which triggers unnecessary re-renders of all lists if not memoized, leading to jank during drag start/end.
**Action:** When implementing drag-and-drop with `dnd-kit`, always separate the draggable lists into their own memoized components to isolate them from global drag state updates.

## 2026-02-18 - Date Parsing Overhead
**Learning:** Frequent use of utility functions like `safeDate` inside loops or sort comparators can be a significant performance bottleneck due to repeated object creation and parsing.
**Action:** When processing large datasets involving dates (e.g., for charts), always pre-calculate timestamps (`.getTime()`) once and use primitive number comparison for sorting and filtering.
