// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import type { ControlDef } from '@/lib/types';
import type { Locale } from '@/lib/i18n';
import { EDITOR_HELP } from './editorHelp';

type HelpPair = { en: string; pt: string };

const CONTROL_HELP: Record<string, HelpPair> = {
  count: {
    en: 'Sets how many cards take part in the motion. Increasing adds density and GPU work; decreasing makes the composition lighter and more open.',
    pt: 'Define quantos cartões participam do movimento. Aumentar deixa a composição mais densa e exige mais processamento; diminuir abre e deixa a cena mais leve.',
  },
  'card count': {
    en: 'Sets how many cards are generated. Increasing fills the structure with more cards; decreasing simplifies it and improves performance.',
    pt: 'Define quantos cartões são gerados. Aumentar preenche a estrutura com mais cartões; diminuir simplifica a cena e melhora o desempenho.',
  },
  speed: {
    en: 'Controls animation speed. Higher values move faster; lower values slow the motion down.',
    pt: 'Controla a velocidade da animação. Valores maiores aceleram; valores menores deixam o movimento mais lento.',
  },
  duration: {
    en: 'Sets the total clip length. Increasing gives the motion more time and creates more frames; decreasing makes the loop shorter.',
    pt: 'Define a duração total do clipe. Aumentar dá mais tempo ao movimento e cria mais quadros; diminuir encurta o ciclo.',
  },
  'duração': {
    en: 'Sets the total clip length. Increasing gives the motion more time and creates more frames; decreasing makes the loop shorter.',
    pt: 'Define a duração total do clipe. Aumentar dá mais tempo ao movimento e cria mais quadros; diminuir encurta o ciclo.',
  },
  hold: {
    en: 'Controls how long each card pauses before continuing. Increasing extends the pause; decreasing keeps the motion more continuous.',
    pt: 'Controla quanto tempo cada cartão permanece parado antes de continuar. Aumentar prolonga a pausa; diminuir torna o movimento mais contínuo.',
  },
  offset: {
    en: 'Shifts the motion in time or space. Moving upward advances the shift; moving downward brings it back toward the starting alignment.',
    pt: 'Desloca o movimento no tempo ou no espaço. Aumentar avança a defasagem; diminuir aproxima a composição do alinhamento inicial.',
  },
  'offset %': {
    en: 'Changes this layer’s phase within the loop. Higher values move it later around the cycle; lower values bring it closer to the original phase.',
    pt: 'Muda a fase desta camada dentro do ciclo. Aumentar desloca a camada adiante no loop; diminuir aproxima da fase original.',
  },
  zoom: {
    en: 'Controls how strongly the scene moves toward or away from the viewer. Increasing intensifies the zoom; decreasing makes it subtler.',
    pt: 'Controla quanto a cena se aproxima ou se afasta do observador. Aumentar intensifica o zoom; diminuir deixa o efeito mais sutil.',
  },
  scale: {
    en: 'Changes the overall size. Higher values enlarge the result; lower values reduce it.',
    pt: 'Altera o tamanho geral. Valores maiores ampliam o resultado; valores menores reduzem.',
  },
  size: {
    en: 'Controls the element size. Increasing makes elements larger; decreasing makes them smaller.',
    pt: 'Controla o tamanho do elemento. Aumentar deixa os elementos maiores; diminuir reduz.',
  },
  'card size': {
    en: 'Controls each card’s size. Increasing makes cards occupy more of the canvas; decreasing reveals more space between them.',
    pt: 'Controla o tamanho de cada cartão. Aumentar ocupa mais área da tela; diminuir revela mais espaço entre os cartões.',
  },
  'plane size': {
    en: 'Sets the displayed plane size. Increasing fills more of the frame; decreasing leaves more surrounding space.',
    pt: 'Define o tamanho do plano exibido. Aumentar preenche mais o quadro; diminuir deixa mais espaço ao redor.',
  },
  gap: {
    en: 'Sets the distance between elements. Increasing spreads them apart; decreasing brings them closer and may create overlap.',
    pt: 'Define a distância entre os elementos. Aumentar separa os cartões; diminuir aproxima e pode criar sobreposição.',
  },
  spread: {
    en: 'Controls how widely cards are distributed. Increasing opens the field; decreasing concentrates cards near the centre.',
    pt: 'Controla a amplitude da distribuição. Aumentar abre o campo; diminuir concentra os cartões perto do centro.',
  },
  rotation: {
    en: 'Rotates the element. Positive values turn clockwise; negative values turn counter-clockwise; zero keeps it level.',
    pt: 'Gira o elemento. Valores positivos giram no sentido horário; negativos no anti-horário; zero mantém alinhado.',
  },
  tilt: {
    en: 'Tilts the composition to suggest depth. Moving away from zero strengthens the tilt; returning to zero flattens it.',
    pt: 'Inclina a composição para sugerir profundidade. Afastar de zero acentua a inclinação; voltar a zero achata a cena.',
  },
  perspective: {
    en: 'Controls perspective distortion. Increasing widens the depth effect; decreasing produces a flatter, longer-lens look.',
    pt: 'Controla a distorção de perspectiva. Aumentar acentua a profundidade; diminuir produz uma aparência mais plana.',
  },
  'camera distance': {
    en: 'Moves the camera without changing its lens. Increasing pulls the camera farther away; decreasing moves it closer.',
    pt: 'Move a câmera sem alterar a lente. Aumentar afasta a câmera; diminuir aproxima.',
  },
  opacity: {
    en: 'Controls visibility. Higher values make the layer more solid; lower values make it more transparent.',
    pt: 'Controla a visibilidade. Valores maiores deixam a camada mais sólida; valores menores deixam mais transparente.',
  },
  blend: {
    en: 'Chooses how this layer combines with layers below it. This is a mode selection, so it has no higher or lower direction.',
    pt: 'Escolhe como esta camada se combina com as camadas inferiores. É uma seleção de modo, sem direção de aumentar ou diminuir.',
  },
  fade: {
    en: 'Controls the fade at the beginning and end. Increasing makes the transition longer and softer; decreasing makes it more immediate.',
    pt: 'Controla o desvanecimento no início e no fim. Aumentar alonga e suaviza a transição; diminuir deixa a entrada e a saída mais imediatas.',
  },
  'fade (frames)': {
    en: 'Sets how many frames the layer uses to fade in and out. Increasing softens the edges of its timeline window; decreasing makes them sharper.',
    pt: 'Define quantos quadros a camada usa para aparecer e desaparecer. Aumentar suaviza as bordas da janela; diminuir deixa os cortes mais diretos.',
  },
  'corner radius': {
    en: 'Rounds card corners. Increasing makes them more rounded; decreasing approaches square corners.',
    pt: 'Arredonda os cantos dos cartões. Aumentar deixa mais arredondado; diminuir aproxima de cantos retos.',
  },
  blur: {
    en: 'Softens background detail. Increasing adds more blur; decreasing restores sharpness.',
    pt: 'Suaviza os detalhes do fundo. Aumentar adiciona desfoque; diminuir recupera nitidez.',
  },
  position: {
    en: 'Moves the element on the canvas. Drag right or left for the horizontal axis and down or up for the vertical axis.',
    pt: 'Move o elemento na tela. Arraste para direita ou esquerda no eixo horizontal e para baixo ou cima no eixo vertical.',
  },
  direction: {
    en: 'Chooses the direction of travel. This is a mode selection rather than a higher or lower value.',
    pt: 'Escolhe a direção do movimento. É uma seleção de modo, sem valor maior ou menor.',
  },
  rows: {
    en: 'Sets the number of rows. Increasing adds rows and density; decreasing uses fewer rows.',
    pt: 'Define a quantidade de linhas. Aumentar adiciona linhas e densidade; diminuir usa menos linhas.',
  },
  columns: {
    en: 'Sets the number of columns. Increasing adds columns; decreasing leaves fewer, wider groups.',
    pt: 'Define a quantidade de colunas. Aumentar adiciona colunas; diminuir deixa menos grupos, mais largos.',
  },
  stagger: {
    en: 'Offsets the start of neighbouring cards. Increasing separates their timing; decreasing makes them move more together.',
    pt: 'Defasa o início dos cartões vizinhos. Aumentar separa os tempos; diminuir faz os cartões se moverem mais juntos.',
  },
  thickness: {
    en: 'Adds physical depth to cards. Increasing creates thicker edges; decreasing approaches a flat plane.',
    pt: 'Adiciona espessura física aos cartões. Aumentar cria bordas mais espessas; diminuir aproxima de um plano sem volume.',
  },
  strength: {
    en: 'Controls effect intensity. Increasing strengthens the effect; decreasing makes it subtler.',
    pt: 'Controla a intensidade do efeito. Aumentar deixa o efeito mais forte; diminuir torna mais sutil.',
  },
  amount: {
    en: 'Controls effect amount. Increasing applies more of it; decreasing reduces its presence.',
    pt: 'Controla a quantidade do efeito. Aumentar aplica mais; diminuir reduz a presença.',
  },
  radius: {
    en: 'Controls the affected radius. Increasing reaches a larger area; decreasing concentrates the effect.',
    pt: 'Controla o raio afetado. Aumentar alcança uma área maior; diminuir concentra o efeito.',
  },
  frequency: {
    en: 'Controls how often the pattern repeats. Increasing creates more repetitions; decreasing creates fewer.',
    pt: 'Controla quantas vezes o padrão se repete. Aumentar cria mais repetições; diminuir cria menos.',
  },
  amplitude: {
    en: 'Controls the range of the oscillation. Increasing makes swings wider; decreasing keeps them closer to the centre.',
    pt: 'Controla a amplitude da oscilação. Aumentar amplia o movimento; diminuir mantém mais perto do centro.',
  },
  threshold: {
    en: 'Sets the point where the effect begins. Increasing requires a stronger input; decreasing activates it sooner.',
    pt: 'Define o ponto em que o efeito começa. Aumentar exige uma entrada mais forte; diminuir ativa mais cedo.',
  },
  'pixel size': {
    en: 'Sets the pixel block size. Increasing produces larger, coarser blocks; decreasing preserves more detail.',
    pt: 'Define o tamanho dos blocos de pixel. Aumentar cria blocos maiores e mais grosseiros; diminuir preserva mais detalhe.',
  },
  fit: {
    en: 'Chooses whether media covers the frame or remains fully visible. This is a mode selection, not a higher or lower value.',
    pt: 'Escolhe entre preencher o quadro ou manter a mídia totalmente visível. É uma seleção de modo, sem valor maior ou menor.',
  },
  colour: {
    en: 'Chooses the colour used by this element. Brightness and saturation change through the colour picker rather than a single higher/lower scale.',
    pt: 'Escolhe a cor usada pelo elemento. Brilho e saturação mudam no seletor, sem uma única escala de aumentar ou diminuir.',
  },
  color: {
    en: 'Chooses the colour used by this element. Brightness and saturation change through the colour picker rather than a single higher/lower scale.',
    pt: 'Escolhe a cor usada pelo elemento. Brilho e saturação mudam no seletor, sem uma única escala de aumentar ou diminuir.',
  },
};

