// RP MotionStudio desktop — Copyright 2026 Rafael Posada. Apache-2.0.
// MCP server (Streamable HTTP, JSON responses) that lets Claude drive the
// editor. It listens on 127.0.0.1 only, answers only requests that carry the
// token kept in the app's data folder, and turns each tool call into a request
// to the editor window, which runs it through lib/claudeBridge.ts.
const http = require('node:http'), fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');

const PORT = 47311;
const RETRY_MS = Number(process.env.RP_MCP_RETRY_MS) || 5000;
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const IMAGE = /\.(png|jpe?g|webp|gif|avif|bmp|heic)$/i, VIDEO = /\.(mp4|mov|m4v|webm)$/i;
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp', heic: 'image/heic', mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/mp4', webm: 'video/webm' };
const LIMIT = { image: 60 * 1024 * 1024, video: 300 * 1024 * 1024, files: 40 };

const INSTRUCTIONS = `RP MotionStudio é um editor de vídeos com modelos de movimento (cartões com fotos e vídeos), textos, formas e camadas de código (Canvas 2D ou WebGL).
Para um pedido simples ("faz um reels com estas fotos"), decida tudo sem perguntar: chame list_templates, escolha o modelo que combina com o pedido e o formato (9:16 para Reels/Stories, 4:5 para feed, 1:1 quadrado, 16:9 apresentação), crie com new_project, coloque as mídias com add_media, escreva os textos com add_text, aplique o kit de marca se houver (get_state lista os kits), confira com snapshot em 2 ou 3 instantes e corrija o que estiver ruim, depois export_video.
Os modelos têm um número de cartões (values.count na maioria); ajuste ao número de mídias para não sobrar cartão de exemplo, ou deixe repetir quando o modelo pede muitos cartões.
Coordenadas em pixels da composição (origem no canto superior esquerdo; get_state informa width e height). Tempos em segundos.
Use set_code_layer quando o pedido pedir algo que os modelos não fazem: partículas, shaders, gráficos animados, tipografia generativa. O código define draw({ ctx | gl, width, height, t, duration, progress, params, state }) e opcionalmente setup(...), roda isolado sem internet e deve depender só de t para sair igual na exportação.
Cada comando vira um passo de desfazer no editor. A pessoa pode estar vendo a janela; o trabalho também roda com o app em segundo plano.`;

