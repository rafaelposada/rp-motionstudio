// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Desktop update flow: download and verify in the background, then ask once
// before restarting into the new version.
import { create } from 'zustand';
import { desktopAPI, desktopBusy } from './desktop';
import { appChoice } from './appDialog';
import { flushScene } from './scenePersist';
import { useSceneStore } from '@/store/useSceneStore';
import { tx, txf } from '@/lib/tx';

export type DesktopUpdatePhase = 'idle' | 'downloading' | 'installing' | 'ready' | 'applying' | 'error';
interface State { phase: DesktopUpdatePhase; received: number; total: number; version: string; error: string }
export const useDesktopUpdate = create<State>(() => ({ phase: 'idle', received: 0, total: 0, version: '', error: '' }));

let listening = false;
function listen() {
  const api = desktopAPI();
  if (listening || !api?.onUpdateProgress) return;
  listening = true;
  api.onUpdateProgress((progress) => {
    if (progress.phase === 'downloading') useDesktopUpdate.setState({ phase: 'downloading', received: progress.received ?? 0, total: progress.total ?? 0 });
    else if (progress.phase === 'installing') useDesktopUpdate.setState({ phase: 'installing' });
  });
}
export const canInstallInApp = () => !!desktopAPI()?.prepareUpdate;

export async function installDesktopUpdate(pt: boolean) {
  const api = desktopAPI();
  if (!api?.prepareUpdate || !api.applyUpdate) return;
  const state = useDesktopUpdate.getState();
  if (['downloading', 'installing', 'applying'].includes(state.phase)) return;
  listen();
  try {
    if (state.phase !== 'ready') {
      useDesktopUpdate.setState({ phase: 'downloading', received: 0, total: 0, error: '' });
      const { version } = await api.prepareUpdate();
      useDesktopUpdate.setState({ phase: 'ready', version });
    }
    const version = useDesktopUpdate.getState().version;
    const restart = await appChoice({
      title: 'RP MotionStudio',
      message: txf(pt, 'A versão {v} está pronta para instalar.', 'Version {v} is ready to install.', { v: version }),
      detail: tx(pt, 'O app salva a composição, fecha, troca a versão e abre de novo em alguns segundos. Projetos, mídias e preferências são mantidos.', 'The app saves your composition, closes, swaps the version and reopens in a few seconds. Projects, media and preferences are kept.'),
      buttons: [tx(pt, 'Reiniciar e instalar', 'Restart and install'), tx(pt, 'Depois', 'Later')], defaultIndex: 0, cancelIndex: 1,
    });
    if (restart !== 0) return;
    if (desktopBusy()) throw Error(tx(pt, 'Aguarde a exportação ou o salvamento em andamento e tente de novo.', 'Wait for the export or save in progress, then try again.'));
    useSceneStore.getState().setPlaying(false);
    flushScene();
    useDesktopUpdate.setState({ phase: 'applying' });
    await api.applyUpdate();
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(error);
    const phase = useDesktopUpdate.getState().phase;
    useDesktopUpdate.setState({ phase: phase === 'ready' || phase === 'applying' ? 'ready' : 'error', error: message });
  }
}
