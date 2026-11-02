// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
// Preview-only state: never serialized into a project or undo snapshot.
let editingId: string | null = null;
export function isCanvasEditing(id: string) { return editingId === id; }
export function setCanvasEditing(id: string | null) {
  editingId = id;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('motion-canvas-edit'));
}
