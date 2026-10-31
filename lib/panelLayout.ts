export type PanelId = 'rail' | 'library' | 'inspector' | 'timeline';
export type PanelAxis = 'width' | 'height';
export type PanelWidthPriority = 'library' | 'inspector' | null;
export type PanelLayout = Record<PanelId, { width: number; height: number }>;
// Zero means automatic. The stored preference is independent of window size;
// fitting a small window never destroys the user's larger-screen layout.
export const DEFAULT_PANELS: PanelLayout = {
  rail: { width: 72, height: 0 }, library: { width: 260, height: 0 },
  inspector: { width: 310, height: 0 }, timeline: { width: 0, height: 0 },
};
export const PANEL_LIMITS: Record<PanelId, Record<PanelAxis, [number, number]>> = {
  rail: { width: [56, 120], height: [320, 2000] },
  library: { width: [180, 640], height: [180, 2000] },
  inspector: { width: [220, 680], height: [180, 2000] },
  timeline: { width: [560, 4000], height: [56, 640] },
};
export function panelDimension(panel: PanelId, axis: PanelAxis, value: number) {
  if (!Number.isFinite(value)) return DEFAULT_PANELS[panel][axis];
  if (value === 0 && (axis === 'height' || panel === 'timeline')) return 0;
  const [min, max] = PANEL_LIMITS[panel][axis];
  return Math.round(Math.min(max, Math.max(min, value)));
}
export function sanitizePanels(value: unknown): PanelLayout {
  const source = value as Partial<PanelLayout> | null;
  return Object.fromEntries((Object.keys(DEFAULT_PANELS) as PanelId[]).map((id) => [id, Object.fromEntries((['width', 'height'] as const).map((axis) => [axis, panelDimension(id, axis, typeof source?.[id]?.[axis] === 'number' ? source[id]![axis] : DEFAULT_PANELS[id][axis])]))])) as PanelLayout;
}
export function fitPanelLayout(panels: PanelLayout, viewportWidth: number, viewportHeight: number, leftHidden: boolean, rightHidden: boolean, strip: boolean, expanded: boolean, priority: PanelWidthPriority = null) {
  const width = Math.max(920, viewportWidth), height = Math.max(360, viewportHeight);
  const rail = panels.rail.width;
  let left = leftHidden ? 0 : strip ? 40 : panels.library.width;
  let right = rightHidden ? 0 : panels.inspector.width;
  const budget = width - rail - 50 - 320;
  if (left + right > budget) {
    const minLeft = leftHidden ? 0 : strip ? 40 : 180;
    const minRight = rightHidden ? 0 : 220;
    if (priority === 'library' && !leftHidden && !strip) {
      left = Math.min(left, budget - minRight);
      right = Math.min(right, budget - left);
    } else if (priority === 'inspector' && !rightHidden) {
      right = Math.min(right, budget - minLeft);
      left = Math.min(left, budget - right);
    } else {
      const flex = left - minLeft + right - minRight;
      const available = Math.max(0, budget - minLeft - minRight);
      left = minLeft + (flex ? (left - minLeft) / flex * available : 0);
      right = minRight + (flex ? (right - minRight) / flex * available : 0);
    }
  }
  const preferredTimeline = panels.timeline.height;
  // Collapsing lanes returns to the compact transport without forgetting the
  // expanded height; opening lanes must never trap them in a 56px container.
  const requestedTimeline = expanded ? (preferredTimeline > 96 ? preferredTimeline : 280) : (preferredTimeline > 0 && preferredTimeline <= 96 ? preferredTimeline : 56);
  const timelineHeight = Math.min(requestedTimeline, height - 210);
  return { rail: Math.round(rail), library: Math.floor(left), inspector: Math.floor(right), timelineHeight: Math.round(timelineHeight) };
}
