export type Locale = 'en' | 'pt';

const messages = {
  en: {
    new: 'New', projects: 'Projects', library: 'Library', mockup: 'Mockup', experiments: 'Experiments', boards: 'Boards',
    light: 'Light', dark: 'Dark', useLight: 'Use light theme', useDark: 'Use dark theme', createProject: 'Create a new project',
    templates: 'Templates', custom: 'Custom', searchTemplates: 'Search {count} templates', noCustom: 'No custom presets yet',
    saveCustom: 'Save as custom', save: 'Save', deletePreset: 'Delete preset', controls: 'Controls', newBadge: 'NEW',
    motion: 'Motion', canvas: 'Canvas', media: 'Media', text: 'Text', object: 'Object', inspector: 'Inspector',
    scene: 'Scene', timing: 'Timing', effects: 'Effects', advanced: 'Advanced settings',
    editingMotion: 'Editing the motion of {name}.', hidden: 'hidden', duration: 'Duration', add: 'Add',
    aspect: 'Aspect', sizePx: 'Size px', previewExact: 'Preview scales to fit — the exact size applies on export.',
    safeArea: 'Safe area', off: 'Off', on: 'On', background: 'Background', source: 'Source', color: 'Color', image: 'Image',
    fromCard: 'From card', colour: 'Colour', gradient: 'Gradient', replace: 'Replace…', upload: 'Upload…', blur: 'Blur',
    cardBackgroundHint: 'Reflects the featured card — the background moves with the animation.', logo: 'Logo', corner: 'Corner',
    audio: 'Audio', track: 'Track', fullscreen: 'Fullscreen', collapseLeft: 'Collapse left sidebar', expandLeft: 'Expand left sidebar',
    collapseRight: 'Collapse inspector', expandRight: 'Expand inspector', language: 'Language', portuguese: 'Português', english: 'English',
    reset: 'Reset', cancel: 'Cancel', apply: 'Apply', resetCenter: 'Reset to center', replaceFile: 'Replace file…', chooseFile: 'Choose file…',
    play: 'Play', pause: 'Pause', layers: 'Layers', motionLayers: 'Motion layers', export: 'Export', addLayer: 'Add layer',
    timelineHint: 'Drag any clip area: up/down to reorder, left/right to retime · edges trim · Shift selects multiple',
    assets: 'Assets', dropRepeat: 'Drop images or videos — a few are enough, they repeat', dropFill: 'Drop images or videos to fill {count} slots',
    slotsLinked: '{count} slots · linked to Count', clearAll: 'Clear all', cardShape: 'Card shape',
    fullBleed: 'Full-bleed template — cards match the canvas', videoEnd: 'Video end', loop: 'Loop', holdLast: 'Hold last frame',
    slot: 'Slot {number}', dropOrClick: 'Drop or click to add', crop: 'Crop', remove: 'Remove', hide: 'Hide', show: 'Show',
    mediaFit: 'Media fit', fillMedia: 'Fill', fitMedia: 'Fit', stretchMedia: 'Stretch', focalPoint: 'Focal point', preparingMedia: 'Preparing media', applyAllMedia: 'Apply focal point to all media',
    easing: 'Easing', defaults: 'Defaults', standard: 'Standard', physics: 'Physics', customCurve: 'Custom curve', resetAll: 'Reset all values',
  },
  pt: {
    new: 'Novo', projects: 'Projetos', library: 'Biblioteca', mockup: 'Mockup', experiments: 'Experimentos', boards: 'Painéis',
    light: 'Claro', dark: 'Escuro', useLight: 'Usar tema claro', useDark: 'Usar tema escuro', createProject: 'Criar novo projeto',
    templates: 'Modelos', custom: 'Personalizados', searchTemplates: 'Buscar entre {count} modelos', noCustom: 'Nenhum modelo personalizado',
    saveCustom: 'Salvar como personalizado', save: 'Salvar', deletePreset: 'Excluir modelo', controls: 'Controles', newBadge: 'NOVO',
    motion: 'Movimento', canvas: 'Tela', media: 'Mídia', text: 'Texto', object: 'Objeto', inspector: 'Inspetor',
    scene: 'Cena', timing: 'Tempo', effects: 'Efeitos', advanced: 'Configurações avançadas',
    editingMotion: 'Editando o movimento de {name}.', hidden: 'oculto', duration: 'Duração', add: 'Adicionar',
    aspect: 'Proporção', sizePx: 'Tamanho em px', previewExact: 'A prévia se ajusta à tela; o tamanho exato será usado na exportação.',
    safeArea: 'Área segura', off: 'Desligado', on: 'Ligado', background: 'Fundo', source: 'Origem', color: 'Cor', image: 'Imagem',
    fromCard: 'Do cartão', colour: 'Cor', gradient: 'Gradiente', replace: 'Substituir…', upload: 'Enviar…', blur: 'Desfoque',
    cardBackgroundHint: 'Usa o cartão em destaque; o fundo acompanha o movimento da animação.', logo: 'Logo', corner: 'Canto',
    audio: 'Áudio', track: 'Faixa', fullscreen: 'Tela cheia', collapseLeft: 'Recolher biblioteca', expandLeft: 'Expandir biblioteca',
    collapseRight: 'Recolher inspetor', expandRight: 'Expandir inspetor', language: 'Idioma', portuguese: 'Português', english: 'English',
    reset: 'Redefinir', cancel: 'Cancelar', apply: 'Aplicar', resetCenter: 'Centralizar', replaceFile: 'Substituir arquivo…', chooseFile: 'Escolher arquivo…',
    play: 'Reproduzir', pause: 'Pausar', layers: 'Camadas', motionLayers: 'Camadas de movimento', export: 'Exportar', addLayer: 'Adicionar camada',
    timelineHint: 'Arraste qualquer área: vertical ordena, horizontal ajusta o tempo · bordas aparam · Shift seleciona várias',
    assets: 'Arquivos', dropRepeat: 'Solte imagens ou vídeos — poucos arquivos bastam, eles se repetem', dropFill: 'Solte imagens ou vídeos para preencher {count} espaços',
    slotsLinked: '{count} espaços · vinculados à quantidade', clearAll: 'Limpar tudo', cardShape: 'Formato do cartão',
    fullBleed: 'Modelo em tela cheia — os cartões acompanham a tela', videoEnd: 'Fim do vídeo', loop: 'Repetir', holdLast: 'Manter último quadro',
    slot: 'Espaço {number}', dropOrClick: 'Solte ou clique para adicionar', crop: 'Recortar', remove: 'Remover', hide: 'Ocultar', show: 'Mostrar',
    mediaFit: 'Preenchimento', fillMedia: 'Preencher', fitMedia: 'Ajustar', stretchMedia: 'Esticar', focalPoint: 'Ponto focal', preparingMedia: 'Preparando mídia', applyAllMedia: 'Aplicar ponto focal a todas as mídias',
    easing: 'Suavização', defaults: 'Padrões', standard: 'Padrão', physics: 'Física', customCurve: 'Curva personalizada', resetAll: 'Redefinir todos os valores',
  },
} as const;

