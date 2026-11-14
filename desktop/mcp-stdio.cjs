// RP MotionStudio desktop — Copyright 2026 Rafael Posada. Apache-2.0.
// Local connector for Claude (stdio). Runs with the app's own binary in Node
// mode (ELECTRON_RUN_AS_NODE=1), so nothing else needs to be installed. It
// opens RP MotionStudio in the background when it is not running, then relays
// each JSON-RPC message to the app's MCP server on 127.0.0.1.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), readline = require('node:readline');
const { spawn } = require('node:child_process');

const configPath = process.env.RP_MCP_CONFIG || (process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library', 'Application Support', 'RP MotionStudio Desktop', 'mcp.json')
  : process.platform === 'win32' ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'RP MotionStudio Desktop', 'mcp.json')
  : path.join(os.homedir(), '.config', 'RP MotionStudio Desktop', 'mcp.json'));

const log = (...parts) => process.stderr.write(`[rp-motionstudio] ${parts.join(' ')}\n`);
const readConfig = () => { try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { return null; } };

async function ping(config) {
  try {
    const response = await fetch(`http://127.0.0.1:${config.port}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 'ping', method: 'ping' }), signal: AbortSignal.timeout(3000) });
    return response.status;
  } catch { return 0; }
}

function launchApp() {
  // Running inside the app bundle: …/RP MotionStudio Desktop.app/Contents/MacOS/<binary>.
  const bundle = process.platform === 'darwin' ? path.resolve(path.dirname(process.execPath), '..', '..') : '';
  if (process.platform === 'darwin') {
    const target = bundle.endsWith('.app') ? ['-g', bundle] : ['-g', '-a', 'RP MotionStudio Desktop'];
    spawn('/usr/bin/open', [...target, '--args', '--background'], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'win32' && /RP-MotionStudio\.exe$/i.test(process.execPath)) {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    spawn(process.execPath, ['--background'], { detached: true, stdio: 'ignore', env }).unref();
  } else throw Error('Abra o RP MotionStudio Desktop e tente de novo.');
}

let ready = null;
function ensureApp() {
  return ready ??= (async () => {
    let config = readConfig();
    if (config && await ping(config) === 200) return config;
    log('abrindo o RP MotionStudio em segundo plano…');
    launchApp();
    const started = Date.now();
    while (Date.now() - started < 120000) {
      await new Promise((r) => setTimeout(r, 750));
      config = readConfig();
      if (!config) continue;
      const status = await ping(config);
      if (status === 200) return config;
      if (status === 503) throw Error('O controle pelo Claude está desligado em RP MotionStudio → Configurações → Claude.');
    }
    throw Error('O RP MotionStudio não respondeu em 2 minutos.');
  })().catch((error) => { ready = null; throw error; });
}

async function relay(message) {
  let config;
  try { config = await ensureApp(); }
  catch (error) { return message.id === undefined ? null : { jsonrpc: '2.0', id: message.id, error: { code: -32000, message: error.message } }; }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${config.port}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${config.token}` }, body: JSON.stringify(message) });
      if (response.status === 202) return null;
      const text = await response.text();
      if (response.ok) return JSON.parse(text);
      return message.id === undefined ? null : { jsonrpc: '2.0', id: message.id, error: { code: -32000, message: (() => { try { return JSON.parse(text).error; } catch { return text; } })() || `HTTP ${response.status}` } };
    } catch (error) {
      // The app was closed between calls: open it again once.
      if (attempt === 0) { ready = null; try { config = await ensureApp(); continue; } catch (launch) { error = launch; } }
      return message.id === undefined ? null : { jsonrpc: '2.0', id: message.id, error: { code: -32000, message: error.message } };
    }
  }
  return null;
}

// The handshake and the tool list are answered here, so Claude and Codex
// connect at once; the app only opens when a tool is actually used.
const { TOOLS, PROTOCOLS, INSTRUCTIONS } = require('./mcp.cjs');
const version = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version; } catch { return 'desktop'; } })();
function local(message) {
  if (message?.id === undefined) return message?.method?.startsWith('notifications/') ? { handled: true, value: null } : null;
  const reply = (result) => ({ handled: true, value: { jsonrpc: '2.0', id: message.id, result } });
  if (message.method === 'initialize') return reply({ protocolVersion: PROTOCOLS.includes(message.params?.protocolVersion) ? message.params.protocolVersion : PROTOCOLS[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'rp-motionstudio', title: 'RP MotionStudio', version }, instructions: INSTRUCTIONS });
  if (message.method === 'tools/list') return reply({ tools: TOOLS });
  if (message.method === 'ping') return reply({});
  return null;
}
const out = (value) => { if (value) process.stdout.write(JSON.stringify(value) + '\n'); };
readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try { message = JSON.parse(line); } catch { out({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); return; }
  const answered = local(message);
  if (answered) { out(answered.value); return; }
  void relay(message).then(out, (error) => out({ jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32603, message: String(error?.message ?? error) } }));
});
process.stdin.on('end', () => process.exit(0));
