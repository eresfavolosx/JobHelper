## 2026-02-16 - Kanban Board Re-renders
**Learning:** The Kanban board architecture was re-rendering all columns on every drag start/end because of inline `jobs.filter` logic inside the main render loop. This caused unnecessary VDOM diffing for all columns even when only dragging an item.
**Action:** Extracted column rendering into a memoized `KanbanColumn` component. This isolates column updates, ensuring only affected columns re-render when jobs change, and NO columns re-render when global drag state (activeId) changes.
