# Infinite Alibi

Prototipo giocabile di un gioco di deduzione sociale da circa 3 minuti. Il **Colpevole** manipola i
filmati di sorveglianza di una villa (taglia e cuci, deepfake, glitch). Gli **investigatori** cercano
i micro-indizi che ogni trucco lascia: timestamp incoerenti, continuità spaziale, ombre e oggetti.

Il design e i numeri di bilanciamento sono in [DESIGN.md](DESIGN.md). La [pagina dei giochi](../index.html) riunisce questo prototipo e Tactical Heist.

## Avvio

Per giocare in locale (Party, Detective, Colpevole, Streamer) non servono dipendenze né build: apri
`index.html` nel browser (va bene anche il doppio clic), oppure servilo in locale:

```bash
cd games/infinite-alibi
python3 -m http.server 8000   # poi apri http://localhost:8000
```

Per giocare **online** serve il server Node (≥ 18):

```bash
cd games/infinite-alibi
npm install
npm start                     # sito su http://localhost:8080, WebSocket su /ws (PORT=… per cambiarla)
```

Ognuno apre l'indirizzo del server, sceglie **🌐 Online**, e uno crea la stanza e condivide il codice.

## Modalità

* **🎉 Party**: da 3 a 6 giocatori sullo stesso schermo. Ruoli segreti passando il dispositivo, montaggio
  di nascosto, discussione a voce con il laser, voto segreto, classifica fra un caso e l'altro.
* **🕵️ Detective**: un Colpevole IA ha già truccato i filmati. Metti le puntine, presentale alla giuria
  di bot e accusa.
* **🎬 Colpevole**: sei tu il ladro. Monta il video ascoltando i consigli dei tuoi complici, poi
  difenditi da 4 investigatori bot.
* **🌐 Online**: da 3 a 6 giocatori, ognuno sul suo dispositivo, con un server autoritativo che custodisce
  il caso e il montaggio (vedi DESIGN.md §5).
* **📺 Streamer** (si combina con le altre): la chat di Twitch vota con `!vota G` e manda glitch finti con
  `!glitch`. C'è anche una chat simulata per provare.

Opzioni nel menu: **difficoltà** (Facile / Normale / Esperto), **aiuti per principianti** (filtro di
movimento + 2 lenti automatiche), timer. In caso di pareggio al voto ci sono 20 s di **tempi supplementari**
con le arringhe dei sospettati e poi un **ballottaggio**. A fine partita, **📱 Clip verticale 9:16**
genera in automatico un video da condividere.

Il campo "Caso n°" rigenera esattamente lo stesso caso, utile per sfidare gli amici sullo stesso filmato.

## Comandi

| Azione | Comando |
|---|---|
| Play/Pausa | `Spazio` |
| Fotogramma per fotogramma | `←` `→` |
| Puntina (raccolta prove) | clic su una telecamera |
| Ingrandisci una telecamera | doppio clic (`Esc` per tornare) |
| Laser (processo) | trascina sul video; `1`–`6` cambia giocatore in Party |

## Struttura

```
index.html, style.css
js/world.js     villa, personaggi, generazione deterministica del filmato reale
js/footage.js   manipolazioni, analisi dei micro-indizi, giuria di bot, Colpevole IA
js/render.js    rendering CCTV su canvas, laser, lenti, Replay Reale, animazione di espulsione
js/clip.js      generatore di clip verticali 9:16
js/stream.js    lettura della chat di Twitch e comandi (!vota, !glitch, !indizio)
js/app.js       fasi di gioco e interfaccia (locale e client online)
server/server.js  server online autoritativo (Node.js + ws), serve anche i file statici
tests/sim.test.js     test della simulazione
tests/server.test.js  partita online completa con 3 client simulati
```

## Test

```bash
cd games/infinite-alibi
node tests/sim.test.js        # nessuna dipendenza
npm install && npm test       # anche il test del server online
```

I test della simulazione verificano il determinismo e che il filmato reale non produca falsi indizi.
Controllano anche che ogni manipolazione lasci almeno un micro-indizio, che il deepfake tradisca solo il
dettaglio scelto e sfarfalli, che il taglio mostri il timestamp della sorgente e lo scatto alla giunzione,
il pareggio e il ballottaggio, che il filmato precotto non contenga dati segreti, i complici, gli aiuti
e che il Colpevole IA batta il "nessun trucco".

Il test del server gioca una partita intera con 3 client WebSocket. Verifica:
* ruoli privati e modifiche validate;
* nessun segreto nel filmato;
* lente, laser e chat;
* pareggio → supplementari → ballottaggio;
* rivelazione solo al verdetto e rivincita.
