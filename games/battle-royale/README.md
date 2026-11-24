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

### Novità: grafica migliorata e impostazioni complete

- **Texture in alta risoluzione con rilievo**: muri, tetti, mattoni, casse, rocce, tessuti e terreno hanno ora una *normal map* generata dal rilievo (fughe, tegole, venature, intrecci) e sono disegnate al doppio della risoluzione; il terreno ha un micro-rilievo che reagisce al sole.
- **Post-processing**: bagliore (bloom) su sole, spari ed esplosioni, occlusione ambientale (GTAO), anti-aliasing FXAA / SMAA / MSAA 4×, rendering HDR.
- **Ombre morbide** (fino a 4096 px) e **riflessi ambientali** del cielo su metalli e vetri.
- **Pannello Impostazioni** (⚙ nel menu o *Impostazioni* nella pausa), con quattro schede:
  - *Grafica*: preset Bassa / Media / Alta / Ultra, risoluzione di rendering (50–200%), ombre, qualità texture, filtro anisotropico, anti-aliasing, bloom, occlusione ambientale, distanza visiva, densità erba, limite FPS;
  - *Controlli*: sensibilità del mouse e in mira, inversione asse Y, campo visivo (FOV), abbassarsi premendo o tenendo premuto C, scossa della telecamera;
  - *Audio*: volume generale e suoni d'ambiente;
  - *Interfaccia*: colore e dimensione del mirino, dimensione della minimappa, contatore FPS.

### Novità: online, pass battaglia, negozio, missioni, modalità

- **Modalità**: *Battle Royale* (l'isola classica con 18 località) e *Random Map* (a ogni partita un'isola nuova con città, nomi, montagne, laghi ed erba alta generati a caso).
- **Online con gli amici**: dal menu *Crea una lobby* ti dà un codice di 5 lettere (o un link da copiare, `gioco.html?lobby=CODICE`); gli amici lo inseriscono in *Entra*. Ci sono la chat, i compagni visibili nella lobby 3D e fino a 8 giocatori, mentre gli altri posti fino a 100 li riempiono i bot. Il collegamento è peer-to-peer (WebRTC con PeerJS): non serve un server di gioco e chi crea la lobby fa da host, cioè simula bot, tempesta e salute. Chi esce a metà partita diventa un bot. Per provarlo da soli con due schede: `gioco.html?net=local`.
- **Pass battaglia** con 40 livelli, una fila gratuita e una premium (950 monete), con skin, cappelli, zaini, deltaplani e monete. Gli XP si guadagnano giocando (sopravvivenza, eliminazioni, forzieri, danni, piazzamento) e con le missioni.
- **Negozio** a rotazione giornaliera, con 2 offerte in evidenza (una scontata) e 4 giornaliere, e **monete** guadagnate a ogni partita.
- **Missioni**: 3 giornaliere e 3 settimanali (eliminazioni, forzieri, erba alta, arrampicata, colpi alla testa, partite in Random Map o online…), con notifiche durante la partita.
- **Armadietto** con 21 skin, 11 cappelli, 8 zaini e 7 deltaplani: quelli bloccati si possono provare in anteprima e mostrano come sbloccarli.
- **Erba alta**: macchie d'erba di circa 1,4 m nei prati. Se ti accovacci (C) dentro, sei *nascosto*: i bot ti vedono solo entro 10 m, o 25 m se hai appena sparato.
- **Personaggi più realistici**: corpo arrotondato con articolazioni (gomiti, ginocchia, mani, piedi). Le animazioni sono nuove: camminata e corsa con le ginocchia, passo laterale, respiro, atterraggio, accovacciamento con il busto in avanti, arrampicata mano sopra mano e scavalcamento del bordo.
- I progressi si salvano nel browser (localStorage).

