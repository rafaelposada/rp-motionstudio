// RP MotionStudio desktop — Copyright 2026 Rafael Posada. Apache-2.0.
const APP_ORIGIN = 'rp-motion://app';
function trustedURL(value) {
  try { const u = new URL(value); return u.protocol === 'rp-motion:' && u.hostname === 'app' && !u.port && !u.username && !u.password; } catch { return false; }
}
function externalURL(value) {
  try { const u = new URL(value); return ['https:', 'mailto:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}
function closeCopy(pt, state) {
  return pt ? {
    title: 'Fechar composição?', message: `Salvar um rascunho de “${state.name}” antes de fechar?`,
    detail: state.unsaved ? 'Há alterações ainda não salvas. O rascunho inclui a composição e suas mídias. Sair sem salvar mantém apenas o último salvamento local.' : 'A composição está salva nos dados locais do aplicativo. Um rascunho .motion.zip é uma cópia independente, com as mídias, na pasta escolhida.',
    buttons: ['Salvar rascunho e fechar', state.unsaved ? 'Sair sem salvar' : 'Fechar sem criar rascunho', 'Cancelar'],
  } : {
    title: 'Close composition?', message: `Save a draft of “${state.name}” before closing?`,
    detail: state.unsaved ? 'There are unsaved changes. The draft includes the composition and media. Leaving without saving keeps only the last local save.' : 'The composition is saved in local application data. A .motion.zip draft is an independent copy, including media, in your chosen folder.',
    buttons: ['Save draft and close', state.unsaved ? 'Leave without saving' : 'Close without a draft', 'Cancel'],
  };
}
// One close transaction at a time; cancellation and failed writes keep the window.
function closeCoordinator({request, confirm, showError, finish}) {
  let running = false;
  return async () => {
    if (running) return false; running = true;
    try {
      const state = await request('status');
      if (state.busy) throw Error(state.pt ? 'Aguarde o carregamento, salvamento ou exportação em andamento.' : 'Wait for loading, saving or export to finish.');
      if (state.hasProject) {
        const response = await confirm(closeCopy(state.pt, state));
        if (response === 2 || response === undefined) return false;
        if (response === 0) await request('save-draft');
        else if (response !== 1) return false;
      }
      await finish(); return true;
    } catch (error) { await showError(error instanceof Error ? error.message : String(error)); return false; }
    finally { running = false; }
  };
}
module.exports = { APP_ORIGIN, trustedURL, externalURL, closeCopy, closeCoordinator };
