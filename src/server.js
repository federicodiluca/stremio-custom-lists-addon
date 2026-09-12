import express from 'express';
import path from 'node:path';
import { addonRouter } from './addon.js';
import { apiRouter } from './api.js';
import { load } from './store.js';

const app = express();
app.use(express.json());
app.use(express.static(path.join(import.meta.dirname, '..', 'public')));

app.use(apiRouter);
app.use(addonRouter);

app.get('/u/:token/configure', (req, res) => {
  res.sendFile(path.join(import.meta.dirname, '..', 'public', 'configure.html'));
});

app.get('/configure', (req, res) => res.redirect('/'));

const PORT = process.env.PORT ?? 7000;

await load();
app.listen(PORT, () => {
  console.log(`Custom Lists addon in ascolto su http://127.0.0.1:${PORT}`);
});
