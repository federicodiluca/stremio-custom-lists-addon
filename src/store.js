import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'users.json');

let db = { users: {} };
let writeQueue = Promise.resolve();

export async function load() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    db = JSON.parse(await readFile(DB_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

// Serialized so concurrent requests can't interleave read-modify-write on the file.
function persist() {
  writeQueue = writeQueue.then(async () => {
    const tmp = `${DB_FILE}.tmp`;
    await writeFile(tmp, JSON.stringify(db, null, 2));
    await rename(tmp, DB_FILE);
  });
  return writeQueue;
}

function newId() {
  return randomBytes(16).toString('hex');
}

export async function createUser() {
  const token = newId();
  db.users[token] = {
    token,
    createdAt: new Date().toISOString(),
    lists: [emptyList('Da vedere')],
  };
  await persist();
  return db.users[token];
}

export function getUser(token) {
  return db.users[token] ?? null;
}

function emptyList(name) {
  return {
    id: newId(),
    name,
    showOnHome: true,
    items: [],
  };
}

export async function addList(user, name) {
  const list = emptyList(name);
  user.lists.push(list);
  await persist();
  return list;
}

export async function renameList(user, listId, name) {
  const list = findList(user, listId);
  if (!list) return null;
  list.name = name;
  await persist();
  return list;
}

export async function deleteList(user, listId) {
  const before = user.lists.length;
  user.lists = user.lists.filter((l) => l.id !== listId);
  if (user.lists.length === before) return false;
  await persist();
  return true;
}

export async function reorderLists(user, listIds) {
  const byId = new Map(user.lists.map((l) => [l.id, l]));
  const ordered = listIds.map((id) => byId.get(id)).filter(Boolean);
  if (ordered.length !== user.lists.length) return false;
  user.lists = ordered;
  await persist();
  return true;
}

export function findList(user, listId) {
  return user.lists.find((l) => l.id === listId) ?? null;
}

/** item: { id, type, name, poster, releaseInfo } — id is an IMDb id like tt0133093 */
export async function addItem(user, listId, item) {
  const list = findList(user, listId);
  if (!list) return null;
  if (list.items.some((i) => i.id === item.id)) return list;
  list.items.unshift({ ...item, addedAt: new Date().toISOString() });
  await persist();
  return list;
}

export async function removeItem(user, listId, itemId) {
  const list = findList(user, listId);
  if (!list) return null;
  list.items = list.items.filter((i) => i.id !== itemId);
  await persist();
  return list;
}

export async function setListFlags(user, listId, flags) {
  const list = findList(user, listId);
  if (!list) return null;
  if (typeof flags.showOnHome === 'boolean') list.showOnHome = flags.showOnHome;
  await persist();
  return list;
}
