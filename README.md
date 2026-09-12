# Le mie liste — addon Stremio per liste personalizzate

Crea liste di film e serie ("preferiti", code da vedere, raccolte a tema) e
aggiungi titoli **con un click dalla pagina del contenuto in Stremio**, senza
passare da Trakt, MDBList o altri servizi esterni.

## Come funziona

Il protocollo Stremio espone solo risorse in **sola lettura** (`catalog`,
`meta`, `stream`, `subtitles`): non esiste un'API con cui un addon riceve
l'azione "aggiungi questo titolo alla mia lista". Per questo gli altri addon di
liste si limitano a *importare* elenchi creati altrove.

Qui l'aggiunta viaggia sulla risorsa `stream`: per ogni film o serie l'addon
inietta una pseudo-fonte per ciascuna lista.

```
➕ Aggiungi a "Da vedere"
✓ Rimuovi da "Horror del venerdì"
```

Sono voci con `externalUrl`: Stremio le apre nel browser, il server registra
l'operazione e mostra una conferma. Le liste tornano poi in Stremio come
cataloghi normali, nella Home e in Discover.

## Avvio in locale

```bash
npm install
npm start          # http://127.0.0.1:7000
```

Apri `http://127.0.0.1:7000`, premi **Crea il mio addon** e conserva il link
di installazione: il token nell'URL è l'unica chiave delle tue liste e non è
recuperabile.

Per installarlo su un dispositivo diverso dal PC che esegue il server serve un
URL pubblico raggiungibile in HTTPS (ngrok/Cloudflare Tunnel per le prove,
Railway/Render/Fly.io/Docker per l'uso vero). Imposta `PUBLIC_URL` in modo che
gli `externalUrl` puntino all'host giusto.

### Variabili d'ambiente

| Nome         | Default        | Uso                                          |
| ------------ | -------------- | -------------------------------------------- |
| `PORT`       | `7000`         | Porta di ascolto                             |
| `DATA_DIR`   | `./data`       | Cartella dello store JSON                    |
| `PUBLIC_URL` | header host    | Base URL usato negli `externalUrl`           |

## Struttura

| File                     | Ruolo                                              |
| ------------------------ | -------------------------------------------------- |
| `src/server.js`          | Bootstrap Express                                  |
| `src/addon.js`           | `manifest`, `catalog`, `stream` (protocollo Stremio)|
| `src/api.js`             | API REST per la web UI + endpoint di add/remove    |
| `src/store.js`           | Persistenza su file JSON                           |
| `src/cinemeta.js`        | Metadati da Cinemeta, con cache in memoria         |
| `public/configure.html`  | UI di gestione delle liste                         |

I metadati arrivano da [Cinemeta](https://v3-cinemeta.strem.io) (gratuito,
nessuna API key). Gli id sono IMDb (`tt…`); per le serie viene salvato lo show,
non il singolo episodio.

## Limiti noti

- **Dopo aver creato o rinominato una lista serve reinstallare l'addon**:
  Stremio rilegge il manifest, e quindi l'elenco dei cataloghi, solo
  all'installazione.
- Le voci `➕ Aggiungi a…` compaiono **mescolate alle fonti di streaming
  reali** nella pagina del contenuto. Da valutare sul campo quanto dia
  fastidio.
- Su alcune piattaforme `externalUrl` apre il browser di sistema: il
  comportamento va verificato su ogni client (desktop, Android, web, TV).
- Una lista con film **e** serie genera due righe distinte in Stremio, perché
  ogni catalogo ha un solo `type`. Un tipo custom permetterebbe una riga sola,
  al prezzo di una tab dedicata in Discover.
- L'endpoint di aggiunta è un `GET` con effetti collaterali (necessario:
  `externalUrl` viene aperto dal browser). La sicurezza sta tutta nel token.
- Lo store è un file JSON: ok per uso personale, da sostituire con SQLite o
  Postgres prima di aprirlo ad altri utenti.

## Licenza

MIT
