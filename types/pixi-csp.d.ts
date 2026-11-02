// RP MotionStudio desktop additions — Rafael Posada, 2026. Apache-2.0.
// Pixi 8.22 exposes this side-effect entry without a types export condition.
// Importing it installs the static CSP-compatible shader synchronizers.
declare module 'pixi.js/unsafe-eval';
declare module 'pixi.js/advanced-blend-modes';
