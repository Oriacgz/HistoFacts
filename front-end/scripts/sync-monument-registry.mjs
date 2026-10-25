import { readFile, writeFile } from 'node:fs/promises';

const canonical = new URL('../../backend/app/history/monuments/catalogue.json', import.meta.url);
const target = new URL('../src/features/monuments/data/registry.generated.json', import.meta.url);
const data = JSON.parse(await readFile(canonical, 'utf8'));
const text = `${JSON.stringify(data,null,2)}\n`;
if (process.argv.includes('--check')) {
  if (await readFile(target,'utf8') !== text) throw new Error('Monument registry drift: run npm run models:sync after editing the canonical backend catalogue.');
  console.log('Monument registry matches the canonical History catalogue.');
} else {
  await writeFile(target,text);
  console.log('Generated frontend registry from the canonical History catalogue.');
}
