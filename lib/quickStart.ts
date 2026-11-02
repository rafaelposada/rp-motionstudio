// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Goal-based starting points for the first use: format, a model that suits it
// and a short title/subtitle pair the user replaces.
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { useUIStore } from '@/store/useUIStore';
import { enterProject } from './homeNavigation';
import { tx } from './tx';

export interface QuickStart { id: string; aspect: string; template: string; pt: string; en: string; hintPt: string; hintEn: string; titlePt: string; titleEn: string }
export const QUICK_STARTS: QuickStart[] = [
  { id: 'feed', aspect: '4:5', template: 'carousel', pt: 'Post de feed', en: 'Feed post', hintPt: '4:5 · Instagram e LinkedIn', hintEn: '4:5 · Instagram and LinkedIn', titlePt: 'Seu título aqui', titleEn: 'Your headline here' },
  { id: 'reels', aspect: '9:16', template: 'orbit-3d-01', pt: 'Reels e Stories', en: 'Reels and Stories', hintPt: '9:16 · tela cheia no celular', hintEn: '9:16 · full screen on phones', titlePt: 'Uma frase que prende', titleEn: 'A line that hooks' },
  { id: 'square', aspect: '1:1', template: 'carousel', pt: 'Quadrado', en: 'Square', hintPt: '1:1 · anúncios e carrosséis', hintEn: '1:1 · ads and carousels', titlePt: 'Destaque principal', titleEn: 'Main highlight' },
  { id: 'deck', aspect: '16:9', template: 'carousel', pt: 'Apresentação', en: 'Presentation', hintPt: '16:9 · telas e vídeos', hintEn: '16:9 · screens and video', titlePt: 'Abertura da apresentação', titleEn: 'Presentation opener' },
];

export function startFromGoal(goal: QuickStart, pt: boolean) {
  const projects = useProjectStore.getState();
  projects.create(tx(pt, goal.pt, goal.en));
  const scene = useSceneStore.getState();
  scene.setAspect(goal.aspect);
  scene.setActiveTemplate(goal.template);
  scene.addTextLayer();
  const s = useSceneStore.getState(), layer = s.textLayers.at(-1)!;
  s.patchTextLayer(layer.id, { text: tx(pt, goal.titlePt, goal.titleEn), size: Math.round(Math.min(s.width, s.height) * .085), weight: 700, x: s.width / 2, y: s.height * .16, align: 'center', entrance: 'rise', entranceDuration: .6 });
  const id = useProjectStore.getState().activeId;
  if (id) enterProject(id);
  useUIStore.getState().setTimelineExpanded(true);
}
