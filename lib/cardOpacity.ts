// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
// Preserve source-file alpha and manual layer opacity. This switch only controls
// depth dimming. Temporal entrance/exit and slot visibility remain intact.
export function cardOpacity(alpha: number, automatic = false, solidAlpha = alpha) {
  const value = automatic ? alpha : solidAlpha;
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
