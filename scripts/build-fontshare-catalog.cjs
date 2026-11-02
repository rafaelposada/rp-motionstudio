// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Refreshes public/fontshare-catalog.json from the public Fontshare API.
// Only family metadata is stored; font files are downloaded on first use.
const fs = require('node:fs/promises'), path = require('node:path');
const category = (value) => {
  const first = String(value || '').split(',')[0].trim();
  return first === 'Sans' ? 'Sans Serif' : first === 'Slab' ? 'Serif' : ['Handwritten', 'Script'].includes(first) ? 'Handwriting' : ['Serif', 'Display'].includes(first) ? first : 'Display';
};
async function main() {
  // Fonts are identified by family name; a name Google already serves keeps
  // loading from Google so existing projects never switch files.
  const google = new Set(JSON.parse(await fs.readFile(path.join(__dirname, '..', 'public', 'font-catalog.json'), 'utf8')).map((font) => font.family));
  const fonts = [];
  for (let page = 1; page < 20; page++) {
    const response = await fetch(`https://api.fontshare.com/v2/fonts?limit=100&page=${page}`, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error(`Fontshare respondeu ${response.status}.`);
    const data = await response.json();
    fonts.push(...data.fonts);
    if (!data.has_more) break;
  }
  const catalog = fonts.filter((font) => font.slug && font.name).map((font) => ({
    family: font.name, slug: font.slug, category: category(font.category), license: font.license_type,
    weights: [...new Set((font.styles || []).filter((style) => !style.is_italic).map((style) => Number(style.weight?.weight ?? style.weight)).filter((weight) => Number.isFinite(weight) && weight > 0))].sort((a, b) => a - b),
  })).filter((font) => font.weights.length && !google.has(font.family)).sort((a, b) => a.family.localeCompare(b.family));
  await fs.writeFile(path.join(__dirname, '..', 'public', 'fontshare-catalog.json'), JSON.stringify(catalog));
  console.log(`${catalog.length} famílias do Fontshare salvas.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
