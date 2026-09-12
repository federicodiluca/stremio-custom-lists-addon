# Le mie liste — addon Stremio per liste personalizzate

Crea liste di film e serie ("preferiti", code da vedere, raccolte a tema) e
aggiungi titoli **con un click dalla pagina del contenuto in Stremio**, senza
passare da Trakt, MDBList o altri servizi esterni.

## Come funziona

Il protocollo Stremio espone solo risorse in **sola lettura** (`catalog`,
`meta`, `stream`, `subtitles`): non esiste un'API con cui un addon riceve
l'azione "aggiungi questo titolo alla mia lista". Per questo gli altri addon di
liste si limitano a *importare* elenchi creati altrove.

Ci sono quindi due modi per aggiungere un titolo.

**1. Ricerca nella web UI.** Un campo di ricerca su `/u/<token>/configure`
interroga Cinemeta e aggiunge con un click. Non dipende da nessuna quirk del
client ed è il modo più rapido per curare una lista in blocco.

**2. Pseudo-fonti nella lista delle sorgenti.** La risorsa `stream` espone una
voce per lista, con `externalUrl`: Stremio la apre nel browser, il server
registra l'operazione e mostra una conferma. Funziona da dentro Stremio, ma
sta in mezzo ai link di streaming veri.

Una terza strada — iniettare voci nell'array `links` del `meta`, che il client
rende accanto a Generi e Cast, fuori dalle fonti — **è stata scartata**:
richiede che l'addon faccia da proxy a Cinemeta e stia sopra di essa nella
collezione, cioè che si sostituisca al fornitore di metadati di tutti i film e
serie. Troppo invasivo per il beneficio.

Le liste tornano in Stremio come cataloghi di un `type` custom, `Liste`: hanno
quindi una **tab dedicata in Discover** e righe proprie nella **Home**. Il tipo
custom serve anche a tenere film e serie in un'unica riga, cosa impossibile con
i tipi nativi (un catalogo porta un solo `type`). Ogni item conserva il suo
tipo reale, perché la pagina di dettaglio smista sul tipo del *meta item* e non
su quello del catalogo: i titoli si aprono normalmente e gli addon di streaming
vengono interrogati come sempre.

**Non** compaiono nella tab *Library*: è nativa e mostra solo ciò che aggiungi
col pulsante di Stremio — nessun addon può scriverci. La gestione (creare,
rinominare, eliminare) sta nella web UI su `/u/<token>/configure`.

### Ordine delle righe in Home

