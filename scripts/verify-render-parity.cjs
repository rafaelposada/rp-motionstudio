// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Preview × export parity: renders the same frames at 1× and 2× density (the
// preview and export capture paths) in a real browser and compares them after
// downscaling. Catches density bugs such as a layer drawn at the wrong scale.
// Needs Google Chrome and runs the dev server: npm run test:render
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const PORT = 3123, URL = `http://127.0.0.1:${PORT}/?rp-test=1`, LIMIT = 6; // mean |Δ| per channel, 0–255

async function main() {
  const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '-p', String(PORT), '-H', '127.0.0.1'], { cwd: require('node:path').resolve(__dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => { const t = setTimeout(() => reject(Error('Servidor não iniciou.')), 90000); server.stdout.on('data', (d) => { if (/Ready|Local:/.test(String(d))) { clearTimeout(t); resolve(); } }); server.once('exit', () => reject(Error('Servidor encerrou.'))); });
    const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
    await page.goto(URL, { waitUntil: 'networkidle' });
    for (const name of ['Get started', 'Começar', 'Empezar']) { const b = page.getByRole('button', { name }); if (await b.count()) await b.first().click(); }
    await page.getByRole('button', { name: /editor/i }).first().click();
    await page.waitForFunction(() => window.__rpTest?.renderer, null, { timeout: 60000 });
    const scenarios = [
      { name: '2D · texto normal', template: 'carousel', blend: 'normal' },
      { name: '2D · texto Diferença', template: 'carousel', blend: 'difference' },
      { name: '2D · texto Luz suave', template: 'carousel', blend: 'soft-light' },
      { name: '3D · texto Multiplicação', template: 'orbit-3d-01', blend: 'multiply' },
      { name: '2D · texto com máscara e rotação 3D', template: 'carousel', blend: 'normal', mask: true, tilt: 35 },
    ];
    const failures = [];
    for (const scenario of scenarios) {
      const diff = await page.evaluate(async ({ template, blend, mask, tilt }) => {
        const { scene } = window.__rpTest;
        const s = scene.getState();
        s.setPlaying(false);
        if (s.activeTemplateId !== template) s.setActiveTemplate(template);
        await new Promise((r) => setTimeout(r, 2500));
        let layer = scene.getState().textLayers.find((l) => !l.media);
        if (!layer) { scene.getState().addTextLayer(); layer = scene.getState().textLayers.at(-1); }
        let maskId;
        if (mask) { scene.getState().addTextLayer(); const m = scene.getState().textLayers.at(-1); scene.getState().patchTextLayer(m.id, { text: 'mask', shape: { kind: 'ellipse', width: 420, height: 420, fill: '#ffffff' }, x: scene.getState().width / 2, y: scene.getState().height / 2, visible: true, start: 0, end: scene.getState().duration }); maskId = m.id; }
        scene.getState().patchTextLayer(layer.id, { text: 'Paridade 01', size: 120, color: '#ffffff', blend, maskId, tiltY: tilt ?? 0, x: scene.getState().width / 2, y: scene.getState().height / 2, visible: true, start: 0, end: scene.getState().duration });
        await new Promise((r) => setTimeout(r, 800));
        const renderer = window.__rpTest.renderer; // re-read: switching engines replaces it
        const grab = async (k) => {
          window.__rpTest.renderer.setCaptureScale(k);
          await new Promise((r) => setTimeout(r, 300));
          const url = window.__rpTest.renderer.captureFrame(20);
          const img = new Image(); img.src = url; await img.decode();
          const c = document.createElement('canvas'); c.width = 270; c.height = 360;
          const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
          return g.getImageData(0, 0, c.width, c.height).data;
        };
        const a = await grab(1), b = await grab(2);
        window.__rpTest.renderer.setCaptureScale(1);
        let sum = 0; for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
        return { mean: sum / (a.length / 4 * 3), renderer: Boolean(renderer) };
      }, scenario);
      const ok = diff.mean <= LIMIT;
      console.log(`${ok ? '✓' : '✗'} ${scenario.name}: diferença média ${diff.mean.toFixed(2)} (limite ${LIMIT})`);
      if (!ok) failures.push(scenario.name);
    }
    await browser.close();
    if (failures.length) throw Error(`Prévia e exportação divergem em: ${failures.join(', ')}`);
    console.log(`Render parity passed: ${scenarios.length} scenarios at 1× and 2×.`);
  } finally { server.kill(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
