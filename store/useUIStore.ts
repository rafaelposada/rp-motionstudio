import { create } from 'zustand';
import { DEFAULT_ACCENT, sanitizeAccent, accentTokens } from '@/lib/accentColor';
import type { Locale } from '@/lib/i18n';
import { DEFAULT_PANELS, panelDimension, sanitizePanels, type PanelId, type PanelAxis, type PanelLayout, type PanelWidthPriority } from '@/lib/panelLayout';

// Lightweight UI-only state (which nav section is active). Kept separate from
// the 2D scene store so 3D mode doesn't couple to motion/template state.
export interface UIState {
  nav: string;              // active IconRail section id
  theme: 'light' | 'dark';
  locale: Locale;
  accentColor: string;
  setAccentColor: (color: string) => void;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  tplCollapsed: boolean;    // left column folded to the original compact strip
  panels: PanelLayout;
  panelWidthPriority: PanelWidthPriority;
  timelineExpanded: boolean;
  settingsOpen: boolean;
  selectedTextId: string | null;
  selectedMotionId: string | null;
  selectMotion: (id: string | null) => void;
  showSelectionBox: boolean;
  showRulers: boolean;
  smartGuides: boolean;
  snapEnabled: boolean;
  setAlignmentOption: (key: 'showRulers' | 'smartGuides' | 'snapEnabled', value: boolean) => void;
  selectText: (id: string | null) => void;
  setShowSelectionBox: (show: boolean) => void;
  showStageGrid: boolean;
  preferencesError: string | null;
  setSettingsOpen: (open: boolean) => void;
  setTheme: (theme: UIState['theme']) => void;
  setPanelDimension: (panel: PanelId, axis: PanelAxis, value: number, persist?: boolean) => void;
  persistPreferences: () => void;
  resetPanelLayout: () => void;
  setTimelineExpanded: (open: boolean) => void;
  setShowStageGrid: (show: boolean) => void;
  mobileTab: 'templates' | 'media' | 'adjust' | 'canvas';
  mobileProjectsOpen: boolean;
  mobilePanelOpen: boolean;
  setNav: (nav: string) => void;
  toggleTheme: () => void;
  toggleLocale: () => void;
  setLocale: (locale: Locale) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleTplCollapsed: () => void;
  setMobileTab: (tab: UIState['mobileTab']) => void;
  setMobileProjectsOpen: (open: boolean) => void;
  setMobilePanelOpen: (open: boolean) => void;
  hydratePreferences: () => void;
}

const PREFS_KEY = 'motion-ui-preferences';

type UIPreferences = Pick<UIState, 'theme' | 'locale' | 'accentColor' | 'leftCollapsed' | 'rightCollapsed' | 'tplCollapsed' | 'panels' | 'panelWidthPriority' | 'timelineExpanded' | 'showStageGrid' | 'showRulers' | 'smartGuides' | 'snapEnabled'>;

function savePreferences(prefs: UIPreferences) {
  if (typeof window === 'undefined') return;
  let saved = true;
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({
    version: 4,
    accentColor: prefs.accentColor,
    theme: prefs.theme,
    locale: prefs.locale,
    leftCollapsed: prefs.leftCollapsed,
    rightCollapsed: prefs.rightCollapsed,
    tplCollapsed: prefs.tplCollapsed,
    panels: prefs.panels,
    panelWidthPriority: prefs.panelWidthPriority,
    timelineExpanded: prefs.timelineExpanded,
    showStageGrid: prefs.showStageGrid,
    showRulers: prefs.showRulers, smartGuides: prefs.smartGuides, snapEnabled: prefs.snapEnabled,
  })); } catch { saved = false; }
  document.documentElement.dataset.theme = prefs.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', prefs.theme === 'dark' ? '#0c0d0f' : '#eef1f5');
  for (const [name, color] of Object.entries(accentTokens(prefs.accentColor))) document.documentElement.style.setProperty(name, color);
  document.documentElement.lang = prefs.locale === 'pt' ? 'pt-BR' : 'en';
  return saved;
}

