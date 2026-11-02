# RP MotionStudio · Windows x64

Versão 1.4.5 · Rafael Posada

Este é o primeiro pacote Windows, gerado a partir do Mac. Os executáveis foram
inspecionados e o instalador foi compilado; a execução completa do aplicativo,
exportação e desinstalação ainda precisam ser validadas em um Windows real.
Trate esta distribuição Windows como versão de teste.

## Requisitos e instalação

- Windows 10 de 64 bits ou mais recente; processador Intel/AMD x64.
- Abra RP-MotionStudio-1.4.5-Windows-x64-Setup-Preview.exe.
- Escolha a pasta de instalação e conclua o assistente. O destino padrão é
  %LOCALAPPDATA%\Programs\RP MotionStudio. A instalação é por usuário.
- Abra RP MotionStudio pelo menu Iniciar ou pelo atalho na área de trabalho.

Node.js, npm, navegador separado, FFmpeg e FFprobe não precisam de instalação
separada. O pacote inclui o ambiente Electron e as ferramentas de mídia.
Não há download de componentes durante a instalação.

O instalador ainda não tem assinatura Authenticode de um certificado comercial.
Windows/SmartScreen pode apresentar um aviso de aplicativo desconhecido. Confira
a origem e a integridade do arquivo antes de decidir executá-lo. Não desative o
antivírus ou outras proteções para instalar este pacote.

## Arquivos e privacidade

Projetos e mídias ficam no computador. Dados locais da edição desktop são
armazenados em %APPDATA%\RP MotionStudio Desktop. Rascunhos .motion.zip,
templates e exportações ficam nas pastas escolhidas pelo usuário. Guarde
rascunhos independentes para backup e transferência entre computadores.

A edição desktop possui armazenamento próprio. Para trazer projetos da edição
de navegador, importe os respectivos pacotes .motion.zip. Este instalador não
inclui projetos pessoais ou mídias do desenvolvedor.

Configurações → Arquivos informa “Incluído no aplicativo” na exportação local.
FFmpeg 9.0.2 e x264 são programas agregados, sob GPL versão 2 ou posterior, com
licenças e fontes completos em resources\media\licenses da pasta instalada.
RP MotionStudio mantém sua licença Apache 2.0 e os demais avisos de terceiros.

## Internet, atualização e remoção

Editar mídias e exportar usa os arquivos locais. O primeiro uso de uma fonte
Google e a consulta de versões precisam de internet. Atualizar o pacote desktop
é uma operação manual nesta versão.

Feche o aplicativo antes de atualizar ou desinstalar. A remoção pode ser feita
em Configurações do Windows → Aplicativos → RP MotionStudio. O desinstalador
remove os arquivos do programa e os atalhos, preservando os dados dos projetos.
Para excluir também esses dados, guarde os rascunhos e depois remova manualmente
%APPDATA%\RP MotionStudio Desktop. Exportações e rascunhos são independentes.

## Contato

Rafael Posada · https://rafaelposada.com
Instagram: https://instagram.com/rafaelposada
E-mail: contato@rafaelposada.com
Código: https://github.com/rafaelposada/rp-motionstudio