const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: true });
const TOOLS = [
  { name: 'get_state', description: 'Projeto aberto: formato, tamanho, duração, modelo e valores, fundo, cartões de mídia, camadas (com id) e kits de marca.', inputSchema: obj({}) },
  { name: 'list_templates', description: 'Modelos de movimento disponíveis (id, nome, grupo, 2D ou 3D, estático). Com withControls, inclui os parâmetros que set_composition aceita em values.', inputSchema: obj({ group: { type: 'string', description: 'Filtra pelo grupo, ex.: Runway, Orbit, Spinner.' }, withControls: { type: 'boolean' } }) },
  { name: 'list_projects', description: 'Projetos salvos neste computador.', inputSchema: obj({}) },
  { name: 'open_project', description: 'Abre um projeto salvo.', inputSchema: obj({ id: { type: 'string' } }, ['id']) },
  { name: 'new_project', description: 'Cria e abre um projeto novo. Aceita os mesmos campos de set_composition.', inputSchema: obj({ name: { type: 'string' }, aspect: { type: 'string', enum: ['9:16', '4:5', '1:1', '3:4', '4:3', '16:9'] }, duration: { type: 'number' }, template: { type: 'string' }, values: { type: 'object' }, background: { type: 'object' } }) },
  { name: 'set_composition', description: 'Muda formato, duração (s), modelo de movimento, valores do modelo e fundo { color, color2, gradient }.', inputSchema: obj({ aspect: { type: 'string', enum: ['9:16', '4:5', '1:1', '3:4', '4:3', '16:9'] }, duration: { type: 'number' }, template: { type: 'string' }, values: { type: 'object' }, background: { type: 'object' } }) },
  { name: 'add_text', description: 'Adiciona um texto. Campos: text, x, y, size, font (Google Fonts ou do sistema), weight, color, align, boxWidth, lineHeight, letterSpacing, start, end, entrance e exit (none, fade, rise, drop, slideLeft, slideRight, zoomIn, zoomOut, pop, rotate, typewriter), backdrop, backdropColor, shadowColor.', inputSchema: obj({ text: { type: 'string' } }, ['text']) },
  { name: 'add_shape', description: 'Adiciona forma: kind (rect, ellipse, polygon, star, line) e shape { width, height, fill, fillOpacity, stroke, strokeWidth, radius, sides, points, innerRadius, cornerRadii }, mais x, y, start, end, entrance, exit.', inputSchema: obj({ kind: { type: 'string', enum: ['rect', 'ellipse', 'polygon', 'star', 'line'] }, shape: { type: 'object' } }, ['kind']) },
  { name: 'update_layer', description: 'Altera uma camada pelo id. patch aceita os campos de add_text; em formas, patch.shape; em código, patch.code { source, engine, width, height, params }.', inputSchema: obj({ id: { type: 'string' }, patch: { type: 'object' } }, ['id', 'patch']) },
  { name: 'remove_layer', description: 'Remove camadas pelo id.', inputSchema: obj({ id: { type: 'string' }, ids: { type: 'array', items: { type: 'string' } } }) },
  { name: 'add_media', description: 'Coloca fotos ou vídeos do computador. target "cards" (padrão) preenche os cartões do modelo na ordem; "layer" cria uma imagem solta; "shape" preenche a forma layerId. Caminhos absolutos.', inputSchema: obj({ paths: { type: 'array', items: { type: 'string' } }, target: { type: 'string', enum: ['cards', 'layer', 'shape'] }, layerId: { type: 'string' }, replace: { type: 'boolean', description: 'Em cards, substitui os existentes.' }, fit: { type: 'string', enum: ['fill', 'fit', 'stretch'] } }, ['paths']) },
  { name: 'set_code_layer', description: 'Cria (sem id) ou altera uma camada de código. source em JavaScript define draw({ ctx | gl, width, height, t, duration, progress, frame, fps, params, state }) e, se quiser, setup({ ctx | gl, width, height, params }) que devolve state. engine "2d" ou "webgl" (WebGL2). Sem internet nem armazenamento. Depois confira com snapshot e veja erros em get_state.', inputSchema: obj({ id: { type: 'string' }, name: { type: 'string' }, source: { type: 'string' }, engine: { type: 'string', enum: ['2d', 'webgl'] }, width: { type: 'number' }, height: { type: 'number' }, params: { type: 'object' }, x: { type: 'number' }, y: { type: 'number' }, start: { type: 'number' }, end: { type: 'number' } }) },
  { name: 'apply_brand_kit', description: 'Aplica um kit de marca salvo (fontes, cores e, se logo=true, o logo).', inputSchema: obj({ id: { type: 'string' }, name: { type: 'string' }, fonts: { type: 'boolean' }, colors: { type: 'boolean' }, logo: { type: 'boolean' } }) },
  { name: 'snapshot', description: 'Imagem PNG da composição no instante time (s). Use para conferir o resultado antes de exportar.', inputSchema: obj({ time: { type: 'number' }, maxEdge: { type: 'number' } }) },
  { name: 'export_video', description: 'Exporta para a pasta de exportação: format mp4, gif, both ou mov (com transparência); resolution 1080p, 2k ou 4k; extraAspects gera os mesmos vídeos em outros formatos. Devolve os caminhos dos arquivos.', inputSchema: obj({ format: { type: 'string', enum: ['mp4', 'gif', 'both', 'mov'] }, resolution: { type: 'string', enum: ['1080p', '2k', '4k'] }, extraAspects: { type: 'array', items: { type: 'string' } } }) },
  { name: 'undo', description: 'Desfaz o último passo.', inputSchema: obj({}) },
  { name: 'redo', description: 'Refaz o último passo desfeito.', inputSchema: obj({}) },
];
const TIMEOUT = { export_video: 60 * 60 * 1000, new_project: 60000, open_project: 60000, add_media: 5 * 60 * 1000, snapshot: 60000 };

async function readMedia(paths) {
  if (!Array.isArray(paths) || !paths.length) throw Error('Informe paths com caminhos absolutos de imagens ou vídeos.');
  if (paths.length > LIMIT.files) throw Error(`No máximo ${LIMIT.files} arquivos por vez.`);
  const files = [];
  for (const file of paths) {
    if (typeof file !== 'string' || !path.isAbsolute(file)) throw Error(`Caminho precisa ser absoluto: ${file}`);
    const kind = IMAGE.test(file) ? 'image' : VIDEO.test(file) ? 'video' : null;
    if (!kind) throw Error(`Formato não aceito: ${path.basename(file)}. Use imagem (png, jpg, webp…) ou vídeo (mp4, mov, webm).`);
    const stat = await fs.stat(file).catch(() => null);
    if (!stat?.isFile()) throw Error(`Arquivo não encontrado: ${file}`);
    if (stat.size > LIMIT[kind]) throw Error(`${path.basename(file)} passa do limite de ${LIMIT[kind] / 1048576} MB.`);
    files.push({ name: path.basename(file), mime: MIME[path.extname(file).slice(1).toLowerCase()], bytes: new Uint8Array(await fs.readFile(file)) });
  }
  return files;
}