export const useUIStore = create<UIState>((set, get) => ({
  nav: 'home',
  theme: 'light',
  locale: 'en',
  accentColor: DEFAULT_ACCENT,
  setAccentColor: (color) => set((state) => {
    const accentColor = sanitizeAccent(color);
    const saved = savePreferences({ ...state, accentColor });
    return { accentColor, preferencesError: saved === false ? 'storage' : null };
  }),
  leftCollapsed: false,
  rightCollapsed: false,
  tplCollapsed: false,
  panels: sanitizePanels(DEFAULT_PANELS),
  panelWidthPriority: null,
  settingsOpen: false,
  selectedTextId: null,
  selectedMotionId: null,
  selectMotion: (selectedMotionId) => set({ selectedMotionId, selectedTextId: null }),
  showSelectionBox: true,
  showRulers: false, smartGuides: true, snapEnabled: true,
  setAlignmentOption: (key,value) => set((state)=>{savePreferences({...state,[key]:value});return {[key]:value};}),
  selectText: (selectedTextId) => set({ selectedTextId, selectedMotionId: null }),
  setShowSelectionBox: (showSelectionBox) => set({ showSelectionBox }),
  timelineExpanded: false,
  showStageGrid: true,
  preferencesError: null,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setTheme: (theme) => set((state) => { savePreferences({ ...state, theme }); return { theme }; }),
  setPanelDimension: (panel, axis, value, persist = true) => set((state) => {
    const size = panelDimension(panel, axis, value);
    const panels = { ...state.panels, [panel]: { ...state.panels[panel], [axis]: size } };
    const panelWidthPriority = axis === 'width' && (panel === 'library' || panel === 'inspector') ? panel : state.panelWidthPriority;
    const timelineExpanded = panel === 'timeline' && axis === 'height' && size > 0 ? size > 96 : state.timelineExpanded;
    const saved = persist ? savePreferences({ ...state, panels, panelWidthPriority, timelineExpanded }) : true;
    return { panels, panelWidthPriority, timelineExpanded, preferencesError: saved === false ? 'storage' : null };
  }),
  persistPreferences: () => set({ preferencesError: savePreferences(get()) === false ? 'storage' : null }),
  resetPanelLayout: () => set((state) => {
    const next = { panels: sanitizePanels(DEFAULT_PANELS), panelWidthPriority: null, timelineExpanded: false, leftCollapsed: false, rightCollapsed: false, tplCollapsed: false };
    savePreferences({ ...state, ...next }); return next;
  }),
  setTimelineExpanded: (timelineExpanded) => set((state) => { savePreferences({ ...state, timelineExpanded }); return { timelineExpanded }; }),
  setShowStageGrid: (showStageGrid) => set((state) => { savePreferences({ ...state, showStageGrid }); return { showStageGrid }; }),
  mobileTab: 'templates',
  mobileProjectsOpen: false,
  mobilePanelOpen: false,
  setNav: (nav) => set({ nav: nav === 'home' || nav === 'projects' ? nav : 'library' }),
  toggleTheme: () => set((state) => {
    const next = { ...state, theme: state.theme === 'dark' ? 'light' as const : 'dark' as const };
    savePreferences(next);
    return { theme: next.theme };
  }),
  toggleLocale: () => set((state) => {
    const locale: Locale = state.locale === 'en' ? 'pt' : 'en';
    const next = { ...state, locale };
    savePreferences(next);
    return { locale };
  }),
  setLocale: (locale) => set((state) => {
    const next = { ...state, locale };
    savePreferences(next);
    return { locale };
  }),
  toggleLeftPanel: () => set((state) => {
    const next = { ...state, leftCollapsed: !state.leftCollapsed };
    savePreferences(next);
    return { leftCollapsed: next.leftCollapsed };
  }),
  toggleRightPanel: () => set((state) => {
    const next = { ...state, rightCollapsed: !state.rightCollapsed };
    savePreferences(next);
    return { rightCollapsed: next.rightCollapsed };
  }),
  toggleTplCollapsed: () => set((state) => {
    const next = { ...state, tplCollapsed: !state.tplCollapsed };
    savePreferences(next);
    return { tplCollapsed: next.tplCollapsed };
  }),
  setMobileTab: (mobileTab) => set({ mobileTab, mobilePanelOpen: true }),
  setMobileProjectsOpen: (mobileProjectsOpen) => set({ mobileProjectsOpen }),
  setMobilePanelOpen: (mobilePanelOpen) => set({ mobilePanelOpen }),
  hydratePreferences: () => set((state) => {
    if (typeof window === 'undefined') return {};
    let saved: Partial<UIPreferences> = {};
    try { const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}'); if (parsed && typeof parsed === 'object') saved = parsed; } catch { /* use defaults */ }
    const theme = saved.theme === 'dark' || saved.theme === 'light'
      ? saved.theme
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const next = {
      theme,
      accentColor: sanitizeAccent(saved.accentColor),
      locale: saved.locale === 'pt' ? 'pt' as const : 'en' as const,
      leftCollapsed: typeof saved.leftCollapsed === 'boolean' ? saved.leftCollapsed : state.leftCollapsed,
      rightCollapsed: typeof saved.rightCollapsed === 'boolean' ? saved.rightCollapsed : state.rightCollapsed,
      tplCollapsed: typeof saved.tplCollapsed === 'boolean' ? saved.tplCollapsed : state.tplCollapsed,
      panels: sanitizePanels(saved.panels),
      panelWidthPriority: saved.panelWidthPriority === 'library' || saved.panelWidthPriority === 'inspector' ? saved.panelWidthPriority : null,
      timelineExpanded: saved.timelineExpanded === true,
      showStageGrid: saved.showStageGrid !== false,
      showRulers: saved.showRulers === true, smartGuides: saved.smartGuides !== false, snapEnabled: saved.snapEnabled !== false,
    };
    savePreferences({ ...state, ...next });
    return next;
  }),
}));
