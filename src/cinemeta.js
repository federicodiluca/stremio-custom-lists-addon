const BASE = 'https://v3-cinemeta.strem.io';
const TTL_MS = 24 * 60 * 60 * 1000;

const cache = new Map();

export async function getMeta(type, id) {
  const key = `${type}:${id}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.meta;

  const res = await fetch(`${BASE}/meta/${type}/${id}.json`);
  if (!res.ok) return null;
  const { meta } = await res.json();
  if (!meta) return null;

  cache.set(key, { at: Date.now(), meta });
  return meta;
}

/** Searches both types at once; results keep their real `type`. */
export async function search(query) {
  const perType = await Promise.all(
    ['movie', 'series'].map(async (type) => {
      const url = `${BASE}/catalog/${type}/top/search=${encodeURIComponent(query)}.json`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const { metas = [] } = await res.json();
      return metas.map((m) => ({
        id: m.id,
        type,
        name: m.name,
        poster: m.poster,
        releaseInfo: m.releaseInfo,
      }));
    }),
  );

  return perType.flat().sort((a, b) => (b.releaseInfo ?? '').localeCompare(a.releaseInfo ?? ''));
}

/** Trims a Cinemeta meta down to what a catalog row needs. */
export function toCatalogEntry(meta) {
  return {
    id: meta.id,
    type: meta.type,
    name: meta.name,
    poster: meta.poster,
    posterShape: meta.posterShape ?? 'poster',
    background: meta.background,
    description: meta.description,
    releaseInfo: meta.releaseInfo ?? meta.year,
    imdbRating: meta.imdbRating,
    genres: meta.genres,
  };
}