const UI_HELP: Record<string, HelpPair> = {
  template: {
    en: 'Chooses the motion model applied to the active layer. Picking another model now isolates that layer so an older model does not remain behind it.',
    pt: 'Escolhe o modelo de movimento aplicado à camada ativa. Ao escolher outro modelo, esta camada fica isolada para evitar que um modelo anterior permaneça ao fundo.',
  },
  easing: {
    en: 'Shapes how motion accelerates and slows down. Steeper curves feel faster and sharper; flatter curves feel softer and more gradual.',
    pt: 'Define como o movimento acelera e desacelera. Curvas mais íngremes parecem rápidas e secas; curvas mais planas ficam suaves e graduais.',
  },
  effects: {
    en: 'Adds visual processing after the scene is rendered. More or heavier effects can increase GPU work.',
    pt: 'Adiciona processamento visual depois que a cena é renderizada. Mais efeitos, ou efeitos intensos, podem aumentar o uso da GPU.',
  },
  aspect: {
    en: 'Sets the canvas proportion. Portrait values make it taller; landscape values make it wider; W×H accepts an exact custom size.',
    pt: 'Define a proporção da tela. Formatos verticais deixam a tela mais alta; horizontais deixam mais larga; W×H aceita uma medida exata.',
  },
  size: {
    en: 'Sets exact export width and height in pixels. Increasing either dimension raises resolution, file size and render cost.',
    pt: 'Define largura e altura exatas da exportação em pixels. Aumentar qualquer dimensão eleva resolução, tamanho do arquivo e custo de renderização.',
  },
  fps: {
    en: 'Sets frames per second. Increasing produces smoother motion and more frames to render; decreasing reduces frame count and can look more stepped.',
    pt: 'Define os quadros por segundo. Aumentar deixa o movimento mais fluido e gera mais quadros; diminuir reduz o trabalho e pode deixar o movimento mais marcado.',
  },
  safeArea: {
    en: 'Shows a guide for keeping important content away from screen edges. It is a preview guide and is not exported.',
    pt: 'Exibe uma guia para manter conteúdo importante longe das bordas. É apenas uma referência de edição e não aparece na exportação.',
  },
  background: {
    en: 'Opens the canvas background controls. Its source, colours and blur change only what appears behind the animated cards.',
    pt: 'Abre os controles do fundo da tela. Origem, cores e desfoque alteram apenas o que aparece atrás dos cartões animados.',
  },
  backgroundSource: {
    en: 'Chooses a solid/gradient background, an uploaded image, or a reflection of the featured card.',
    pt: 'Escolhe entre fundo de cor/gradiente, imagem enviada ou reflexo do cartão em destaque.',
  },
  logo: {
    en: 'Opens the overlay logo controls. Adding or replacing a logo leaves the animation and card media unchanged.',
    pt: 'Abre os controles do logo sobreposto. Adicionar ou substituir o logo preserva a animação e as mídias dos cartões.',
  },
  gradient: {
    en: 'Blends up to eight colors. Adjust their opacity, positions, direction and shape.',
    pt: 'Mistura até oito cores. Ajuste opacidade, posições, direção e forma da transição.',
  },
  backgroundImage: {
    en: 'Uses an uploaded image as the canvas background. Replacing it changes only the background, not card media.',
    pt: 'Usa uma imagem enviada como fundo da tela. Substituir altera apenas o fundo, sem trocar as mídias dos cartões.',
  },
  logoImage: {
    en: 'Adds an image or logo above the animation. Replacing it keeps the chosen corner.',
    pt: 'Adiciona uma imagem ou logo sobre a animação. Substituir preserva o canto escolhido.',
  },
  logoCorner: {
    en: 'Chooses the corner where the logo is anchored. This is a position choice, not a higher/lower value.',
    pt: 'Escolhe o canto em que o logo fica preso. É uma opção de posição, sem valor maior ou menor.',
  },
  audio: {
    en: 'Adds an audio track to the exported video. Replacing it changes the soundtrack while leaving the animation intact.',
    pt: 'Adiciona uma faixa de áudio ao vídeo exportado. Substituir troca a trilha sonora sem alterar a animação.',
  },
  media: {
    en: 'Manages the images and videos assigned to card slots. Adding more files fills more slots; removing them restores numbered placeholders.',
    pt: 'Gerencia imagens e vídeos atribuídos aos cartões. Adicionar arquivos preenche mais espaços; remover restaura os cartões numerados.',
  },
  cardShape: {
    en: 'Sets the crop proportion used by every card. Taller ratios create portrait cards; wider ratios create landscape cards.',
    pt: 'Define a proporção de recorte usada por todos os cartões. Proporções altas criam cartões verticais; proporções largas criam cartões horizontais.',
  },
  videoEnd: {
    en: 'Chooses what happens when a card video ends: Loop restarts it; Hold keeps the final frame.',
    pt: 'Escolhe o que acontece quando um vídeo termina: Repetir reinicia; Manter conserva o último quadro.',
  },
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function controlHelp(def: ControlDef, locale: Locale, displayLabel: string): string {
  const editorKey = def.key === 'size' && !/text|texto|font|fonte/i.test(def.label) ? '' : def.key;
  const known = EDITOR_HELP[editorKey] ?? CONTROL_HELP[normalize(def.label)] ?? CONTROL_HELP[normalize(displayLabel)];
  if (known) return known[locale];
  if (locale === 'en' && def.description) {
    return def.description;
  }
  if (def.type === 'slider') {
    return locale === 'pt'
      ? `Ajusta ${displayLabel.toLowerCase()} neste modelo, de ${def.min ?? 0} a ${def.max ?? 100}${def.unit ?? ''}. Compare o resultado na prévia ao alterar o valor.`
      : `Adjusts ${displayLabel.toLowerCase()} in this model, from ${def.min ?? 0} to ${def.max ?? 100}${def.unit ?? ''}. Compare the preview while changing it.`;
  }
  if (def.type === 'xypad') {
    return locale === 'pt'
      ? `Ajusta ${displayLabel.toLowerCase()} em dois eixos. Mover horizontalmente altera X; mover verticalmente altera Y.`
      : `Adjusts ${displayLabel.toLowerCase()} on two axes. Horizontal movement changes X; vertical movement changes Y.`;
  }
  if (def.type === 'color') {
    return CONTROL_HELP.colour[locale];
  }
  if (def.type === 'upload') {
    return locale === 'pt'
      ? `Escolhe o arquivo usado em ${displayLabel.toLowerCase()}. Enviar outro arquivo substitui o atual.`
      : `Chooses the file used for ${displayLabel.toLowerCase()}. Uploading another file replaces the current one.`;
  }
  return locale === 'pt'
    ? `Escolhe como ${displayLabel.toLowerCase()} funciona. As opções mudam o comportamento; este item não usa uma escala de aumentar ou diminuir.`
    : `Chooses how ${displayLabel.toLowerCase()} behaves. The options change the mode rather than a higher/lower scale.`;
}

export function uiHelp(key: keyof typeof UI_HELP, locale: Locale): string {
  return UI_HELP[key][locale];
}