export type MessageKey = keyof typeof messages.en;

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>) {
  let value: string = messages[locale][key] ?? messages.en[key];
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replace(`{${name}}`, String(replacement));
    }
  }
  return value;
}

const labelsPt: Record<string, string> = {
  Corner: 'Canto', 'Image Scale': 'Escala da imagem', 'Step Time': 'Tempo por etapa', Ellipticity: 'Elipticidade', 'Card Align': 'Alinhamento dos cartões',
  Contrast: 'Contraste', Movement: 'Movimento', Pause: 'Pausa', Seconds: 'Segundos', Alignment: 'Alinhamento', Shape: 'Forma', Rounding: 'Arredondamento', Ripple: 'Ondulação', Glow: 'Brilho difuso', Ring: 'Anel',
  'Offset %': 'Deslocamento %', 'Fade (frames)': 'Desvanecimento (quadros)',
  'Alternate Rings': 'Alternar anéis', Anchor: 'Âncora', Appear: 'Entrada', 'Appear Time': 'Tempo de entrada',
  'Arc Coverage': 'Cobertura do arco', Atmosphere: 'Atmosfera', Axis: 'Eixo', 'Back Fade': 'Desvanecimento traseiro',
  'Big Drift': 'Desvio ampliado', 'Blank Area': 'Área vazia', Bloom: 'Expansão', Breath: 'Respiração',
  'Breath Amount': 'Intensidade da respiração', 'Breath Cycles': 'Ciclos de respiração', Brightness: 'Brilho',
  'Build In/Out': 'Montagem de entrada e saída', 'Camera FOV': 'Campo de visão', 'Card Bend': 'Curvatura do cartão',
  'Card Facing': 'Orientação do cartão', 'Card Length': 'Comprimento do cartão', 'Card Spacing': 'Espaço entre cartões',
  'Card Style': 'Estilo do cartão', 'Cards / Ring': 'Cartões por anel', 'Centre Gap': 'Espaço central', Crowd: 'Densidade',
  Curve: 'Curva', 'Curve Match': 'Ajuste à curvatura', 'Curve X': 'Curva horizontal', 'Curve Y': 'Curva vertical',
  Cycles: 'Ciclos', 'Cylinder Radius': 'Raio do cilindro', 'Depth Blur': 'Desfoque de profundidade',
  'Depth Falloff': 'Atenuação de profundidade', 'Depth Shrink': 'Redução em profundidade', Dim: 'Escurecimento',
  Disappear: 'Saída', Distance: 'Distância', 'Drag Rotation': 'Rotação por arraste', 'Drift Amount': 'Intensidade do desvio',
  'Drift Dir': 'Direção do desvio', Drops: 'Quedas', 'Edge Shade': 'Sombra nas bordas', Effect: 'Efeito',
  'Exit Time': 'Tempo de saída', Faces: 'Faces', 'Fade In': 'Entrada gradual', 'Fade Out': 'Saída gradual',
  Flatten: 'Achatamento', 'Flip Axis': 'Eixo de virada', 'Focal Path': 'Trajetória focal', 'Focus Radius': 'Raio de foco',
  'Frame Size': 'Tamanho do quadro', Friction: 'Atrito', 'Gap X': 'Espaçamento horizontal', 'Gap Y': 'Espaçamento vertical',
  Girth: 'Largura', 'Globe Size': 'Tamanho do globo', Gravity: 'Gravidade', 'Grow From': 'Origem do crescimento',
  'Grow Turns': 'Voltas de crescimento', 'Hold Time': 'Tempo de pausa', 'Horizontal Look': 'Orientação horizontal',
  Images: 'Imagens', Inset: 'Margem interna', 'Iso Squash': 'Compressão isométrica', 'Lane Offset': 'Deslocamento da faixa',
  'Latitude Rows': 'Linhas de latitude', Lift: 'Elevação', Magnify: 'Ampliação', Mode: 'Modo',
  'Orbit Width': 'Largura da órbita', Order: 'Ordem', Pacing: 'Ritmo', 'Parallax Depth': 'Profundidade da paralaxe',
  Path: 'Trajetória', 'Peak Growth': 'Pico de crescimento', Pitch: 'Inclinação vertical', 'Radius X': 'Raio horizontal',
  'Radius Y': 'Raio vertical', 'Rear Fade': 'Desvanecimento traseiro', Recede: 'Recuo', 'Recycle Fade': 'Transição de repetição',
  'Resting Tilt': 'Inclinação de repouso', 'Ring Angle Offset': 'Defasagem angular dos anéis', 'Ring Gap': 'Espaço entre anéis',
  'Ring Opening': 'Abertura do anel', 'Ring Radius': 'Raio do anel', 'Ring Size': 'Tamanho do anel',
  'Ring Tilt': 'Inclinação do anel', 'Ring Width': 'Largura do anel', Rock: 'Balanço', 'Rows Skipped': 'Linhas alternadas',
  'Scale Amount': 'Intensidade da escala', 'Scale Dir': 'Direção da escala', 'Scale Pulse': 'Pulso de escala',
  Seed: 'Semente aleatória', Shear: 'Cisalhamento', 'Side Step': 'Passo lateral', 'Size Mix': 'Mistura de tamanhos',
  'Size Variation': 'Variação de tamanho', Solo: 'Isolar', Spin: 'Giro', 'Spin Amount': 'Intensidade do giro',
  'Spin Axis': 'Eixo de giro', 'Spin Thumbs': 'Girar miniaturas', 'Spiral Size': 'Tamanho da espiral', 'Spiral Turns': 'Voltas da espiral',
  'Spread Angle': 'Ângulo de dispersão', 'Spread Y': 'Dispersão vertical', 'Step Hold': 'Pausa por passo',
  Steps: 'Passos', Style: 'Estilo', Taper: 'Afunilamento', 'Thumb Size': 'Tamanho da miniatura', 'Tile Gap': 'Espaço entre blocos',
  'Tilt Amount': 'Intensidade da inclinação', 'Tray Direction': 'Direção da bandeja', 'Tray Gap': 'Espaço entre bandejas',
  'Trough Fade': 'Desvanecimento no vale', 'Tunnel Depth': 'Profundidade do túnel', 'Tunnel Size': 'Tamanho do túnel',
  Turn: 'Volta', Turns: 'Voltas', 'Two Sided': 'Duas faces', 'Vanish Drift': 'Desvio de saída',
  'Vertical Travel': 'Deslocamento vertical', Visible: 'Visível', 'Wave Spread': 'Dispersão da onda', Weave: 'Entrelaçamento', Wobble: 'Oscilação irregular',
  Layout: 'Layout', Motion: 'Movimento', Depth: 'Profundidade', Finish: 'Acabamento',
  Count: 'Quantidade', Direction: 'Direção', Speed: 'Velocidade', Hold: 'Pausa', Offset: 'Deslocamento',
  Zoom: 'Zoom', Scale: 'Escala', Rotation: 'Rotação', Opacity: 'Opacidade', Blend: 'Mesclagem',
  Perspective: 'Perspectiva', 'Corner Radius': 'Arredondamento', Fade: 'Desvanecimento', 'Outer Fade': 'Desvanecimento externo',
  Position: 'Posição', Size: 'Tamanho', Gap: 'Espaçamento', 'Row Gap': 'Espaçamento entre linhas', Rows: 'Linhas',
  Columns: 'Colunas', Stagger: 'Defasagem', Tilt: 'Inclinação', 'Tilt Style': 'Estilo de inclinação',
  'Plane Size': 'Tamanho do plano', 'Big Scale': 'Escala ampliada', 'Scale Focus': 'Foco da escala',
  'Card Size': 'Tamanho do cartão', 'Card Count': 'Quantidade de cartões', 'Card Gap': 'Espaço entre cartões',
  'Camera Distance': 'Distância da câmera', 'Depth Fade': 'Desvanecimento de profundidade',
  'Depth Gap': 'Espaçamento de profundidade', 'Edge Fade': 'Desvanecimento das bordas',
  'Max Scale': 'Escala máxima', 'Start Scale': 'Escala inicial', 'Zoom Amount': 'Intensidade do zoom',
  'Zoom Ratio': 'Proporção do zoom', Shadow: 'Sombra', Thickness: 'Espessura', Padding: 'Margem interna',
  Spread: 'Dispersão', Scatter: 'Distribuição', Curvature: 'Curvatura', Facing: 'Orientação',
  Duration: 'Duração', Colour: 'Cor', Color: 'Cor', Amount: 'Intensidade', Radius: 'Raio', Strength: 'Força',
  Angle: 'Ângulo', Frequency: 'Frequência', Amplitude: 'Amplitude', Threshold: 'Limite', Quality: 'Qualidade',
  Text: 'Texto', Image: 'Imagem', Fit: 'Ajuste', Fill: 'Preencher', Audio: 'Áudio', Track: 'Faixa',
  Flow: 'Fluxo', Glide: 'Deslize', Ease: 'Suave', Sweep: 'Varredura', Smooth: 'Fluido', Flip: 'Virada',
  Settle: 'Acomodar', Snap: 'Encaixe', Bounce: 'Quique', Spring: 'Mola', Wiggle: 'Oscilação', Overshoot: 'Ultrapassagem',
  Pixelate: 'Pixelizar', 'Pixel Size': 'Tamanho do pixel',
  Grain: 'Granulado', Vignette: 'Vinheta', Blur: 'Desfoque', 'Tilt-shift': 'Foco seletivo', 'Liquid Glass': 'Vidro líquido',
  Halftone: 'Meio-tom', Posterize: 'Posterizar', Scanlines: 'Linhas de varredura', 'RGB Split': 'Separação RGB', Wave: 'Onda',
  'Grain Size': 'Tamanho do grão', Animate: 'Animar', Softness: 'Suavidade', 'Applies at': 'Área de aplicação', Reach: 'Alcance',
  Intensity: 'Intensidade', Focus: 'Foco', Band: 'Faixa', Feather: 'Suavização', Refraction: 'Refração', Dispersion: 'Dispersão de cores',
  'Ring colour': 'Cor do anel', Shimmer: 'Cintilação', 'Edge blur': 'Desfoque da borda', 'Dot Size': 'Tamanho dos pontos',
  'Screen Angle': 'Ângulo da trama', Levels: 'Níveis', Mix: 'Mistura', Spacing: 'Espaçamento',
  'Motion Rotation': 'Giro do conjunto', Diameter: 'Diâmetro', Hinge: 'Articulação', 'Fade Mode': 'Modo de desvanecimento',
  Frontface: 'Face frontal', Backface: 'Face traseira',
};

