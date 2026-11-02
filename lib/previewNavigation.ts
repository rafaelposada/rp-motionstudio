// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
export interface PreviewView { zoom: number; x: number; y: number }
export const FIT_VIEW: PreviewView = { zoom: 1, x: 0, y: 0 };
export function panPreview(view: PreviewView, dx: number, dy: number): PreviewView {
  return { ...view, x: view.x + (Number.isFinite(dx) ? dx : 0), y: view.y + (Number.isFinite(dy) ? dy : 0) };
}
export function zoomPreview(view: PreviewView, requested: number, anchor = { x: 0, y: 0 }): PreviewView {
  anchor = { x: Number.isFinite(anchor.x) ? anchor.x : 0, y: Number.isFinite(anchor.y) ? anchor.y : 0 };
  const zoom = Math.max(.1, Math.min(8, Number.isFinite(requested) ? requested : 1));
  const ratio = zoom / view.zoom;
  return { zoom, x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio };
}
