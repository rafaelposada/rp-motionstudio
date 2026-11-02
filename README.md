# RP MotionStudio

Editor local de composição e animação com biblioteca de modelos, camadas de texto,
imagens absolutas, áudio e exportação para pastas do computador. Interface em
português e inglês. Desenvolvimento da versão RP e direção do produto: Rafael Posada.

Rafael Posada é brand designer com mais de 13 anos de experiência em branding,
com atuação em estratégia de marca, identidade visual e presença digital para
advogados e escritórios de advocacia. Conheça seu trabalho em [rafaelposada.com](https://rafaelposada.com/).

## Instalar o aplicativo

Os instaladores estão em [Releases](https://github.com/rafaelposada/rp-motionstudio/releases).
O pacote desktop inclui FFmpeg e FFprobe: não exige Homebrew, Node.js, npm ou
um navegador separado na máquina de quem instala.

- **Mac Apple Silicon:** macOS 13 ou mais recente. Abra o `.dmg` e arraste o
  RP MotionStudio para Aplicativos na tela de instalação.
- **Windows x64 · Preview:** Windows 10 ou mais recente, Intel/AMD. Abra o
  `Setup-Preview.exe` e escolha a pasta. O pacote foi compilado e inspecionado
  no Mac; instalação, exportação e desinstalação ainda precisam de teste real
  no Windows.

Pacotes sem certificado comercial podem exibir avisos do sistema. Confira a
origem e os guias de [Mac](docs/INSTALAR-macOS.md) e [Windows](docs/INSTALAR-Windows.md).
Projetos e mídias pessoais não acompanham os instaladores. A atualização do
pacote desktop pode consultar novas versões automaticamente e abrir os instaladores
oficiais após sua confirmação. A substituição do aplicativo desktop é manual;
o atualizador descrito adiante pertence à instalação gerenciada por `npm run app`.

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

Requisitos: Node.js 24 ou mais recente, npm, Git e FFmpeg disponível no PATH.

```bash
git clone https://github.com/rafaelposada/rp-motionstudio.git
cd rp-motionstudio
npm ci
npm run app
```

Abra **http://127.0.0.1:3000/**. Esse é um endereço local, não uma versão hospedada.
O serviço foi projetado para uso individual, sem autenticação; mantenha-o restrito
ao computador. Publicar o código no GitHub não hospeda o editor nem seus projetos.
O workflow herdado de GitHub Pages tem acionamento manual e não é executado ao enviar código.

## Atualizações

`npm run app` prepara uma instalação local gerenciada e inicia o editor. Em aberturas
seguintes, reutiliza a instalação. Para desenvolver o código, use `npm run dev -- --hostname 127.0.0.1`;
esse modo informa novas versões, mas não modifica sua pasta de trabalho pelo aplicativo.

Em **Configurações → Atualizações**, é possível verificar versões e ativar/desativar
a consulta automática (ao abrir e a cada seis horas). A consulta lê somente os metadados
públicos deste repositório. Projetos e mídias não são enviados ao GitHub.

Uma versão com número maior habilita **Atualizar e reiniciar**. Após sua confirmação,
o app salva o projeto, pausa a edição, baixa a revisão exata confirmada, instala as
dependências e executa a compilação e os testes em uma pasta temporária. Reserve pelo
menos 3 GB livres e mantenha o computador ligado; a preparação pode levar alguns minutos.
A versão ativa só é trocada depois dessa preparação. Se a nova versão falhar ao iniciar,
o gerenciador restaura a anterior. Há também uma ação manual de restauração.

O endereço e a porta locais permanecem iguais, preservando o acesso ao armazenamento
do navegador. Pastas de projetos, mídias e exportações ficam fora das versões do programa.
O preparo temporário é removido após a tentativa; versões geradas antigas são limpas,
mantendo a ativa e a anterior. Uma instalação legada na pasta `App` é preservada.
O gerenciador e as versões usam a mesma pasta de dados do app: `Motion Studio` em
Application Support no macOS; `RP MotionStudio` em LocalAppData no Windows e
`~/.local/share/rp-motionstudio` no Linux. O processo só atende no endereço de loopback.

Instalações antigas precisam receber esta versão uma vez antes de oferecer a atualização
pelo próprio aplicativo. Publicar mudanças de código no GitHub deve incluir um aumento
de versão em `package.json` e `package-lock.json`; o número da versão aparece no app automaticamente.

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
- T ativa a ferramenta de texto: clique na composição para criar e digitar no
  ponto escolhido. Esc cancela a ferramenta antes do clique; durante a edição,
  confirma o conteúdo. O atalho respeita campos, diálogos e digitação em andamento.
- Fundo do texto com cor, opacidade, contorno independente e cantos ajustáveis.
- Padding do fundo do texto: valor único ou quatro lados independentes, com cálculos.
  O padding também é respeitado pelo BG Blur, pelo contorno e pela caixa de seleção.
- Desfazer: ⌘/Ctrl+Z. Refazer: ⌘/Ctrl+Shift+Z; no Windows, Ctrl+Y também funciona.
- Composição dos modelos em um seletor compacto no espaço livre da primeira linha
  da timeline. O modo Único/Compor e a visibilidade das outras camadas são preservados
  ao trocar o modelo ativo.
- Rotação pela área externa das oito alças da BBox, incluindo os centros superior
  e inferior, com leitura do ângulo e encaixe de 15° com Shift.
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
de appariciojunior e colaboradores; não é o aplicativo oficial. A partir da versão
1.3.0, esta edição adota [Apache License 2.0](LICENSE), com a origem e a transição
documentadas em [LICENSING.md](LICENSING.md). Avisos e licenças de terceiros são
preservados em [NOTICE](NOTICE) e [licenses](licenses).

## Versão desktop separada · macOS e Windows

O editor e seus recursos são reaproveitados em uma janela Electron com armazenamento
próprio. A instalação de navegador permanece independente. O aplicativo desktop não
contrata serviços, não usa uma API paga e não exige assinatura de desenvolvedor para
ser compilado e testado localmente. A distribuição sem assinatura/notarização pode
mostrar avisos de segurança do sistema. Não há promessa de publicação em lojas.

```bash
npm ci
npm run build
npm run desktop:package
```

A saída fica em `dist-desktop/packages`, para o sistema e arquitetura que executam
o comando. No Windows, gere e valide o pacote em uma máquina Windows. O projeto
não declara que um pacote Windows foi testado apenas porque compilou no macOS.
Os pacotes desktop 1.4.5 incluem FFmpeg 9.0.2, FFprobe, x264 e zlib, específicos
para o sistema e arquitetura. A exportação usa esses executáveis por caminho
absoluto; não depende de Homebrew ou FFmpeg instalado no computador do usuário.
Os programas de mídia são agregados separados: FFmpeg/x264 mantêm GPL versão 2
ou posterior; zlib mantém sua licença. Fontes completos, opções de compilação
e licenças acompanham `resources/media/licenses` (dentro de Contents no macOS).
A preparação exclui arquivos `.env`,
exportações, projetos privados e imagens de referência.

Para usar sem empacotar: `npm run desktop:prepare` e `npm run desktop`.

Antes de empacotar, gere a mídia com `scripts/build-media.cjs`. Esse script fixa
revisões e SHA-256 de FFmpeg, x264 e zlib, compila estaticamente e inclui seus
fontes. Requer ferramentas de desenvolvimento somente na máquina de compilação:
C compiler, make, NASM e pkg-config. Para Windows gerado no Mac, utiliza LLVM-MinGW
com revisão e SHA-256 fixos. `RP_NASM` e `RP_PKG_CONFIG` podem apontar às ferramentas;
`RP_MEDIA_ROOT` aponta à saída que contém `darwin-arm64` e `win32-x64`.

O destino padrão do empacotador é o sistema atual. `--target=win32-x64` gera o
pacote Windows, com `RP_WINDOWS_MODULES` apontando às dependências preparadas por
`npm ci --os=win32 --cpu=x64 --ignore-scripts`. Os módulos nativos macOS são
substituídos pelos de Windows. O instalador `.exe` é gerado pelo compilador NSIS
indicado em `RP_MAKENSIS`, usando `scripts/build-windows-installer.cjs`. A instalação
é por usuário, inclui atalhos e desinstalador e preserva dados de projetos.
O DMG é gerado por `scripts/build-dmg.cjs`, com Python e `dmgbuild==1.6.7` somente
na máquina de compilação (`RP_DMG_PYTHON` aponta ao Python preparado). A arte
vetorial fica em `desktop/installer/mac-background.svg`; `scripts/dmg-settings.py`
define a posição dos ícones e a janela, sem alterar preferências globais do Finder.
O NSIS usa arte de boas-vindas, ícones RP e controles nativos para teclado e DPI.
Os guias estão em `docs/INSTALAR-*.md`.
O desktop consulta somente Releases publicadas com instalador compatível; commits
novos na branch main não são tratados como um novo pacote desktop. A consulta é
automática, enquanto a troca do aplicativo pelo DMG/EXE é assistida. A edição
local de navegador possui outro mecanismo, com preparação, testes e recuperação
da versão anterior; usa compilação Webpack em pasta canônica para evitar falhas
de raiz do Turbopack. Confirmação, progresso e falhas aparecem em pop-ups centrais.
O primeiro instalador Windows é uma distribuição de teste até sua execução real
ser validada nesse sistema; gerar um PE/NSIS no Mac não comprova esse funcionamento.

### Projetos e fechamento

⌘/Ctrl+Shift+] leva a seleção ao topo da composição; ⌘/Ctrl+Shift+[ envia ao
fundo. Textos, imagens absolutas e modelos compartilham a mesma ordem. A seleção
múltipla mantém sua ordem interna e cada comando pode ser desfeito em uma etapa.
Os atalhos ficam suspensos durante a digitação e em diálogos.

Nos campos numéricos, ↑/↓ ajusta o passo normal; Shift+↑/↓ usa um passo dez
vezes menor; ⌘/Ctrl+Shift+↑/↓ usa um passo cem vezes menor. Contagens, quadros
e dimensões inteiras preservam valores válidos. Os decimais finos são mantidos
ao sair do campo, salvar e exportar.

As setas laterais do preview recolhem e reabrem os painéis esquerdo e direito,
preservando seus tamanhos. A linha do tempo permanece disponível. A barra lateral
mantém somente as ações e a navegação principais.

Selecione letras ou palavras no campo Conteúdo, ou durante a edição na tela,
para aplicar fonte, peso, cor e opacidade do preenchimento somente ao trecho.
Fonte, Peso e Cor mostram “Misto” quando a seleção contém estilos diferentes.
“Texto inteiro” volta a aplicar essas propriedades à camada completa. Os trechos
são preservados em desfazer/refazer, rascunhos, templates e exportações, incluindo
os arquivos das fontes nos pacotes portáteis.

O menu Arquivo oferece Abrir rascunho/template (⌘/Ctrl+O), Salvar composição
(⌘/Ctrl+S) e Salvar rascunho (⌘/Ctrl+Shift+S). Fechar por ⌘W, ⌘Q ou pelos
controles do sistema pede uma cópia portátil quando há uma composição aberta.
Salvar rascunho só libera o fechamento após o pacote ser gravado; falha de
gravação mantém a janela. Cancelar volta ao editor. No Windows, Ctrl+W e
Alt+F4 passam pelo mesmo controle. Encerramento forçado ou queda de energia
dependem do último salvamento automático, sem garantia de diálogo.

Os dados desktop ficam em `RP MotionStudio Desktop` dentro de Application Support
no macOS, AppData/Roaming no Windows e a pasta de dados do usuário no Linux. A
origem interna é fixa, mesmo que a porta do serviço local mude entre aberturas.
O serviço executa uma cópia descartável do runtime na subpasta `Runtime` desses
dados, mantendo o pacote do aplicativo intacto. Essa cópia ocupa cerca de 100 MB;
versões antigas identificadas como geradas pelo próprio app são limpas ao abrir.
Para transferir a edição antiga, salve pacotes `.motion.zip` nela e importe-os
na edição desktop. Confira as mídias e a exportação antes de substituir a instalação
antiga. O original permanece preservado. Nunca remova os dados do navegador para
fazer a migração.

Esta primeira edição desktop consulta versões no GitHub, mas a substituição do
pacote desktop é manual. O atualizador gerenciado da edição de navegador permanece
independente. Arquivos publicados de identificação profissional incluem
`CITATION.cff` e `public/llms.txt`; metadados descrevem Rafael Posada como criador
da edição RP. Isso não garante indexação, recomendação por IA ou publicação do
editor local na internet.

### Remover a edição desktop

Feche o aplicativo e guarde seus rascunhos antes de remover os dados. No macOS,
mova `RP MotionStudio Desktop.app` e, se quiser excluir também os projetos e
preferências desta edição, `~/Library/Application Support/RP MotionStudio Desktop`
para a Lixeira. No Windows, remova a pasta do pacote e, opcionalmente,
`%APPDATA%\RP MotionStudio Desktop`. Os arquivos exportados e os rascunhos nas
pastas escolhidas são independentes: preserve-os ou remova-os separadamente.
A edição desktop não instala um serviço de inicialização; seu processo local
é encerrado junto com o aplicativo. A instalação antiga de navegador não é
removida por esse procedimento.
