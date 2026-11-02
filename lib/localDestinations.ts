// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
// Server only. Keep preferences inside the existing app data directory so the
// app's uninstaller also removes them. Exported user files remain independent.
import { promises as fs, constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';

export type DestinationKind = 'exports' | 'drafts' | 'templates';
export const isDestinationKind = (kind: unknown): kind is DestinationKind => ['exports', 'drafts', 'templates'].includes(String(kind));
const directory = process.env.RP_MOTION_CONFIG_DIR || (process.platform==='darwin'?path.join(os.homedir(),'Library','Application Support','Motion Studio'):process.platform==='win32'?path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'RP MotionStudio'):path.join(os.homedir(),'.local','share','rp-motionstudio'));
const configPath = path.join(directory, 'destinations.json');
const defaults: Record<DestinationKind, string> = {
  exports: path.join(os.homedir(), 'Movies', 'Motion Studio Exports'),
  drafts: path.join(os.homedir(), 'Documents', 'Motion Studio Projects'),
  templates: path.join(os.homedir(), 'Documents', 'RP MotionStudio Templates'),
};
let writing: Promise<unknown> = Promise.resolve();

export function isLocalFileRequest(request: Request) {
  const url = new URL(request.url), local = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host);
  // Next's standalone server canonicalizes request.url to localhost even when
  // the browser opened 127.0.0.1. Host retains the actual HTTP destination.
  let destination: URL;
  try { destination = new URL(`${url.protocol}//${request.headers.get('host') ?? url.host}`); }
  catch { return false; }
  if (destination.username || destination.password || !local(destination.hostname) || !local(url.hostname) || request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  return !origin || origin === destination.origin;
}

export async function getDestinations(): Promise<Record<DestinationKind, string>> {
  try {
    const data = JSON.parse(await fs.readFile(configPath, 'utf8'));
    return Object.fromEntries(Object.entries(defaults).map(([kind, fallback]) => [kind, typeof data[kind] === 'string' && path.isAbsolute(data[kind]) ? data[kind] : fallback])) as Record<DestinationKind, string>;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Não foi possível ler as pastas salvas.'); return { ...defaults }; }
}

export async function destinationFor(kind: DestinationKind) {
  const chosen = (await getDestinations())[kind];
  await fs.mkdir(chosen, { recursive: true });
  await fs.access(chosen, constants.W_OK);
  return chosen;
}

export async function setDestination(kind: DestinationKind, value: string) {
  if (!value || !path.isAbsolute(value) || value.includes('\0')) throw new Error('Informe o caminho absoluto de uma pasta existente.');
  const resolved = await fs.realpath(value);
  if (!(await fs.stat(resolved)).isDirectory()) throw new Error('Escolha uma pasta.');
  await fs.access(resolved, constants.W_OK);
  const task = writing.catch(() => {}).then(async () => {
    const next = { ...await getDestinations(), [kind]: resolved };
    await fs.mkdir(directory, { recursive: true });
    const temporary = path.join(directory, `destinations-${crypto.randomUUID()}.tmp`);
    try { await fs.writeFile(temporary, JSON.stringify(next), { flag: 'wx', mode: 0o600 }); await fs.rename(temporary, configPath); }
    finally { await fs.rm(temporary, { force: true }); }
    return next;
  });
  writing = task;
  return task;
}

export async function chooseDestination(kind: DestinationKind) {
  if (process.platform !== 'darwin') throw new Error('Neste sistema, digite o caminho da pasta.');
  const prompt = kind === 'exports' ? 'Pasta para os vídeos exportados' : kind === 'drafts' ? 'Pasta para os rascunhos' : 'Pasta para os templates';
  try {
    // Constant script and separate argv: folder names never become AppleScript.
    const { stdout } = await promisify(execFile)('/usr/bin/osascript', ['-e', 'on run argv\nreturn POSIX path of (choose folder with prompt (item 1 of argv))\nend run', prompt], { timeout: 120000 });
    return setDestination(kind, stdout.trim());
  } catch (error) { if (String((error as { stderr?: string }).stderr).includes('(-128)')) return getDestinations(); throw error; }
}