const optionsPt: Record<string, string> = {
  surface: 'superfície', camera: 'câmera', wall: 'parede', cascade: 'cascata', totem: 'tótem', continuous: 'contínuo', waypoints: 'pontos de passagem', 'waypoints-no-zoom': 'pontos sem zoom',
  grid: 'grade', orbit: 'órbita', backward: 'para trás', downward: 'para baixo', upward: 'para cima', 'fast-slow-fast': 'rápido–lento–rápido', 'step-per-card': 'etapa por cartão',
  curved: 'curvo', upright: 'vertical', scatter: 'disperso', rotation: 'rotação', stream: 'fluxo', showcase: 'vitrine', bloom: 'expansão', ring: 'anel', straight: 'reto',
  rotate: 'girar', boomerang: 'bumerangue', pull: 'puxar', push: 'empurrar', equal: 'igual', eased: 'suavizado', scale: 'escala', drift: 'desvio', frame: 'quadro',
  inward: 'para dentro', outward: 'para fora', flow: 'fluxo', in: 'entrada', out: 'saída', tl: 'superior esquerdo', tr: 'superior direito', bl: 'inferior esquerdo', br: 'inferior direito',
  recede: 'recuar', top: 'topo', bottom: 'base', sweep: 'varredura', figure8: 'em oito', splittop: 'topo dividido', thirds: 'terços', grid6: 'grade de seis', columns: 'colunas', varied: 'variado',
  spiral: 'espiral', clockwise: 'horário', anticlockwise: 'anti-horário', both: 'ambos', 'in-out': 'entrada–saída', 'out-in': 'saída–entrada', index: 'índice', row: 'linha', col: 'coluna',
  multiply: 'multiplicar', screen: 'clarear', overlay: 'sobrepor', add: 'adicionar', 'hard-light': 'luz forte', 'soft-light': 'luz suave', difference: 'diferença', exclusion: 'exclusão',
  static: 'Estático', float: 'Flutuar',
  on: 'ligado', off: 'desligado', left: 'esquerda', right: 'direita', up: 'cima', down: 'baixo',
  forward: 'frente', reverse: 'reverso', center: 'centro', start: 'início', end: 'fim',
  fill: 'preencher', fit: 'ajustar', horizontal: 'horizontal', vertical: 'vertical',
  normal: 'normal', alternate: 'alternado', uniform: 'uniforme', fan: 'leque', none: 'nenhum',
  color: 'cor', image: 'imagem', card: 'cartão', same: 'igual', opposed: 'oposto', staggered: 'defasado',
  'full frame': 'quadro inteiro', edges: 'bordas', corners: 'cantos', band: 'faixa', lens: 'lente',
  circle: 'círculo', square: 'quadrado', mono: 'monocromático', show: 'mostrar', hide: 'ocultar', solid: 'sólido', alpha: 'transparência',
};

export function translateLabel(locale: Locale, value: string) {
  return locale === 'pt' ? labelsPt[value] ?? value : value;
}

export function translateOption(locale: Locale, value: string) {
  return locale === 'pt' ? optionsPt[value.toLowerCase()] ?? value : value;
}
