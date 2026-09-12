# Custom Lists — a Stremio addon for your own lists

> ## ⏸️ Paused — not actively developed
>
> This project works locally and is left here for anyone who wants to run it or
> fork it, but it is **not maintained** and there is no hosted instance.
>
> It was paused for a reason worth knowing before you invest time in it: the
> Stremio addon protocol is **read-only**, so an addon fundamentally cannot
> offer a comfortable "add this to my list" experience inside the app. Every
> route we tried either lands in the middle of the streaming sources or
> requires displacing Stremio's metadata provider for all movies and series.
> See [Why this is paused](#why-this-is-paused) for the full account — it may
> save you the same dead ends.

Create your own lists of movies and series (favourites, watch-later queues,
themed collections) and manage them yourself, instead of importing lists built
on Trakt, MDBList or Letterboxd.

## How it works

The Stremio protocol exposes four **read-only** resources — `catalog`, `meta`,
`stream`, `subtitles`. There is no API through which an addon can receive the
action "add this title to my list". That single fact explains why every other
list addon only *imports* lists curated elsewhere.

So there are two ways to add a title.

**1. Search in the web UI.** A search box at `/u/<token>/configure` queries
Cinemeta and adds with one click. It depends on no client quirks and is the
fastest way to curate a list in bulk.

**2. Pseudo-sources in the stream list.** The `stream` resource returns one
entry per list, carrying an `externalUrl`. Stremio opens it in the browser, the
server records the change and shows a confirmation. This works from inside
Stremio, but the entries sit among the real streaming links.

A third route was **deliberately rejected**: injecting entries into the meta
object's `links` array, which the client renders next to Genres and Cast,
outside the sources. It only works if the addon proxies Cinemeta and sits above
it in the user's collection — meaning it takes over as the metadata provider
for every movie and series. Too invasive for the benefit.

### Where the lists show up

Lists come back into Stremio as catalogs of a custom `type`, `Liste`, so they
get a **dedicated tab in Discover** and their own rows on the **Home** board.
The custom type also keeps movies and series in a single row, which native
types cannot do (a catalog carries exactly one `type`). Each item keeps its
real type, because the detail page routes on the *meta item's* type rather than
the catalog's — so titles open normally and the usual stream addons are
queried.

Lists do **not** appear in the *Library* tab. That tab is native and shows only
what you add with Stremio's own button; no addon can write to it. Creating,
renaming and deleting lists therefore lives in the web UI.

### Row order on the Home board

Home row order follows the **addon order** in the account's collection, and
Stremio does not expose it in the app. Change it with
[Stremio Addon Manager](https://stremioaddonmanager.org/) by dragging this
addon to the top. We deliberately don't automate it: doing so requires the
account's AuthKey, which is too much friction for a one-off reorder.

## Running it locally

```bash
npm install
npm start          # http://127.0.0.1:7000
```

Open `http://127.0.0.1:7000`, press **Crea il mio addon** and keep the manifest
URL: the token inside it is the only key to your lists and cannot be recovered.

### Installing into Stremio

The `stremio://` deep link **does not work over HTTP**: Stremio rewrites the
scheme to `https://` and installation fails with *Failed to fetch*
([stremio-features#1525](https://github.com/Stremio/stremio-features/issues/1525)).
That button was removed; install by hand instead:

1. Use **Stremio desktop**, not the web version — that one runs on HTTPS and
   the browser blocks calls to a local HTTP server (mixed content).
2. Under **Addons**, paste the URL into the **Add-on Repository URL** field and
   press Enter.
3. Press **Install** in the dialog.

The host must be exactly `127.0.0.1` — it is the only host for which Stremio
accepts HTTP. `localhost` will not do.

To install it on a device other than the machine running the server you need a
public HTTPS URL (ngrok or Cloudflare Tunnel for experiments; Railway, Render,
Fly.io or Docker for real use). Set `PUBLIC_URL` so the `externalUrl` values
point at the right host.

### Environment variables

| Name         | Default     | Purpose                            |
| ------------ | ----------- | ---------------------------------- |
| `PORT`       | `7000`      | Listening port                     |
| `DATA_DIR`   | `./data`    | Directory of the JSON store        |
| `PUBLIC_URL` | host header | Base URL used in `externalUrl`     |

### Validating the manifest

```bash
npm run lint
```

Runs the manifest through the official `stremio-addon-linter`. We do not use
`stremio-addon-sdk`: its last release was October 2022, it wants the
manifest **static at construction time** (ours depends on the user's lists,
which change), and it does not cover the write endpoints this addon needs. The
official documentation itself shows plain Express for addons with per-user
data.

## Layout

| File                    | Role                                          |
| ----------------------- | --------------------------------------------- |
| `src/server.js`         | Express bootstrap                             |
| `src/addon.js`          | `manifest`, `catalog`, `stream` resources     |
| `src/api.js`            | REST API for the web UI + add/remove endpoint |
| `src/store.js`          | JSON-file persistence                         |
| `src/cinemeta.js`       | Cinemeta metadata and search, with cache      |
| `public/index.html`     | Landing page: creates a user, shows the URL   |
| `public/configure.html` | Web UI: search, add, manage lists             |

Metadata comes from [Cinemeta](https://v3-cinemeta.strem.io) (free, no API
key). Ids are IMDb ids (`tt…`); for series the show is stored, not the
individual episode.

The UI strings are in Italian.

## Why this is paused

These are protocol limits, not implementation shortcuts. Anyone picking this up
will hit the same walls.

- **Lists cannot appear in, or be managed from, the *Library* tab.** The
  protocol has no write resource. Curation has to happen outside Stremio.
- **No custom icon for the Discover tab.** The client knows 11 content types
  with hardcoded icons; an unknown type falls back to `other` (the movies icon)
  and sorts last in every type selector. The manifest has no field to supply
  one. The manifest's `logo` is the icon *of the addon*, which is a different
  thing.
- **No tab in the main navigation** next to Home/Discover/Library: addons
  cannot add navigation entries
  ([stremio-features#815](https://github.com/Stremio/stremio-features/issues/815),
  open and never picked up).
- **Creating or renaming a list requires reinstalling the addon** by pasting
  the URL again — Stremio re-reads the manifest, and hence the catalog list,
  only at that moment. Adding or removing *titles* needs nothing.
- **Pseudo-sources sit among the real streaming links**, and there is no way to
  put them elsewhere without taking over the metadata provider.
- `externalUrl` opens the system browser on some platforms; the behaviour needs
  checking per client (desktop, Android, web, TV).
- The add endpoint is a `GET` with side effects — unavoidable, since
  `externalUrl` is opened by a browser. The token is the only thing protecting
  it.

## If you want to pick this up

The data model is already multi-user: every user has a token, their own lists
and a manifest built for them, and nothing in the code assumes a single user.
What is missing is the robustness to expose it to strangers:

- **Store.** A single JSON file rewritten in full on every change. With
  concurrent users this is the first bottleneck — move to SQLite or Postgres.
- **Account recovery.** The token is the only credential: lose it, lose the
  lists. It needs at least a recovery email.
- **Abuse.** No rate limiting on user creation or on search, which hits
  Cinemeta in our name.
- **Metadata cache.** In memory and unbounded: it grows with every title seen
  and resets on restart.

Listing on [stremio-addons.net](https://stremio-addons.net) — the current
community catalogue, the old GitHub list being archived — additionally
requires a public **HTTPS** endpoint, a `logo` in the manifest (PNG,
**256x256**, monochrome), a `contactEmail` (which powers the *Report* button in
the app), and a submission approved by a contributor, which can take up to
7 days.

## Licence

MIT
