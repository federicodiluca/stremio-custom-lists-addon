import { lintManifest } from 'stremio-addon-linter';
import { buildManifest } from '../src/addon.js';

// The manifest is built per user, so lint a representative one: a user with a
// couple of lists exercises the catalog generation.
const manifest = buildManifest({
  token: 'a'.repeat(32),
  lists: [
    { id: 'l1', name: 'Da vedere', items: [] },
    { id: 'l2', name: 'Horror del venerdì', items: [] },
  ],
});

const { valid, errors = [], warnings = [] } = lintManifest(manifest);

for (const w of warnings) console.warn('warning:', w.message ?? w);
for (const e of errors) console.error('error:', e.message ?? e);

if (!valid) process.exit(1);
console.log(`manifest ok — ${manifest.catalogs.length} cataloghi, tipi: ${manifest.types.join(', ')}`);
