import { Router } from 'express';
import { getMeta, toCatalogEntry } from './cinemeta.js';
import { findList, getUser } from './store.js';

export const addonRouter = Router();

const CATALOG_PREFIX = 'ccl';

addonRouter.use('/u/:token', (req, res, next) => {
  const user = getUser(req.params.token);
  if (!user) return res.status(404).json({ err: 'unknown user' });
  req.user = user;
  next();
});

// Stremio calls these from clients on other origins.
addonRouter.use('/u/:token', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
});

function catalogId(listId, type) {
  return `${CATALOG_PREFIX}:${listId}:${type}`;
}

function parseCatalogId(id) {
  const [prefix, listId, type] = id.split(':');
  if (prefix !== CATALOG_PREFIX) return null;
  return { listId, type };
}

function buildManifest(user) {
  const catalogs = [];
  for (const list of user.lists) {
    // A Stremio catalog carries a single type, so a mixed list surfaces as one
    // row per type it actually holds.
    const types = new Set(list.items.map((i) => i.type));
    if (types.size === 0) types.add('movie');
    for (const type of types) {
      catalogs.push({
        id: catalogId(list.id, type),
        type,
        name: list.name,
        extra: [{ name: 'skip', isRequired: false }],
      });
    }
  }

  return {
    id: `com.federicodiluca.customlists.${user.token.slice(0, 8)}`,
    version: '0.1.0',
    name: 'Le mie liste',
    description:
      'Liste personalizzate di film e serie. Aggiungi titoli con un click dalla pagina del contenuto.',
    resources: [
      'catalog',
      { name: 'stream', types: ['movie', 'series'], idPrefixes: ['tt'] },
    ],
    types: ['movie', 'series'],
    catalogs,
    idPrefixes: ['tt'],
    behaviorHints: { configurable: true, configurationRequired: false },
  };
}

addonRouter.get('/u/:token/manifest.json', (req, res) => {
  res.json(buildManifest(req.user));
});

// Stremio requests /catalog/:type/:id.json or /catalog/:type/:id/:extra.json,
// and our catalog ids contain dots-free colons, so parse the tail by hand.
addonRouter.get('/u/:token/catalog/:type/*', async (req, res) => {
  const tail = req.params[0].replace(/\.json$/, '');
  const [rawId, rawExtra = ''] = tail.split('/');

  const parsed = parseCatalogId(rawId);
  if (!parsed) return res.status(404).json({ err: 'unknown catalog' });

  const list = findList(req.user, parsed.listId);
  if (!list) return res.status(404).json({ err: 'unknown list' });

  const skip = Number(new URLSearchParams(rawExtra).get('skip')) || 0;
  const ids = list.items
    .filter((i) => i.type === req.params.type)
    .slice(skip, skip + 100);

  const metas = await Promise.all(
    ids.map(async (item) => {
      const meta = await getMeta(item.type, item.id);
      return meta ? toCatalogEntry(meta) : null;
    }),
  );

  res.json({ metas: metas.filter(Boolean) });
});

// The protocol has no write resource, so "add to list" rides on the stream
// resource: each list shows up as a pseudo-stream whose externalUrl hits our API.
addonRouter.get('/u/:token/stream/:type/*', (req, res) => {
  const { type } = req.params;
  // Series ids arrive as tt1234567:1:5 — the list tracks the show itself.
  const id = req.params[0].replace(/\.json$/, '').split(':')[0];
  const base = baseUrlOf(req);

  const streams = req.user.lists.map((list) => {
    const present = list.items.some((i) => i.id === id);
    const action = present ? 'remove' : 'add';
    return {
      name: 'Le mie liste',
      title: present ? `✓ Rimuovi da "${list.name}"` : `➕ Aggiungi a "${list.name}"`,
      externalUrl: `${base}/u/${req.user.token}/action/${action}/${list.id}/${type}/${id}`,
      behaviorHints: { notWebReady: true },
    };
  });

  res.set('Cache-Control', 'no-store');
  res.json({ streams, cacheMaxAge: 0 });
});

function baseUrlOf(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = req.get('x-forwarded-proto') ?? req.protocol;
  return `${proto}://${req.get('host')}`;
}

export { baseUrlOf };
