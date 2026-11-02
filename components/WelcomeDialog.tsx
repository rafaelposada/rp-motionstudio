// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';

import { useEffect, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useUIStore } from '@/store/useUIStore';

const SEEN_KEY = 'motion-welcome-seen';

// First-run introduction; it does not impose terms beyond LICENSE and NOTICE.
export default function WelcomeDialog() {
  const [open, setOpen] = useState(false);
  const pt=useUIStore(state=>state.locale)==='pt';

  useEffect(() => {
    try { if (!localStorage.getItem(SEEN_KEY)) setOpen(true); } catch { /* storage blocked */ }
  }, []);

  // Entering hands the user a real, named project to work in rather than an
  // unsaved scratch scene. bootstrap() (page mount) has already created the
  // default project, so this only has to make sure one is open — it never
  // overwrites an existing project.
  const enter = () => {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage blocked */ }
    const projects = useProjectStore.getState();
    projects.bootstrap();               // no-op when already booted
    if (!projects.activeId) projects.create('Default project');
    useUIStore.getState().setNav('home');
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop welcome-backdrop">
      <div className="modal welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title" onClick={(e) => e.stopPropagation()}>
        <div className="welcome-body">
          <span className="eyebrow">{pt?'Boas-vindas':'Welcome'}</span>
          <h1 className="welcome-title" id="welcome-title">RP MotionStudio</h1>

          <p>
            {pt?'Componha fotos, vídeos, texto e áudio com modelos de movimento. Desenvolvimento da versão RP e direção do produto por Rafael Posada.':'Compose photos, video, text and audio with motion templates. RP edition development and product direction by Rafael Posada.'}
          </p>
          <p>
            {pt?'Esta edição é distribuída sob Apache 2.0. Componentes de terceiros mantêm suas próprias licenças e atribuições em LICENSE e NOTICE.':'This edition is distributed under Apache 2.0. Third-party components retain their own licenses and attribution in LICENSE and NOTICE.'}
          </p>

          <ul className="welcome-list">
            <li>{pt?'Escolha um modelo e adicione suas mídias.':'Choose a template and add your media.'}</li>
            <li>{pt?'T e clique adicionam texto; duplo clique edita.':'Press T and click to add text; double-click to edit.'}</li>
            <li>{pt?'O salvamento automático mantém a composição neste aplicativo.':'Autosave keeps your composition in this app.'}</li>
            <li>{pt?'Salve um rascunho .motion.zip para guardar uma cópia com as mídias.':'Save a .motion.zip draft for an independent copy including media.'}</li>
            <li>{pt?'Importe seus rascunhos da instalação anterior para continuar.':'Import drafts from your previous installation to continue.'}</li>
          </ul>

          <p className="welcome-love">
            {pt?'Sua instalação anterior e os projetos originais permanecem independentes.':'Your previous installation and original projects remain independent.'}
          </p>

          <button className="btn primary full" onClick={enter}>{pt?'Começar':'Get started'}</button>
        </div>
      </div>
    </div>
  );
}
