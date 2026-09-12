import { Router } from 'express';
import { getMeta, toCatalogEntry } from './cinemeta.js';
import { findList, getUser } from './store.js';

export const addonRouter = Router();

const CATALOG_PREFIX = 'ccl';

// A custom type gets its own tab in Discover and lets one list hold movies and
// series in a single row. Stremio has no way to supply an icon for it: unknown
// types fall back to the built-in `other` entry. The string is the tab label,
// so keep it short and URL-safe.
const LIST_TYPE = 'Liste';

// Stremio refuses addons that don't send CORS headers, and it calls us from
// its own origin — so this has to come before the user lookup replies 404.
addonRouter.use('/u/:token', (req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

addonRouter.use('/u/:token', (req, res, next) => {
  const user = getUser(req.params.token);
  if (!user) return res.status(404).json({ err: 'unknown user' });
  req.user = user;
  next();
});

function catalogId(listId) {
  return `${CATALOG_PREFIX}:${listId}`;
}

function parseCatalogId(id) {
  const [prefix, listId] = id.split(':');
  if (prefix !== CATALOG_PREFIX) return null;
  return { listId };
}

export function buildManifest(user) {
  const catalogs = user.lists.map((list) => ({
    id: catalogId(list.id),
    type: LIST_TYPE,
    name: list.name,
    extra: [{ name: 'skip', isRequired: false }],
  }));

  return {
    id: `com.federicodiluca.customlists.${user.token.slice(0, 8)}`,
    version: '0.1.0',
    name: 'Le mie liste',
    description:
      'Liste personalizzate di film e serie. Aggiungi titoli con un click dalla pagina del contenuto.',
    resources: [
      { name: 'catalog', types: [LIST_TYPE] },
      { name: 'stream', types: ['movie', 'series'], idPrefixes: ['tt'] },
    ],
    types: [LIST_TYPE, 'movie', 'series'],
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
  const page = list.items.slice(skip, skip + 100);

  // Each entry keeps its real type (movie/series) even though the catalog is
  // typed `Liste`: the detail page routes on the item's own type, so titles
  // open normally and the usual stream addons are queried.
  const metas = await Promise.all(
    page.map(async (item) => {
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
      // `title` is deprecated and newer clients ignore it, so the label has to
      // be in `description` — without it the row renders blank.
      description: present
        ? `✓ Rimuovi da "${list.name}"`
        : `➕ Aggiungi a "${list.name}"`,
      externalUrl: `${base}/u/${req.user.token}/action/${action}/${list.id}/${type}/${id}`,
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