L'ordine delle righe in Home segue l'**ordine degli addon** nella collezione
dell'account, e Stremio non lo espone nell'app. Si cambia con
[Stremio Addon Manager](https://stremioaddonmanager.org/), trascinando
*Le mie liste* in cima. Non lo automatizziamo: richiederebbe la AuthKey
dell'account, troppa frizione per un riordino che si fa una volta sola.

## Avvio in locale

```bash
npm install
npm start          # http://127.0.0.1:7000
```

Apri `http://127.0.0.1:7000`, premi **Crea il mio addon** e conserva l'URL del
manifest: il token che contiene è l'unica chiave delle tue liste e non è
recuperabile.

### Installazione in locale

Il link `stremio://` **non funziona su HTTP**: Stremio riscrive lo schema in
`https://` e l'installazione fallisce con *Failed to fetch*
([stremio-features#1525](https://github.com/Stremio/stremio-features/issues/1525)).
In locale si procede a mano:

1. Usa **Stremio desktop**, non la versione web: quella gira su HTTPS e il
   browser blocca le chiamate a un server locale in HTTP (mixed content).
2. In **Addons**, incolla l'URL nel campo **Add-on Repository URL** e premi
   Invio.
3. Nel popup premi **Install**.

L'indirizzo deve essere esattamente `127.0.0.1` — è l'unico host per cui
Stremio accetta HTTP. `localhost` non vale.

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

### Validazione del manifest

```bash
npm run lint
```

Passa il manifest al linter ufficiale (`stremio-addon-linter`). Non usiamo
invece `stremio-addon-sdk`: è fermo a ottobre 2022, vuole il manifest **statico
alla costruzione** (il nostro dipende dalle liste dell'utente) e non copre gli
endpoint di scrittura che ci servono. La documentazione ufficiale stessa mostra
Express a mano per gli addon con dati per-utente.

## Struttura

| File                    | Ruolo                                           |
| ----------------------- | ----------------------------------------------- |
| `src/server.js`         | Bootstrap Express                               |
| `src/addon.js`          | `manifest`, `catalog`, `meta`, `stream`         |
| `src/api.js`            | API REST per la web UI + endpoint di add/remove |
| `src/store.js`          | Persistenza su file JSON                        |
| `src/cinemeta.js`       | Metadati e ricerca da Cinemeta, con cache       |
| `public/configure.html` | UI: ricerca, gestione liste, riordino addon     |

I metadati arrivano da [Cinemeta](https://v3-cinemeta.strem.io) (gratuito,
nessuna API key). Gli id sono IMDb (`tt…`); per le serie viene salvato lo show,
non il singolo episodio.

## Limiti noti

- **Le liste non compaiono nella tab *Library*** e non sono gestibili da dentro
  l'app: il protocollo non lo permette. Hanno una tab propria in Discover e
  righe in Home; si gestiscono dalla web UI.
- **Niente icona custom per la tab.** I tipi noti al client sono 11 con icone
  hardcoded; un tipo sconosciuto ricade su `other` (icona dei film) e si ordina
  per ultimo nel selettore. Il manifest non ha un campo per fornirne una.
- **Niente tab nel menu principale** accanto a Home/Discover/Library: gli addon
  non possono aggiungere voci di navigazione
  ([stremio-features#815](https://github.com/Stremio/stremio-features/issues/815),
  aperta e mai raccolta).
- **Dopo aver creato o rinominato una lista serve reinstallare l'addon**
  incollando di nuovo l'URL: Stremio rilegge il manifest, e quindi l'elenco dei
  cataloghi, solo in quel momento. Aggiungere o togliere *titoli* non richiede
  nulla.
- Le pseudo-fonti compaiono **mescolate ai link di streaming reali**, e non
  c'è modo di metterle altrove senza sostituirsi al fornitore di metadati.
- Su alcune piattaforme `externalUrl` apre il browser di sistema: il
  comportamento va verificato su ogni client (desktop, Android, web, TV).
- Il tipo `Liste` è una stringa che fa da etichetta della tab: cambiarlo
  equivale a cambiare nome alla tab, e va tenuto URL-safe.
- L'endpoint di aggiunta è un `GET` con effetti collaterali (necessario:
  `externalUrl` viene aperto dal browser). La sicurezza sta tutta nel token.
- Lo store è un file JSON: ok per uso personale, da sostituire con SQLite o
  Postgres prima di aprirlo ad altri utenti.

## Verso la pubblicazione

Il modello dati è già multiutente: ogni utente ha un token, liste proprie e un
manifest costruito su misura, e niente nel codice presuppone un utente solo.
Quello che manca è la robustezza per esporlo a estranei:

- **Store.** Un unico file JSON riscritto per intero a ogni modifica. Con più
  utenti concorrenti è il primo collo di bottiglia: serve SQLite o Postgres.
- **Recupero accesso.** Il token è l'unica credenziale: chi lo perde perde le
  liste. Serve almeno un'email di recupero.
- **Abusi.** Nessun rate limit sulla creazione utenti né sulla ricerca (che
  gira su Cinemeta a nostro nome).
- **Cache metadati.** In memoria e senza tetto: cresce con i titoli visti e si
  azzera a ogni restart.

Per stare nel catalogo di [stremio-addons.net](https://stremio-addons.net)
(l'elenco community attuale; il vecchio repo GitHub è archiviato) servono:

- endpoint pubblico in **HTTPS**;
- `logo` nel manifest: PNG **256x256**, monocromatico;
- `contactEmail`, che alimenta il pulsante *Report* nell'app;
- submission con approvazione di un contributor (fino a 7 giorni).

## Licenza

MIT
