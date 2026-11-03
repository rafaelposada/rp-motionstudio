# RP MotionStudio Desktop · instalação no Mac

Versão 1.4.10 · Rafael Posada

## Compatibilidade deste pacote

- Mac com processador Apple Silicon (famílias M1, M2, M3, M4 e posteriores).
- macOS 13 Ventura ou mais recente, conforme o requisito do pacote Electron.
- Esta distribuição foi verificada em um Mac Apple Silicon. Não é um pacote
  para Macs Intel nem para Windows.

## Instalação

1. Abra o arquivo RP-MotionStudio-1.4.10-macOS-Apple-Silicon.dmg.
2. Arraste RP MotionStudio Desktop para o atalho Aplicativos.
3. Aguarde a cópia, ejete o disco RP MotionStudio 1.4.10 e abra o aplicativo
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

## Avisos do macOS

Esta edição tem assinatura local de integridade, sem certificado Developer ID
e sem notarização da Apple. Ao recebê-la por download, e-mail ou AirDrop, o
macOS pode bloquear sua abertura por não conseguir verificar o desenvolvedor.
Somente prossiga se reconhecer a origem e confiar no arquivo recebido.
Consulte o procedimento oficial da Apple adequado ao aviso apresentado:
https://support.apple.com/pt-br/102445

Não é necessário desativar globalmente as proteções do macOS. Uma assinatura
local não equivale à aprovação ou à verificação de segurança pela Apple.

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