function createMcpServer({ request, version, configPath, onActivity, port = PORT }) {
  let server = null, config = null, retryTimer = null, stopped = false;

  async function loadConfig() {
    try { config = JSON.parse(await fs.readFile(configPath, 'utf8')); } catch { config = null; }
    if (!config || typeof config.token !== 'string' || config.token.length < 32) config = { enabled: true, port: PORT, token: crypto.randomBytes(32).toString('hex') };
    config.port = port;
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    await fs.chmod(configPath, 0o600).catch(() => {});
    return config;
  }

  async function callTool(name, args) {
    if (!TOOLS.some((tool) => tool.name === name)) throw Error(`Ferramenta desconhecida: ${name}`);
    onActivity?.(name);
    const files = name === 'add_media' ? await readMedia(args.paths) : [];
    const value = await request('claude', TIMEOUT[name] ?? 120000, { command: name, args, files });
    if (name === 'snapshot' && typeof value?.image === 'string') {
      return { content: [{ type: 'image', mimeType: 'image/png', data: value.image.replace(/^data:image\/png;base64,/, '') }, { type: 'text', text: `t=${value.time}s · ${value.width}×${value.height}` }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(value ?? { ok: true }, null, 2) }] };
  }

  async function handle(message) {
    const { id, method, params } = message ?? {};
    const reply = (result) => ({ jsonrpc: '2.0', id, result });
    const error = (code, text) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message: text } });
    if (message?.jsonrpc !== '2.0' || typeof method !== 'string') return error(-32600, 'Invalid Request');
    if (id === undefined) return null; // notifications (initialized, cancelled) need no answer
    try {
      if (method === 'initialize') return reply({ protocolVersion: PROTOCOLS.includes(params?.protocolVersion) ? params.protocolVersion : PROTOCOLS[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'rp-motionstudio', title: 'RP MotionStudio', version }, instructions: INSTRUCTIONS });
      if (method === 'ping') return reply({});
      if (method === 'tools/list') return reply({ tools: TOOLS });
      if (method === 'tools/call') {
        try { return reply(await callTool(params?.name, params?.arguments ?? {})); }
        catch (failure) { return reply({ isError: true, content: [{ type: 'text', text: failure instanceof Error ? failure.message : String(failure) }] }); }
      }
      return error(-32601, `Método não suportado: ${method}`);
    } catch (failure) { return error(-32603, failure instanceof Error ? failure.message : String(failure)); }
  }

  async function onRequest(req, res) {
    const send = (status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); res.end(body === undefined ? '' : JSON.stringify(body)); };
    // Only this machine's own clients: no browser origins, the right host, the token.
    if (req.headers.origin) return send(403, { error: 'Origem não permitida.' });
    if (req.headers.host !== `127.0.0.1:${config.port}` && req.headers.host !== `localhost:${config.port}`) return send(403, { error: 'Host não permitido.' });
    const auth = String(req.headers.authorization ?? ''), expected = `Bearer ${config.token}`;
    if (auth.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) return send(401, { error: 'Token inválido.' });
    if (!config.enabled) return send(503, { error: 'O controle pelo Claude está desligado em RP MotionStudio → Configurações → Claude.' });
    if (req.url !== '/mcp') return send(404, { error: 'Use /mcp.' });
    if (req.method === 'GET') return send(405, undefined, { Allow: 'POST' });
    if (req.method === 'DELETE') return send(200, {});
    if (req.method !== 'POST') return send(405, undefined, { Allow: 'POST' });
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 2 * 1024 * 1024) return send(413, { error: 'Pedido grande demais.' }); chunks.push(chunk); }
    let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
    if (Array.isArray(body)) { const answers = (await Promise.all(body.map(handle))).filter(Boolean); return answers.length ? send(200, answers) : send(202); }
    const answer = await handle(body);
    return answer ? send(200, answer, body.method === 'initialize' ? { 'Mcp-Session-Id': crypto.randomUUID() } : {}) : send(202);
  }

  return {
    async start() {
      await loadConfig();
      // Another program (or an older copy of the app) may hold the port at
      // launch: keep trying quietly so the connector comes up once it is free.
      const listen = () => new Promise((resolve) => {
        const candidate = http.createServer((req, res) => { onRequest(req, res).catch((failure) => { try { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: String(failure?.message ?? failure) })); } catch {} }); });
        candidate.requestTimeout = 0; candidate.headersTimeout = 60000;
        candidate.once('error', () => resolve(false));
        candidate.listen(port, '127.0.0.1', () => { server = candidate; resolve(true); });
      });
      const retry = async () => { if (stopped || server) return; if (!await listen()) retryTimer = setTimeout(retry, RETRY_MS); };
      if (!await listen()) retryTimer = setTimeout(retry, RETRY_MS);
      return { listening: !!server?.listening, port };
    },
    stop() { stopped = true; clearTimeout(retryTimer); server?.close(); server = null; },
    status() { return { enabled: !!config?.enabled, listening: !!server?.listening, port, configPath }; },
    async setEnabled(enabled) { config.enabled = !!enabled; await fs.writeFile(configPath, JSON.stringify(config, null, 2), { mode: 0o600 }); return this.status(); },
  };
}

module.exports = { createMcpServer, TOOLS, PORT, readMedia };
