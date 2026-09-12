import { Router } from 'express';
import { getMeta, search } from './cinemeta.js';
import {
  addItem,
  addList,
  createUser,
  deleteList,
  findList,
  getUser,
  removeItem,
  renameList,
  reorderLists,
  setListFlags,
} from './store.js';

export const apiRouter = Router();

apiRouter.post('/api/users', async (req, res) => {
  const user = await createUser();
  res.json({ token: user.token });
});

apiRouter.use('/api/u/:token', (req, res, next) => {
  const user = getUser(req.params.token);
  if (!user) return res.status(404).json({ err: 'unknown user' });
  req.user = user;
  next();
});

apiRouter.get('/api/u/:token/lists', (req, res) => {
  res.json({ lists: req.user.lists });
});

apiRouter.get('/api/u/:token/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json({ results: [] });
  res.json({ results: await search(q) });
});

apiRouter.post('/api/u/:token/lists/:listId/items', async (req, res) => {
  const { id, type } = req.body ?? {};
  if (!/^tt\d+$/.test(id ?? '') || !['movie', 'series'].includes(type)) {
    return res.status(400).json({ err: 'id and type required' });
  }

  const meta = await getMeta(type, id);
  if (!meta) return res.status(502).json({ err: 'metadata not found' });

  const list = await addItem(req.user, req.params.listId, {
    id,
    type,
    name: meta.name,
    poster: meta.poster,
    releaseInfo: meta.releaseInfo ?? meta.year,
  });
  if (!list) return res.status(404).json({ err: 'unknown list' });
  res.json({ list });
});

apiRouter.post('/api/u/:token/lists', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ err: 'name required' });
  res.json({ list: await addList(req.user, name) });
});

apiRouter.patch('/api/u/:token/lists/:listId', async (req, res) => {
  const { name, showOnHome } = req.body ?? {};
  if (typeof name === 'string' && name.trim()) {
    if (!(await renameList(req.user, req.params.listId, name.trim()))) {
      return res.status(404).json({ err: 'unknown list' });
    }
  }
  if (typeof showOnHome === 'boolean') {
    await setListFlags(req.user, req.params.listId, { showOnHome });
  }
  res.json({ list: findList(req.user, req.params.listId) });
});

apiRouter.delete('/api/u/:token/lists/:listId', async (req, res) => {
  if (!(await deleteList(req.user, req.params.listId))) {
    return res.status(404).json({ err: 'unknown list' });
  }
  res.json({ ok: true });
});

apiRouter.post('/api/u/:token/lists/order', async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || !(await reorderLists(req.user, ids))) {
    return res.status(400).json({ err: 'ids must list every existing list once' });
  }
  res.json({ lists: req.user.lists });
});

apiRouter.delete('/api/u/:token/lists/:listId/items/:itemId', async (req, res) => {
  const list = await removeItem(req.user, req.params.listId, req.params.itemId);
  if (!list) return res.status(404).json({ err: 'unknown list' });
  res.json({ list });
});

// Hit from Stremio via the pseudo-stream's externalUrl, so it has to be a GET
// that a browser can open. The per-user token in the path is the only secret.
apiRouter.get('/u/:token/action/:action/:listId/:type/:id', async (req, res) => {
  const user = getUser(req.params.token);
  if (!user) return res.status(404).send(page('Utente sconosciuto', ''));

  const { action, listId, type, id } = req.params;
  const list = findList(user, listId);
  if (!list) return res.status(404).send(page('Lista sconosciuta', ''));

  if (action === 'remove') {
    await removeItem(user, listId, id);
    return res.send(page('Rimosso', `Rimosso da <b>${escapeHtml(list.name)}</b>.`));
  }

  if (action === 'add') {
    const meta = await getMeta(type, id);
    if (!meta) return res.status(502).send(page('Metadati non trovati', ''));
    await addItem(user, listId, {
      id,
      type,
      name: meta.name,
      poster: meta.poster,
      releaseInfo: meta.releaseInfo ?? meta.year,
    });
    return res.send(
      page(
        'Aggiunto',
        `<b>${escapeHtml(meta.name)}</b> aggiunto a <b>${escapeHtml(list.name)}</b>.`,
      ),
    );
  }

  res.status(400).send(page('Azione non valida', ''));
});

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

function page(title, body) {
  return `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1014;
       color:#e8e8ef;font:16px/1.5 system-ui,sans-serif;padding:24px;text-align:center}
  h1{font-size:1.3rem;margin:0 0 .4rem}
  p{margin:0;color:#a8a8b8}
</style>
<div><h1>${escapeHtml(title)}</h1><p>${body}</p></div>`;
}
