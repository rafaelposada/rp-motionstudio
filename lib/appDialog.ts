// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// In-app choice dialog for flows the desktop shell used to hand to the OS
// (closing the window, keeping it open after an error). Resolves with the
// index of the chosen button; Esc resolves with cancelIndex.
export interface AppChoice { title?: string; message: string; detail?: string; buttons: string[]; defaultIndex?: number; cancelIndex?: number; tone?: 'question' | 'error' }

export function appChoice({ title, message, detail, buttons, defaultIndex = 0, cancelIndex = buttons.length - 1, tone = 'question' }: AppChoice): Promise<number> {
  return new Promise((resolve) => {
    document.querySelectorAll<HTMLDialogElement>('dialog.app-dialog[open]').forEach((open) => open.dispatchEvent(new Event('cancel')));
    const prior = document.activeElement as HTMLElement | null;
    const dialog = document.createElement('dialog');
    dialog.className = `app-dialog ${tone}`;
    dialog.setAttribute('aria-labelledby', 'app-dialog-title');
    const eyebrow = document.createElement('span'); eyebrow.className = 'app-dialog-eyebrow'; eyebrow.textContent = title ?? '';
    const heading = document.createElement('h2'); heading.id = 'app-dialog-title'; heading.textContent = message;
    const body = document.createElement('p'); body.textContent = detail ?? '';
    const actions = document.createElement('div'); actions.className = 'app-dialog-actions';
    let done = false;
    const finish = (index: number) => { if (done) return; done = true; dialog.close(); dialog.remove(); prior?.focus?.(); resolve(index); };
    // Visual order follows the desktop convention: cancel first, primary last.
    const order = buttons.map((_, index) => index).sort((a, b) => (a === cancelIndex ? -1 : b === cancelIndex ? 1 : 0) || (a === defaultIndex ? 1 : b === defaultIndex ? -1 : a - b));
    let primary: HTMLButtonElement | null = null;
    for (const index of order) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = buttons[index];
      button.className = index === defaultIndex ? 'btn primary' : 'btn';
      button.onclick = () => finish(index);
      if (index === defaultIndex) primary = button;
      actions.append(button);
    }
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(cancelIndex); });
    if (title) dialog.append(eyebrow);
    dialog.append(heading);
    if (detail) dialog.append(body);
    dialog.append(actions);
    document.body.append(dialog);
    dialog.showModal();
    (primary as HTMLButtonElement | null)?.focus();
  });
}
