// In-app confirmation avoids browser-owned alerts and keeps keyboard focus
// trapped until the user explicitly confirms or cancels.
export function confirmLayer(message: string, pt = true): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector('dialog[open]')) { resolve(false); return; }
    const prior = document.activeElement as HTMLElement | null;
    const dialog = document.createElement('dialog'); dialog.className = 'layer-confirm';
    dialog.setAttribute('aria-label', pt ? 'Confirmar exclusão' : 'Confirm deletion');
    const text = document.createElement('p'); text.textContent = message;
    const actions = document.createElement('div');
    const cancel = document.createElement('button'), confirm = document.createElement('button');
    cancel.className = 'btn'; cancel.textContent = pt ? 'Cancelar' : 'Cancel';
    confirm.className = 'btn primary'; confirm.textContent = pt ? 'Confirmar' : 'Confirm';
    const finish = (approved: boolean) => { dialog.close(); dialog.remove(); prior?.focus(); resolve(approved); };
    cancel.onclick = () => finish(false); confirm.onclick = () => finish(true);
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(false); });
    confirm.autofocus = true;
    actions.append(cancel, confirm); dialog.append(text, actions); document.body.append(dialog); dialog.showModal(); confirm.focus();
  });
}
