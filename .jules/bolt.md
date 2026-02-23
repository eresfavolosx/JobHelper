## 2026-02-18 - Kanban Column Memoization
**Learning:** Extracting list components (like Kanban columns) into memoized children is critical when using `dnd-kit`. Drag operations cause state changes (`activeId`) in the parent container, which triggers unnecessary re-renders of all lists if not memoized, leading to jank during drag start/end.
**Action:** When implementing drag-and-drop with `dnd-kit`, always separate the draggable lists into their own memoized components to isolate them from global drag state updates.

## 2026-03-05 - Shallow Array Comparison for Memoized Lists
**Learning:** `React.memo`'s default shallow comparison fails when parent components re-create array references (e.g., via `filter` or `map`) even if the items inside are stable. This is common in Redux/Zustand patterns.
**Action:** Implement a custom `arePropsEqual` function for memoized list components to check item reference stability instead of just array reference stability, avoiding O(N) re-renders.
