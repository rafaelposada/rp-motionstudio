// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const quote=s=>s.replace(/\$/g,()=> '$$').replace(/"/g,()=> '$\\"');
async function main(){
  const [sourceArg,outputArg]=process.argv.slice(2),compiler=process.env.RP_MAKENSIS;
  if(![sourceArg,outputArg,compiler].every(p=>p&&path.isAbsolute(p))||!outputArg.endsWith('.exe'))throw Error('Informe pasta win32, caminho Setup.exe e RP_MAKENSIS absoluto.');
  const source=await fs.realpath(sourceArg),output=path.resolve(outputArg);
  try{await fs.access(output);throw Error('Destino já existe.');}catch(e){if(e.code!=='ENOENT')throw e;}
  const pkg=JSON.parse(await fs.readFile(path.join(source,'resources/app/package.json'),'utf8'));
  for(const file of ['RP-MotionStudio.exe','resources/media/bin/ffmpeg.exe','resources/media/bin/ffprobe.exe'])await fs.access(path.join(source,file));
  const files=[],directories=[];
  async function walk(dir,relative=''){for(const item of await fs.readdir(dir,{withFileTypes:true})){const rel=path.join(relative,item.name);if(item.isSymbolicLink())throw Error('Pacote Windows contém ligação simbólica.');if(item.isDirectory()){directories.push(rel);await walk(path.join(dir,item.name),rel);}else files.push(rel);}}
  await walk(source);
  const win=rel=>quote(rel.split(path.sep).join('\\'));
  const cleanup=files.map(file=>`Delete "$INSTDIR\\${win(file)}"`).concat(directories.sort((a,b)=>b.split(path.sep).length-a.split(path.sep).length).map(dir=>`RMDir "$INSTDIR\\${win(dir)}"`)).join('\n');
  const stage=await fs.mkdtemp(path.join(os.tmpdir(),'rp-nsis-'));
  try{
    const design=await require('./installer-artwork.cjs').artwork(path.join(stage,'design'));
    const script=`Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
Name "RP MotionStudio"
BrandingText "RP MotionStudio · Rafael Posada"
ManifestDPIAware true
SetFont "Segoe UI" 9
OutFile "${quote(output)}"
InstallDir "$LOCALAPPDATA\\Programs\\RP MotionStudio"
InstallDirRegKey HKCU "Software\\Rafael Posada\\RP MotionStudio" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 32
VIProductVersion "${pkg.version}.0"
VIAddVersionKey /LANG=1046 "ProductName" "RP MotionStudio"
VIAddVersionKey /LANG=1046 "CompanyName" "Rafael Posada"
VIAddVersionKey /LANG=1046 "FileDescription" "Instalador RP MotionStudio com FFmpeg"
VIAddVersionKey /LANG=1046 "FileVersion" "${pkg.version}"
VIAddVersionKey /LANG=1046 "LegalCopyright" "Rafael Posada e respectivos colaboradores"
!define MUI_ABORTWARNING
!define MUI_ICON "${quote(path.join(design,'rp.ico'))}"
!define MUI_UNICON "${quote(path.join(design,'rp.ico'))}"
!define MUI_WELCOMEFINISHPAGE_BITMAP "${quote(path.join(design,'welcome.bmp'))}"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${quote(path.join(design,'welcome.bmp'))}"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "${quote(path.join(design,'header.bmp'))}"
!define MUI_HEADERIMAGE_RIGHT
!define MUI_BGCOLOR "FFFFFF"
!define MUI_TEXTCOLOR "17181B"
!define MUI_WELCOMEPAGE_TITLE "Seu próximo movimento começa aqui."
!define MUI_WELCOMEPAGE_TEXT "Crie composições com fotos, vídeos e texto no RP MotionStudio.$\\r$\\n$\\r$\\nFFmpeg e FFprobe já estão incluídos. A instalação funciona sem baixar componentes adicionais.$\\r$\\n$\\r$\\nVocê escolhe a pasta do aplicativo. Seus projetos e mídias ficam separados e permanecem no computador."
!insertmacro MUI_PAGE_WELCOME
!define MUI_DIRECTORYPAGE_TEXT_TOP "Escolha onde instalar o RP MotionStudio. Seus projetos e preferências ficam em uma pasta separada."
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TITLE "Seu estúdio está pronto."
!define MUI_FINISHPAGE_TEXT "O RP MotionStudio foi instalado com as ferramentas de exportação incluídas.$\\r$\\n$\\r$\\nAbra o aplicativo pelo menu Iniciar ou pelo atalho da área de trabalho."
!define MUI_FINISHPAGE_RUN "$INSTDIR\\RP-MotionStudio.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir o RP MotionStudio"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"
Function .onInit
  \${IfNot} \${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Este pacote exige Windows de 64 bits."
    Abort
  \${EndIf}
  \${IfNot} \${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "Este pacote exige Windows 10 ou mais recente."
    Abort
  \${EndIf}
  FindWindow $0 "" "RP MotionStudio"
  \${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Feche o RP MotionStudio antes de instalar."
    Abort
  \${EndIf}
FunctionEnd
Function .onVerifyInstDir
  StrCmp $INSTDIR "$PROFILE" invalid
  StrCmp $INSTDIR "$LOCALAPPDATA" invalid
  StrLen $0 $INSTDIR
  IntCmp $0 4 invalid invalid valid
  invalid:
    Abort
  valid:
    IfFileExists "$INSTDIR\\.rp-motionstudio-install" verified
    FindFirst $0 $1 "$INSTDIR\\*"
    IfErrors verified
    scan:
      StrCmp $1 "" empty
      StrCmp $1 "." next
      StrCmp $1 ".." next
      FindClose $0
      Abort
    next:
      FindNext $0 $1
      Goto scan
    empty:
      FindClose $0
    verified:
FunctionEnd
Section "RP MotionStudio"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r "${quote(source)}/*"
  FileOpen $0 "$INSTDIR\\.rp-motionstudio-install" w
  FileWrite $0 "RP MotionStudio ${pkg.version}"
  FileClose $0
  WriteUninstaller "$INSTDIR\\Desinstalar RP MotionStudio.exe"
  CreateDirectory "$SMPROGRAMS\\RP MotionStudio"
  CreateShortcut "$SMPROGRAMS\\RP MotionStudio\\RP MotionStudio.lnk" "$INSTDIR\\RP-MotionStudio.exe"
  CreateShortcut "$DESKTOP\\RP MotionStudio.lnk" "$INSTDIR\\RP-MotionStudio.exe"
  WriteRegStr HKCU "Software\\Rafael Posada\\RP MotionStudio" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\RP MotionStudio" "DisplayName" "RP MotionStudio"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\RP MotionStudio" "DisplayVersion" "${pkg.version}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\RP MotionStudio" "Publisher" "Rafael Posada"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\RP MotionStudio" "URLInfoAbout" "https://rafaelposada.com"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\RP MotionStudio" "UninstallString" '$\\"$INSTDIR\\Desinstalar RP MotionStudio.exe$\\"'
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\RP MotionStudio" "DisplayIcon" "$INSTDIR\\RP-MotionStudio.exe"
SectionEnd
Function un.onInit
  FindWindow $0 "" "RP MotionStudio"
  \${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Feche o RP MotionStudio antes de desinstalar."
    Abort
  \${EndIf}
FunctionEnd
Section "Uninstall"
  SetShellVarContext current
  ${cleanup}
  Delete "$INSTDIR\\.rp-motionstudio-install"
  Delete "$INSTDIR\\Desinstalar RP MotionStudio.exe"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\\RP MotionStudio.lnk"
  Delete "$SMPROGRAMS\\RP MotionStudio\\RP MotionStudio.lnk"
  RMDir "$SMPROGRAMS\\RP MotionStudio"
  DeleteRegKey HKCU "Software\\Rafael Posada\\RP MotionStudio"
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\RP MotionStudio"
SectionEnd
`;
    const file=path.join(stage,'installer.nsi');await fs.writeFile(file,script);await fs.mkdir(path.dirname(output),{recursive:true});
    execFileSync(compiler,['-V2',file],{env:process.env,stdio:'inherit'});
    const hash=crypto.createHash('sha256');for await(const data of require('node:fs').createReadStream(output))hash.update(data);const sha256=hash.digest('hex');await fs.writeFile(output+'.sha256',`${sha256}  ${path.basename(output)}\n`,{flag:'wx'});
    console.log(JSON.stringify({output,bytes:(await fs.stat(output)).size,version:pkg.version,sha256,files:files.length}));
  }finally{await fs.rm(stage,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
