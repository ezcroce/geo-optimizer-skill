# Arena Royale 3D 🎮

Un battle royale 3D in terza persona che gira nel browser, scritto in JavaScript con [Three.js](https://threejs.org/) (incluso in `vendor/`, nessuna dipendenza da installare e nessun passaggio di build).

## Avvio

Serve un server statico qualsiasi (i moduli ES non funzionano da `file://`):

```bash
cd games/battle-royale
python3 -m http.server 8080
# poi apri http://localhost:8080  (sito)  oppure  http://localhost:8080/gioco.html  (gioco)
```

## Il sito

`index.html` è la landing page del gioco, con animazioni fluide:

- **Armadietto 3D interattivo** nell'intestazione: i modelli veri delle skin ruotano su un piedistallo luminoso e cambiano da soli con una transizione animata (si possono anche trascinare o scegliere con le frecce).
- Titolo animato lettera per lettera, sfondo con griglia in movimento, contatori, card con inclinazione 3D al passaggio del mouse, elementi che compaiono allo scroll e un ticker con un finto feed delle eliminazioni.
- **Demo animata del movimento**: il personaggio cammina, si abbassa, si arrampica su un muro, scavalca il bordo e salta giù, con didascalie e tasti sincronizzati.
- Schede delle armi (miniature 3D e statistiche animate), galleria delle skin (cliccando una skin la si equipaggia anche nel gioco), "come si gioca" e comandi.
- Transizione a cerchio quando si passa dal sito al gioco e viceversa.

## Cosa c'è

- **Armadietto con 10 skin** di varie rarità (Recluta, Zombie, Agente Segreto, Ninja, Pirata, Cyber Neon, Astronauta, Agente Banana, Cavaliere d'Oro, Drago Rosso), più 4 deltaplani.
- **6 armi** con 5 livelli di rarità (Comune → Leggendario, il danno cresce con la rarità): pistola, mitraglietta, fucile d'assalto, fucile a pompa, cecchino con mirino e lanciarazzi con danno ad area. Colpi alla testa ×2.
- **Consumabili**: bende, medikit, mini scudo e pozione scudo.
- **Battle Bus** volante → caduta libera → deltaplano.
- **Isola** con 8 località (Centro Caos, Piazza Pulita, Torri Tremanti, Borgo Bottino, Villa Vertigine, Porto Pigro, Fattoria Felice, Deposito Dannato): case con porte e finestre, forzieri, container, torri, lago, alberi e rocce.
- **Tempesta** che si restringe in 6 fasi, con danni crescenti.
- **Fino a 29 bot** con IA: raccolgono bottino, aprono forzieri, si curano, scappano dalla tempesta, si combattono anche fra loro e distruggono i tuoi muri.
- **Abbassarsi**: con `C` ci si accovaccia; la hitbox è più piccola, la dispersione più bassa e la telecamera scende. Anche i bot si abbassano quando sparano da fermi.
- **Arrampicarsi**: con `W` + `Spazio` contro un muro, una cassa, un container o una casa ci si aggrappa e si sale; in cima il personaggio scavalca il bordo da solo, con un'animazione fluida. Si consuma **stamina**, visibile in una barra gialla. `S` serve a scendere e `Spazio` a staccarsi con un salto. Il personaggio può anche infilarsi nelle finestre. I bot scavalcano gli ostacoli bassi.
- **Animazioni**: affondo e polvere quando si atterra da un salto alto, cambio arma animato, e passaggio morbido fra posizione in piedi e accovacciata.
- **Costruzione**: muri di legno (10 materiali), che si ottengono colpendo alberi e rocce col piccone.
- HUD completo: minimappa e mappa grande, kill feed, numeri dei danni, hitmarker, barre salute/scudo, munizioni.
- Suoni sintetizzati con la Web Audio API (nessun file audio).

## Comandi

| Tasto | Azione |
|---|---|
| W A S D | Movimento |
| Shift | Corsa |
| C | Abbassati / alzati (Spazio o Shift per rialzarti) |
| W + Spazio (contro un muro) | Arrampicati · poi W sali, S scendi, Spazio salta via |
| Spazio | Salta / lanciati dal bus / apri il deltaplano |
| Mouse | Mira |
| Click sinistro | Spara / usa consumabile / piccone |
| Click destro | Mira di precisione (mirino col cecchino) |
| 1–5, rotella | Cambia slot |
| R | Ricarica |
| E | Raccogli / apri forziere |
| Q | Modalità costruzione |
| G | Lascia l'oggetto in mano |
| M | Mappa |
| F | Schermo intero (si attiva anche da solo premendo GIOCA, disattivabile nel menu) |
| Esc | Pausa |

## Struttura

```
index.html      sito del gioco (landing page)
site.css        stile e animazioni del sito
gioco.html      il gioco (menu, HUD, schermate)
style.css       stile dell'interfaccia di gioco
js/config.js    armi, rarità, skin, consumabili, tempesta, difficoltà
js/world.js     terreno, città, collisioni, raycast
js/character.js modelli 3D di personaggi, armi, deltaplano e bus
js/audio.js     effetti sonori sintetizzati
js/main.js      ciclo di gioco, giocatore, arrampicata, IA dei bot, combattimento, HUD
js/site.js      scene 3D e animazioni del sito
js/transition.js transizione animata fra sito e gioco
vendor/         Three.js r187 (licenza MIT)
```
