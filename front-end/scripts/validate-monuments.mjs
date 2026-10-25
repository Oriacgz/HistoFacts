import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import validator from 'gltf-validator';

// Run through Vite's module loader so catalogue asset URLs use the same BASE_URL.
import { createServer } from 'vite';
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('../', import.meta.url)),
  cacheDir: 'node_modules/.vite-monument-validation',
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true }, appType: 'custom',
});
try {
  execFileSync(process.execPath, [fileURLToPath(new URL('./sync-monument-registry.mjs', import.meta.url)), '--check'], { stdio: 'inherit' });
  const { monuments } = await server.ssrLoadModule('/src/features/monuments/data/monuments.js');
  const registry = JSON.parse(await readFile(new URL('../src/features/monuments/data/registry.generated.json',import.meta.url),'utf8'));
  assert.equal(monuments.length,registry.length,'Every canonical monument needs frontend metadata and an asset');
  const ids = new Set();
  for (const m of monuments) {
    assert(!ids.has(m.id), `Duplicate ID: ${m.id}`); ids.add(m.id);
    assert(m.name && m.summary && m.disclaimer && m.attribution.license && m.attribution.creator && m.attribution.revision);
    assert(Number.isInteger(m.tour_revision) && m.tour_revision>0);
    const sourceIds = new Set(m.sources.map(s=>{assert(new URL(s.url).protocol === 'https:');return s.id;}));
    const hotspotIds = new Set();
    for(const h of m.hotspots){
      assert(!hotspotIds.has(h.id)); hotspotIds.add(h.id);
      assert(h.title && h.text && sourceIds.has(h.sourceId));
      for(const key of ['position','normal','target']){
        const parts=h[key].split(' ');assert(parts.length===3 && parts.every(n=>Number.isFinite(Number(n.replace(/m$/,'')))));
      }
    }
    assert(m.tour.length>=3 && new Set(m.tour).size===m.tour.length && m.tour.every(id=>hotspotIds.has(id)));
    for(const path of [m.model,m.poster,m.attribution.licenseUrl]){
      assert(path.startsWith('/models/monuments/') && !path.includes('..'));
      assert((await stat(new URL(`../public${path}`,import.meta.url))).isFile());
    }
    const bytes=await readFile(new URL(`../public${m.model}`,import.meta.url));
    assert(bytes.length<10*1024*1024, 'Model exceeds 10 MB budget');
    const report=await validator.validateBytes(new Uint8Array(bytes));
    assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));
    assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
    console.log(`${m.name}: valid GLB, ${Math.round(bytes.length/1024)} KB, ${m.hotspots.length} sourced hotspots`);
  }
  console.log(`Validated ${monuments.length} monuments.`);
} finally { await server.close(); }
