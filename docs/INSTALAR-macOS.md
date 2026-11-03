# RP MotionStudio Desktop · instalação no Mac

Versão 1.4.11 · Rafael Posada

## Compatibilidade deste pacote

- Mac com processador Apple Silicon (famílias M1, M2, M3, M4 e posteriores).
- macOS 13 Ventura ou mais recente, conforme o requisito do pacote Electron.
- Esta distribuição foi verificada em um Mac Apple Silicon. Não é um pacote
  para Macs Intel nem para Windows.

## Instalação

1. Abra o arquivo RP-MotionStudio-1.4.11-macOS-Apple-Silicon.dmg.
2. Arraste RP MotionStudio Desktop para o atalho Aplicativos.
3. Aguarde a cópia, ejete o disco RP MotionStudio 1.4.11 e abra o aplicativo
   pela pasta Aplicativos. Evite executá-lo diretamente do disco de instalação.

Node.js, npm e um navegador separado não são necessários para executar o pacote.
O aplicativo não contém projetos ou mídias pessoais do desenvolvedor.

## Exportação incluída

FFmpeg 9.0.2, FFprobe e o codificador H.264 x264 acompanham o aplicativo.
Exportação de MP4/GIF e análise do áudio funcionam com os binários internos,
sem instalar Homebrew, Node.js ou ferramentas de mídia separadas. Confira
Configurações → Arquivos → Exportação local: aparece “Incluído no aplicativo”.
As bibliotecas de mídia são programas separados sob GPL versão 2 ou posterior;
as licenças e seus fontes completos estão em Contents/Resources/media/licenses.

## Primeira abertura

Esta edição tem assinatura local de integridade, sem certificado Developer ID
e sem notarização da Apple. Na primeira abertura em um Mac novo, o macOS
bloqueia o app com o aviso “não pode ser aberto” ou “não foi aberto”. Somente
prossiga se reconhecer a origem e confiar no arquivo recebido.

1. Copie o app para Aplicativos e tente abri-lo. Clique em OK ou Concluído.
2. Abra Ajustes do Sistema → Privacidade e Segurança e role até Segurança.
3. Ao lado de “RP MotionStudio Desktop”, clique em Abrir Mesmo Assim e
   confirme com a senha ou o Touch ID.

O botão aparece logo depois da tentativa bloqueada; se sumir, tente abrir o
app de novo. No macOS 13 e 14, também funciona clicar no app com a tecla
Control pressionada e escolher Abrir. A liberação vale só para este app; o
macOS pode pedi-la de novo quando uma versão nova for baixada.

Mac com processador Intel não abre este pacote, mesmo com a liberação.
Procedimento oficial da Apple: https://support.apple.com/pt-br/102445

## Projetos, internet e atualizações

Projetos e mídias são armazenados no computador. A edição desktop possui dados
próprios, separados da edição antiga de navegador. Para transferir projetos,
importe um pacote .motion.zip. Guarde rascunhos independentes antes de remover
qualquer instalação.

Modelos e mídias locais podem ser editados sem internet. O primeiro uso de uma
fonte do Google e a consulta de atualizações precisam de conexão. Nesta edição,
a substituição do aplicativo desktop por uma versão nova é manual.

## Remoção

Feche o aplicativo e mova RP MotionStudio Desktop.app para a Lixeira. Para
remover também projetos locais e preferências da edição desktop, guarde seus
rascunhos e depois mova a pasta abaixo para a Lixeira:

~/Library/Application Support/RP MotionStudio Desktop

Rascunhos, templates e exportações nas pastas escolhidas pelo usuário são
independentes. O app não instala um serviço de inicialização automática.

## Contato e licença

Desenvolvimento da edição RP: Rafael Posada.
Site: https://rafaelposada.com
Instagram: https://instagram.com/rafaelposada
E-mail: contato@rafaelposada.com
Código: https://github.com/rafaelposada/rp-motionstudio

RP MotionStudio: Apache License 2.0. Componentes de terceiros mantêm suas
licenças e atribuições. LICENSE, NOTICE e licenses acompanham o aplicativo.
