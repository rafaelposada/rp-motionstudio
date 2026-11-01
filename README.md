# RP MotionStudio

Editor local de composição e animação com biblioteca de modelos, camadas de texto,
imagens absolutas, áudio e exportação para pastas do computador. Interface em
português e inglês. Desenvolvimento da versão RP e direção do produto: Rafael Posada.

Rafael Posada é brand designer com mais de 13 anos de experiência em branding,
com atuação em estratégia de marca, identidade visual e presença digital para
advogados e escritórios de advocacia. Conheça seu trabalho em [rafaelposada.com](https://rafaelposada.com/).

## Apoio, contato e feedback

Quer ajudar a melhorar o RP MotionStudio e criar novas soluções? Você pode
apoiar com o valor que quiser. Entre em contato para combinar o apoio, enviar
sugestões, reportar bugs ou conversar sobre o aplicativo.

- Instagram: [@rafaelposada](https://instagram.com/rafaelposada)
- Site: [rafaelposada.com](https://rafaelposada.com)
- E-mail profissional: [contato@rafaelposada.com](mailto:contato@rafaelposada.com)

O menu **Configurações → Apoio e contato** reúne os mesmos canais.
Nenhuma cobrança é processada pelo aplicativo.

## Phantom Supply

A aba **Configurações → Phantom Supply** apresenta a plataforma de mockups premium
e recursos criativos, com link para [phantom.supply](https://phantom.supply/).
Use o cupom **RafaelPosada10** para **10% de desconto** no site da plataforma.
O cupom também pode ser copiado diretamente pelo aplicativo.

## Executar localmente

Requisitos: Node.js 24, npm e FFmpeg disponível no PATH.

```bash
git clone https://github.com/rafaelposada/rp-motionstudio.git
cd rp-motionstudio
npm ci
npm run dev -- --hostname 127.0.0.1
```

Abra **http://127.0.0.1:3000/**. Esse é um endereço local, não uma versão hospedada.
O serviço foi projetado para uso individual, sem autenticação; mantenha-o restrito
ao computador. Publicar o código no GitHub não hospeda o editor nem seus projetos.
O workflow herdado de GitHub Pages tem acionamento manual e não é executado ao enviar código.

## Recursos

- Painéis com largura/altura ajustáveis, preferências persistentes e aparência Sistema/claro/escuro.
- Identidade RP em SVG e favicon que acompanha o tema do editor.
- Campos numéricos editáveis com expressões matemáticas e ajuda contextual.
- Réguas, guias inteligentes, encaixe, seleção e arraste de elementos na composição.
- Navegação livre do preview: dois dedos/roda para deslocar, pinça ou Alt + roda
  para ampliar no cursor. ⌘/Ctrl+0 centraliza
  e ajusta ao painel; a navegação não altera a composição nem a exportação.
- Cinco abas por ícones: Movimento, Tela, Mídia, Texto e Camadas. A aba Mídia reúne
  as imagens dos modelos, imagens absolutas e áudio.
- Seleção múltipla de camadas com Shift, transformação em grupo, duplicação e
  exclusão com uma etapa de desfazer. Na linha do tempo, arraste qualquer área: vertical ordena, horizontal ajusta o tempo.
- Camadas de texto e imagens absolutas, ordem de profundidade, contorno, sombra e opacidade.
- Entrada e saída independentes, com tempos editáveis por camada.
- Áudio com volume e fades na prévia e no MP4.
- Gradientes com até oito pontos de cor/opacidade, presets e formas linear, radial e cônica.
- Duplo clique edita o texto na composição; Esc ou ⌘/Ctrl+Enter confirma.
- Fundo do texto com cor, opacidade, contorno independente e cantos ajustáveis.
- Desfazer: ⌘/Ctrl+Z. Refazer: ⌘/Ctrl+Shift+Z; no Windows, Ctrl+Y também funciona.
- Rotação pela área externa dos quatro cantos, com leitura do ângulo e encaixe de 15° com Shift.
- Botão de ampliar preview dentro da janela; Esc restaura os painéis.
- Catálogo Google Fonts com prévias e importação de fontes locais. O primeiro
  carregamento de uma fonte Google requer internet; fontes já usadas são armazenadas localmente.
- Controles de enquadramento de mídia e transparência/iluminação opcionais.
- Prévias de imagens com resolução limitada e exportação preparada a partir dos originais.
- Projetos portáteis e exportações salvos em pastas locais.
- Duplicação por ⌘/Ctrl+D e Option/Alt+arraste; ordenação conjunta de modelos,
  textos e imagens no painel de camadas e na linha do tempo.
- Aviso e recuperação de modelos fora da área visível, com desfazer.
- 239 modelos visíveis, incluindo Stickers/Poster, Flip e novas variações de
  Orbit, Box, Helix e Deck integradas do catálogo de origem,
  favoritos locais e contagem de versões por família.
- Entradas e saídas independentes de texto e imagens absolutas: desvanecer,
  subir/descer, deslizar, aproximar/afastar, salto suave e giro; texto também
  aceita máquina de escrever. O fundo do texto tem BG Blur ajustável, aplicado
  apenas à composição atrás dele, com cor, opacidade e contorno independentes.
- Trajetória do modelo com pontos editáveis, duração e repetição; desloca o
  conjunto sem substituir sua animação original.
- 12 efeitos de GPU nos motores 2D e 3D, com controles e explicações. Aplicação
  ao quadro composto; até oito efeitos por composição.
- Escolha de pasta para MP4/GIF e pacotes `.motion.zip` de rascunhos/templates.
  No macOS há seletor de pasta; também é possível digitar um caminho absoluto.
- Configurações → Salvamento: salvamento automático local, intervalo, estado da
  gravação e salvamento manual por ⌘/Ctrl+S. As alterações também são gravadas ao
  trocar de projeto e, com o automático ligado, ao sair da janela. Uma cópia
  portátil independente deve ser salva em Projetos → Salvar rascunho/template.
- Um único controle BBox, junto a Réguas, Guias e Encaixar na composição.
  A confirmação de exclusão recebe foco em Confirmar; Esc cancela.

Os nomes das pastas **Motion Studio Projects** e **Motion Studio Exports** foram
preservados para compatibilidade. Esta publicação não inclui projetos pessoais,
mídias importadas, exportações ou capturas locais de verificação.

## Verificação

```bash
npm test
npm run build
```

## Licença e atribuições

RP MotionStudio é uma versão modificada baseada no [Motion Studio](https://github.com/appariciojunior/motion-studio-open),
de appariciojunior e colaboradores; não é o aplicativo oficial. A base preserva a
[PolyForm Noncommercial 1.0.0](LICENSE). Componentes adicionais preservam suas
licenças Apache-2.0 e MIT em [NOTICE](NOTICE) e [licenses](licenses).