- **100 giocatori per partita** (99 bot; dal menu si può scegliere anche 25 o 50 per i PC più lenti). I bot fra loro si fanno meno danni, così la partita non si svuota nei primi minuti. I personaggi lontani usano un modello semplificato e quelli oltre la nebbia non vengono disegnati.
- **Armadietto con 13 skin** di varie rarità (Recluta, Esploratrice, Zombie, Agente Segreto, Ninja, Soldato Tattico, Pirata, Meccanico, Cyber Neon, Astronauta, Agente Banana, Cavaliere d'Oro, Drago Rosso), più 4 deltaplani. Le tre nuove (Soldato Tattico con elmetto e giubbotto, Esploratrice con coda di cavallo, sciarpa e zaino, Meccanico con salopette, barba e cintura degli attrezzi) riprendono i tre personaggi del pacchetto di asset.
- **6 armi con texture procedurali** (metallo spazzolato, polimero zigrinato, legno di noce venato, pannello della rarità con motivo diverso per livello: righe, chevron, esagoni, oro inciso) e dettagli come mirini, red dot, ottica con lenti, bipiede, freno di bocca e cartucce sul fianco. 5 livelli di rarità (Comune → Leggendario, il danno cresce con la rarità): pistola, mitraglietta, fucile d'assalto, fucile a pompa, cecchino con mirino e lanciarazzi con danno ad area. Colpi alla testa ×2.
- **Balistica realistica**: i proiettili non arrivano più all'istante. Hanno una velocità propria e subiscono la gravità, quindi da lontano devi mirare un po' più in alto e anticipare chi si muove. I bot fanno lo stesso, con una precisione che dipende dalla difficoltà.

  | Arma | Velocità | Tempo per 100 m | Caduta a 100 m |
  |---|---|---|---|
  | Pistola | 260 m/s | 0,38 s | 0,83 m |
  | Mitraglietta | 280 m/s | 0,36 s | 0,75 m |
  | Fucile d'assalto | 380 m/s | 0,26 s | 0,34 m |
  | Fucile a pompa | 230 m/s | 0,43 s | — (portata circa 60 m) |
  | Cecchino | 520 m/s | 0,19 s | 0,18 m |
  | Lanciarazzi | 55 m/s | 1,8 s | traiettoria ad arco |

  Ogni proiettile lascia una scia luminosa, e quella del cecchino resta come fumo per un attimo. Quando un colpo ti passa vicino senti un sibilo; se finisce in acqua solleva uno spruzzo. Mentre miri col tasto destro, un **telemetro** sotto il mirino mostra distanza, tempo di volo e di quanto scenderà il colpo.
- **Consumabili**: bende, medikit, mini scudo e pozione scudo.
- **Battle Bus** volante → caduta libera → deltaplano.
- **Isola grande 1,2 × 1,2 km** (3 volte la mappa originale) con **18 località** (fra cui Centro Caos, Piazza Pulita, Torri Tremanti, Borgo Bottino, Villa Vertigine, Porto Pigro, Fattoria Felice e Deposito Dannato), montagne, 3 laghi, strade, case con porte e finestre, forzieri, container, torri, alberi e rocce.
- **Grafica low-poly semi-realistica** (dal pacchetto di asset, ricreata nel codice in `js/props.js`): abeti a strati, querce e betulle; rocce irregolari con muschio; cataste di legna; pile di mattoni su pallet; barili di legno, blu e rossi; circa 50 casette di legno con tetto a falde, comignolo e fioriera. Le case delle città hanno tetti a tegole, comignoli in mattoni, zoccolo in pietra, cornici, davanzali, persiane e zerbini. Se nella cartella `models/` metti i file `.glb` originali, il gioco usa quelli (vedi `models/LEGGIMI.md`).
- **Barili esplosivi**: i barili rossi esplodono dopo qualche colpo e possono far esplodere quelli vicini a catena. Col piccone si raccolgono materiali anche da cataste di legna, pile di mattoni e barili di legno.
- **Colori e texture**:
  - **Terreno**: una texture di dettaglio con fili d'erba e chiazze, su due scale per non far vedere le ripetizioni. Il colore varia fra prato scuro, erba secca e zone fiorite; i pendii ripidi diventano roccia e le strade sterrate hanno il bordo erboso.
  - **Acqua**: colore in base alla profondità (turchese a riva, blu scuro al largo), schiuma che si muove sulla battigia, increspature animate e riflesso del cielo sulle superfici viste di taglio.
  - **Rocce**: texture di pietra con crepe e grana di granito, proiettata sui 3 assi (niente stiramenti), più muschio sulla parte alta. Ci sono 5 forme diverse (masso, lastra, spuntone, masso spaccato) e spesso compaiono a gruppi.
  - **Cielo e materiali**: alone e disco del sole con foschia all'orizzonte; intonaco con grana, tegole e mattoni in rilievo; vestiti con trama di tessuto.
- **Un mondo più vivo**:
  - **Erba fitta**: vicino a te crescono ciuffi di fili sottili, scuri alla base e chiari in punta, che prendono il colore del terreno sotto (verde, secco, fiorito). Ondeggiano nel vento a raffiche, si piegano quando ci passi in mezzo e sfumano con la distanza. Fra l'erba ci sono fiori colorati e sassolini.
  - **Più alberi**: circa il 70% in più, raggruppati in veri boschi fitti alternati a prati aperti, con le chiome che ondeggiano al vento. In montagna prevalgono gli abeti.
  - **Cespugli**: circa 4.700, in 4 varianti (due con fiori bianchi e gialli o rosa e viola). Non bloccano il passaggio, quindi ci si può nascondere dentro.
  - **Prestazioni**: l'erba fitta viene generata a celle da 32 m attorno alla telecamera, poco per volta, e scaricata quando ti allontani. Oltre 110 m gli alberi passano a una versione semplificata; cespugli ed erba media spariscono oltre 150 m, e le rocce di ogni chunk sono unite in un'unica geometria.
- **Tempesta lenta**: si restringe in 6 fasi, con attese da 2 minuti e mezzo all'inizio e danni crescenti. Una partita completa dura circa 15 minuti.
- **Mappa a chunk**: il mondo è diviso in blocchi da 100 m; dentro ogni blocco gli oggetti fissi sono uniti per materiale, così servono poche draw call. Vicino al giocatore vengono costruiti i blocchi dettagliati (alberi, erba, interni delle case, bottino, forzieri), poco per volta per evitare scatti; quelli lontani vengono scaricati. In lontananza resta una versione semplificata dell'isola, così l'orizzonte non è mai vuoto. Le collisioni esistono su tutta la mappa, quindi i bot funzionano anche lontano da te.
- **99 bot** con IA: raccolgono bottino, aprono forzieri, si curano, scappano dalla tempesta, si combattono anche fra loro e distruggono i tuoi muri.
- **Abbassarsi**: con `C` ci si accovaccia; la hitbox è più piccola, la dispersione più bassa e la telecamera scende. Anche i bot si abbassano quando sparano da fermi.
- **Arrampicarsi**: con `W` + `Spazio` contro un muro, una cassa, un container o una casa ci si aggrappa e si sale; in cima il personaggio scavalca il bordo da solo, con un'animazione fluida. Si consuma **stamina**, visibile in una barra gialla. `S` serve a scendere e `Spazio` a staccarsi con un salto. Il personaggio può anche infilarsi nelle finestre. I bot scavalcano gli ostacoli bassi.
- **Animazioni**: respiro e sguardo che si guarda attorno da fermi; camminata e corsa con dondolio, spalle che ruotano e inclinazione in curva; arma in spalla mentre corri; rinculo a ogni colpo; ricarica con la mano al caricatore; sussulto quando vieni colpito; salto con gambe raccolte; affondo e polvere all'atterraggio; bracciate in acqua; deltaplano che si inclina in virata; morte con caduta e "puff" finale. In più: cambio arma animato e passaggio morbido fra posizione in piedi e accovacciata.
- **Balletti (emote)**: con `B` scorri fra Ballo disco, Saluto, Floss ed Esultanza, oppure li scegli direttamente con `6`–`9`. Il personaggio si gira verso la telecamera; il balletto si interrompe se ti muovi, spari o vieni colpito. Quando vinci parte l'esultanza automatica.
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
| B / 6–9 | Balletti (emote) |
| F | Schermo intero (si attiva anche da solo premendo GIOCA, disattivabile nel menu) |
| Esc | Pausa |

## Struttura

```
index.html      sito del gioco (landing page)
site.css        stile e animazioni del sito
gioco.html      il gioco (menu, HUD, schermate)
style.css       stile dell'interfaccia di gioco
js/config.js    armi, rarità, skin, cappelli, zaini, modalità, tempesta, difficoltà
js/progress.js  pass battaglia, negozio, missioni, monete, XP (localStorage)
js/net.js       lobby online peer-to-peer (PeerJS / BroadcastChannel)
js/menu.js      menu a schede: Gioca, Armadietto, Pass, Negozio, Missioni
js/anim.js      pose e animazioni condivise dei personaggi
js/gfx.js       post-processing, ombre, risoluzione e preset di qualità
js/settings-ui.js pannello impostazioni a schede
js/texgen.js    texture procedurali: qualità, normal map dal rilievo
js/world.js     terreno, città, chunk (dettaglio + LOD), collisioni, raycast
js/props.js     modelli low-poly (alberi, rocce, legna, mattoni, barili, casetta) e caricamento dei .glb
models/         cartella facoltativa per i file .glb originali
js/character.js modelli 3D di personaggi, armi, deltaplano e bus
js/audio.js     effetti sonori sintetizzati
js/main.js      ciclo di gioco, giocatore, arrampicata, IA dei bot, combattimento, HUD
js/site.js      scene 3D e animazioni del sito
js/transition.js transizione animata fra sito e gioco
vendor/         Three.js r187 (+ addons di post-processing) e PeerJS 1.5 (licenza MIT)
```
