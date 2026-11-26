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

### Novità: accessori su misura, deltaplani rifatti e lobby nel bosco (v30)

- **Cappelli e zaini calzano davvero** (`js/realchar.js`): al caricamento di ogni personaggio si misurano la
  testa (vertici guidati dall'osso della testa, capelli compresi: cima, centro, larghezza e profondità alla fronte)
  e la sezione del busto all'altezza del petto (schiena, petto, mezza larghezza). Cappelli e zaini, disegnati per
  lo scheletro procedurale, vengono scalati e appoggiati su queste misure: niente cappelli che fluttuano o
  capelli che bucano la calotta, zaini a contatto con la schiena anche sopra armature e tute.
- **Cappelli rifatti** (`js/character.js`): profili a rotazione e tese deformate al posto dei cilindri
  (cowboy con piega e tesa rialzata, paglietta intrecciata con nastro e fiocco, cilindro in feltro con tesa
  arrotolata, cappello da mago floscio con stelle, corona d'oro a punte con gemme, elmo vichingo a spicchi con
  corna ricurve, cuffie con archetto, padiglioni in similpelle e microfono).
- **Zaini rifatti**: chitarra acustica sagomata in legno, spada nel fodero di cuoio, jetpack con serbatoi, ali
  d'angelo fatte di piume, ali di drago con dita e membrana venata; nuove trame in `js/chartex.js` (legno, piume,
  membrana).
- **Deltaplani nuovi**: vela bombata a doppia superficie con stecche, bordo d'uscita a festoni e tasca del bordo
  d'attacco, chiglia, traversa, king post con i cavi, trapezio con manopole, imbrago e alette. Ogni vela ha una
  texture disegnata (`gliderTexture` in `js/chartex.js`): fiamme, tigre, notte stellata, arcobaleno, raggi d'oro…
- **Lobby nel bosco** (`js/main.js`): il personaggio sta su un piedistallo di pietra in un angolo della mappa,
  con prato e sentiero, staccionata, boschetto, capanno con la legna, rocce, fiori e lucciole, colline e
  montagne nella foschia, nuvole e il bus della battaglia che attraversa il cielo.

### Novità: animazioni, armi che non trapassano il corpo e 6 armi nuove (v29)

- **Niente più armi dentro il personaggio** (`js/anim.js`): ogni arma ha un'impugnatura descritta in
  `js/weapons.js` (`HOLD`: tipo, punto della mano sull'impugnatura e sul paramano) e il suo ingombro misurato dal
  modello. La posa la mette al posto giusto:
  - fucili: **calcio nella tasca della spalla**, che ruota attorno alla spalla quando guardi su o giù;
  - **lanciarazzi appoggiato sulla spalla**, minigun all'anca, pistole a due mani con le braccia tese;
  - in corsa: fucile **di traverso davanti al petto** (la distanza dipende da quanto è spesso e lungo),
    pistola bassa in una mano che dondola col passo, balestra in "low ready" (punta verso terra).
- **Mani sull'arma con la cinematica inversa**: le braccia non hanno più angoli fissi, i polsi vanno
  sull'impugnatura e sul paramano (se il paramano è troppo lontano la mano scivola indietro fin dove arriva il
  braccio). Funziona anche in ricarica (mano al caricatore → tasca sul fianco → caricatore → paramano), nel
  rinculo (l'arma arretra lungo la canna) e nel cambio arma.
- Le armi impugnate sono in scala 0,86: proporzioni più credibili rispetto al corpo (la bocca da fuoco segue la scala).
- Verificato con un test automatico che "voxelizza" il corpo vero (braccia escluse) e conta i punti delle armi
  che ci finiscono dentro: per 18 armi × 4 skin × 8 pose (mira, mira su/giù, corsa, accovacciato, ricarica)
  si passa da compenetrazioni fino a 16 cm a praticamente zero.
- **Passo più naturale**: tallone che tocca per primo, ginocchio che assorbe l'appoggio, spinta di punta allo
  stacco, bacino che si sposta sulla gamba d'appoggio con un piccolo rollio delle spalle; in corsa il tallone sale
  verso il gluteo e il punto più alto è nella fase di volo. Braccia libere che "pompano" in corsa.
- **Arrampicata**: la mano sale veloce staccandosi dal muro e poi tira giù lenta, la gamba opposta fa il passo,
  il bacino oscilla e la testa segue la mano.
- **6 armi nuove** (con modello 3D, suono, icona e rarità): **Mitragliatrice leggera** (nastro da 60, bipiede,
  rallenta un po'), **Doppietta** (due colpi a raffica ravvicinata), **Pistola pesante** (54 danni),
  **Balestra** (silenziosa, dardo lento che cade: mira più in alto), **Lanciagranate** a tamburo da 6 (granate a
  parabola che esplodono) e **Mitraglietta silenziata**. In tutto ora le armi sono 21.

### Novità: skin riconoscibili (v28)

- **Costumi veri sopra i personaggi realistici** (`js/costume.js`): i modelli MakeHuman delle skin erano persone
  "normali" e un drago o un ninja sembravano solo un ragazzo vestito di rosso o di nero. Ora ogni skin a tema ha
  i pezzi che la rendono riconoscibile:
  - **Drago Rosso**: pelle a scaglie (rilievo procedurale) con ventre a piastre, muso allungato, occhi gialli a
    fessura, corna all'indietro, cresta di spine dalla nuca al bacino, **ali** con ossa e membrana venata e **coda**
    con punta a freccia;
  - **Ninja**: cappuccio con fessura per gli occhi, maschera sul viso, nodo dietro la testa, fascia rossa in vita,
    fasce su avambracci e polpacci, **katana** a tracolla;
  - **Samurai**: kimono e hakama, corazza a lamelle laccate cremisi legate da cordoncini, falde, spallacci,
    parabraccia e schinieri, **kabuto** con mezzaluna d'oro e paranuca, maschera mempo, due spade;
  - **Cavaliere**: armatura d'oro a piastre con giunture (dove si vede la cotta di maglia), **elmo chiuso** con
    fessura e fori, pennacchio, mantello e spada;
  - **Astronauta** (casco con visiera dorata, zaino, tubi), **Pirata** (tricorno, benda, giacca coi bottoni d'oro,
    fusciacca, sciabola), **Vichingo** (elmo cornuto col nasale, pelliccia, scudo tondo, ascia), **Robot** (corpo di
    metallo con giunture, occhi rossi, antenna, nucleo luminoso), **Spettro** di ghiaccio traslucido, **Banana**
    (costume intero), **Zombie** (pelle marcia, vestiti strappati e insanguinati), **Cowboy** (cappello vero),
    **Scienziata Pazza** (camice e occhialoni).
- Come funziona: i pezzi che seguono il corpo sono **gusci** (copie del corpo + vestiti, gonfiate e con gli stessi
  pesi delle ossa), quindi si piegano con tutte le animazioni; i bordi sono tagliati nello shader per avere linee
  pulite. Elmi e muso hanno forma e normali proprie. I pezzi rigidi (ali, corna, spade, scudi) sono legati a un
  osso e uniti per materiale ai gusci per contenere le draw call. Nessuna texture da scaricare: scaglie, lamelle,
  maglia, pelo e tessuti sono procedurali.

### Novità: città a tema, danni da caduta e munizioni con texture (v27)

- **Ogni città ha un tema che la rende diversa dalle altre** (`js/townkit.js`, `js/city.js`), con pianta,
  strade, edifici e oggetti propri:
  - **alpina** (in montagna): tutto innevato, strade di neve battuta, vicoli invece del reticolo, chalet di legno
    con catasta, piazza di ciottoli con campanile scalabile, albero di Natale, slitte e rastrelliere da sci;
    alcune hanno una miniera scavata nella roccia innevata;
  - **western** (nel deserto): una sola via principale sterrata con passerelle di legno, saloon ed empori al
    centro, e intorno si vive **dentro i camion** (cassone con porta, letto, cucinino, tendalino e pannelli
    solari); due **piccole miniere** con binari, carrelli e mucchi di minerale, staccionate, botti e carri;
  - **costiera**: strade di sabbia a croce, **palafitte** con scala e terrazzino, cabine da spiaggia,
    torretta del bagnino (con bottino in cima), surf e barche in secca;
  - **fattoria**: una strada sterrata, **fienili rossi** con tetto a falde e fieno nel soppalco, **campi
    coltivati** (grano, mais, ortaggi) con staccionata, trattori, rotoballe e spaventapasseri;
  - **castello**: **mura merlate** con porte sulle strade, strade di ciottoli e bancarelle del mercato;
  - classiche, industriali e portuali restano a reticolo asfaltato.
  Anche il colore del terreno e della minimappa segue il tema e le strade.
- **Danni da caduta**: oltre ~4 m di caduta libera (velocità > 13 m/s) si perdono PV in proporzione
  (6 m ≈ 15, 10 m ≈ 37, 25 m ≈ 90; ignorano lo scudo). In acqua e atterrando col deltaplano niente danni.
- **Munizioni con texture** (`buildAmmoMesh` in `js/items.js`): cassette di metallo verniciato con fascia del
  colore del tipo, calibro a stampino, maniglia e cartucce sparse; cartucce rosse in una scatola di cartone;
  razzi in una cassa di legno. Hanno anche l'icona nel messaggio di raccolta.

### Novità: un personaggio per ogni skin e casette abitabili (v26)

- **24 personaggi diversi**: ogni skin ha il suo modello (`models/chars/<id>.glb`), non più un ricolore dello
  stesso corpo. Sono persone realistiche con corpo, età, viso, carnagione, capelli, barba, occhiali e vestiti
  propri, ad esempio:
  - la Recluta in maglietta e cargo;
  - l'Agente in completo e occhiali;
  - il Vichingo con barba e tunica;
  - il Samurai in kimono cremisi;
  - il Robot X-9 in armatura cyborg con visore;
  - lo Spettro in tunica stellata con cappuccio;
  - il Drago Rosso con le corna;
  - il Meccanico in salopette;
  - l'Astronauta in tuta spaziale;
  - il Cowboy con il cappello.

  Sono costruiti con *VRM Avatar Maker* dagli asset CC0 di MakeHuman e alleggeriti per il gioco: circa 15 mila
  triangoli e 0,6 MB l'uno, senza morph, con vertici quantizzati.
  - Si scaricano **solo quando servono**, cioè quando un personaggio con quella skin si vede da vicino. Nel
    frattempo si vede il modello base, poi il cambio è automatico. La skin del giocatore si carica subito.
  - Lo scheletro in stile Unreal (`pelvis`, `spine_01`, `upperarm_l`…) viene mappato sui nomi usati dal
    retargeting.
  - Le dita si piegano su assi calcolati nel mondo.
  - Alcuni vestiti sono **tinti** secondo la skin, ad esempio la maglia oliva del Soldato tattico e la tonaca
    rossa di Tamsin.
  - Sui personaggi che hanno già un copricapo il cappello cosmetico non si mette.
- **Casette di legno abitabili** (le ~48 casette sparse per la campagna, `js/props.js` → `SHED`):
  - **porta vera** a un'anta che si apre e chiude con **E**, anche per i bot e online;
  - pareti con collisioni vere e pavimento a tavole;
  - letto con coperta a quadri, tavolo con sgabelli e lanterna, mensole con barattoli e libri, tappeto, catene
    del tetto e una seconda finestra;
  - il **bottino è dentro**, sul tappeto, e spesso c'è un **forziere** ai piedi del letto.
- **Stufa a legna** (`js/stove.js`). Premendo **E** davanti alla stufa si accende:
  - fiamme vive dietro il vetro;
  - un bagliore caldo che illumina la stanza (una sola luce riutilizzata, nessuna ricompilazione degli shader);
  - il **fumo** che esce dal comignolo e piega col vento.
  - Chi resta **al calduccio** dentro la casetta recupera **+2 PS al secondo** fino a 100. Vale anche per i bot.
  - La legna dura 60 secondi, poi il fuoco cala e si spegne. Online l'accensione è sincronizzata.
- Crediti: personaggi creati con [VRM Avatar Maker](https://github.com/ffunch/vrm-avatar-maker) (codice MIT)
  da asset **CC0** di MakeHuman e della comunità MakeHuman (vedi `ASSETS.md` del progetto).

### Novità: grafica realistica (v25)

- **Personaggi veri** (`js/realchar.js`): al posto dei pupazzi fatti di cubi, sfere e cilindri ci sono modelli
  umani scolpiti e texturizzati con scheletro Mixamo (`models/chars/soldato.glb`, `models/chars/donna.glb`).
  Lo scheletro procedurale continua a fare tutte le animazioni (corsa, mira, arrampicata, nuoto, deltaplano,
  emote, morte) e ogni fotogramma la posa viene **trasferita alle ossa** del modello; con l'arma in mano le
  braccia usano la **cinematica inversa** così le mani restano sull'impugnatura e le dita si chiudono sull'arma.
  Le skin **ricolorano** armatura, tessuti e dettagli direttamente nello shader (la texture originale con pieghe,
  graffi e cuciture resta). Cappelli, zaini e mantelli si agganciano alla testa e alla schiena vere.
  Se i modelli non si caricano si torna ai personaggi procedurali.
- **Auto realistiche** (`js/cars.js`): carrozzeria a superficie continua (cofano, parabrezza, tetto, lunotto,
  passaruota, fiancate bombate) in tre modelli — berlina, utilitaria, SUV — con **vernice metallizzata e
  trasparente lucido** che riflette il cielo, vetri a specchio, gomme con spalla, cerchi in lega a 5 razze,
  fari, fendinebbia, fanali, griglia, specchietti, maniglie cromate e **targhe italiane**.
- **Soffitti**: entrando in una casa o in un palazzo tetto e piani superiori non spariscono più. Soffitti
  intonacati con plafoniera; la telecamera si accorcia contro soffitti e pareti.
- Crediti modelli: `soldato.glb` e `donna.glb` provengono dagli esempi di three.js (personaggi Mixamo, Adobe).

### Novità: città vere (v24)

- **Città molto più grandi e complete** (`js/city.js`). Ogni città ha un **reticolo di strade** con piazza centrale.
  - **Strade**: asfalto con linea tratteggiata, strisce pedonali agli incroci, marciapiedi con cordolo e semafori nelle città grandi.
  - **Piazza** in porfido con un monumento a tema (fontana, statua, pozzo, albero di Natale…), aiuole, alberi, panchine, chiosco e tavolini dei bar.
  - **Arredo urbano**: lampioni ogni 22 m, cestini, idranti, fermata del bus e centinaia di auto parcheggiate (non nel far west).
- **Palazzi** da 1 a 7 piani, con piani da 3 m.
  - Ogni piano ha solai veri con le **scale** (rampe da 10 gradini). Il tetto piano è calpestabile, con parapetto, condizionatori, cisterne e antenne. In alternativa c'è il tetto a falde.
  - Facciate a tema: intonaco, mattoni, pastello, vetro (grattacieli in centro), legno con falsa facciata e portico nel far west, pietra con merli nei castelli. Hanno balconi e tende da sole.
  - Quando entri **si nascondono i piani sopra di te**, così vedi sempre dove sei.
- **Negozi** al piano terra (32 tipi). Hanno insegna, vetrina e **interni arredati**: bar, pizzeria, farmacia con croce verde, armeria, supermercato con scaffali, libreria e altri.
- **Capannoni** nelle zone industriali e nei porti: portone aperto, soppalco con scala e scaffalature con casse.
- **Case con giardino** e siepe ai bordi della città.
- I bot sanno usare le scale per salire e scendere dai piani.
- Minimappa con le strade e i palazzi delle città.
- **Orizzonte pulito**:
  - Niente più "colonne" chiare o scure. Le montagne lontane avevano picchi bianchi che sfumavano fino alla base e fessure tra i segmenti.
  - Il muro della tempesta non ha più strisce seghettate quando è lontano.
  - Gli alberi lontani (LOD) non sono più blocchi scuri.
- **Nemici lontani**: non spuntano più di colpo a 480 m. Svaniscono gradualmente nella nebbia.

### Novità: squadre (Duo, Trio, Squad), Versus e lobby nuova

- **Modalità a squadre** nella scheda GIOCA: *Singolo*, *Duo*, *Trio* e *Squad* (squadre da 1, 2, 3 o 4 su 100 giocatori). Vince l'ultima squadra in piedi.
  - Offline i posti liberi della tua squadra sono **bot compagni**: ti seguono, saltano dal Battle Bus con te e ti aiutano negli scontri.
  - **Niente fuoco amico**. I compagni hanno una **targhetta col nome** sopra la testa, sono nell'**HUD squadra** a sinistra con la salute e compaiono come punti colorati sulla minimappa.
  - Quando muori **guardi un compagno** ancora vivo. Se cade tutta la squadra compare *SQUADRA ELIMINATA* con il piazzamento.
- **Online con gli amici**: l'host sceglie la modalità.
  - **Squadra**: gli amici giocano insieme nella stessa squadra, con i bot a riempire i posti.
  - **Versus**: ogni amico guida la propria squadra di bot e vi affrontate.
- **Lobby ridisegnata**:
  - I compagni (amici o bot) stanno accanto al tuo personaggio sulla pedana, con targhetta e animazione d'entrata. Gli avversari del Versus stanno più indietro.
  - Sotto ci sono gli slot squadra (*Invita* per i posti liberi) e il riepilogo della partita.
  - A destra c'è il **cartello delle Novità** a scorrimento: toccalo per leggere tutte le versioni.
- **Skin più realistiche**:
  - Le stoffe hanno **pieghe, cuciture e ombre** nei punti di contatto.
  - Scarpe con suola in gomma e intersuola, stivali da cowboy in pelle con tacco.
  - Cappellino a 6 spicchi con visiera curva; cappelli e zaini in tessuti veri (ripstop, cordura, paglia, maglia).
  - Zaino da scuola con cerniere, tasca e catarifrangente.

### Novità: inventario (TAB), legno e rocce rifatti

- **Inventario con <kbd>TAB</kbd>** (sul telefono c'è il pulsante 🎒 in alto). Si apre un pannello con i 5 slot, che mostrano l'icona 3D, il colore della rarità, il caricatore, le munizioni di riserva e le quantità.
  - Gli oggetti si **riordinano trascinandoli** con il mouse o con il dito. In alternativa si seleziona uno slot e si preme <kbd>1</kbd>–<kbd>5</kbd>, oppure si usano i pulsanti ◀ ▶. L'arma che hai in mano resta in mano.
  - Si **gettano a terra** trascinandoli sulla zona rossa, con *Getta* o con <kbd>G</kbd>. Si impugnano con *Impugna*, con <kbd>E</kbd> o con un doppio clic.
  - Il pannello dei dettagli mostra le **statistiche** dell'arma in barre: danno (con la rarità), danni al secondo, cadenza, precisione, portata, caricatore e ricarica. Mostra anche il tipo di munizione, con un avviso se è finita. Per le cure indica l'effetto e il tempo d'uso.
  - Sulla destra trovi **munizioni** per tipo, con quali slot le usano. Si possono gettare a pacchetti con ⤓. Ci sono anche i materiali e il riepilogo delle cure, mentre salute e scudo sono in alto.
  - Mentre l'inventario è aperto il cursore è libero e il personaggio si ferma. La partita però continua, quindi occhio. Si chiude con <kbd>TAB</kbd> o <kbd>Esc</kbd>.
- **Legno sistemato**: le venature ora sono lunghe, lisce e continue, e da lontano si sfumano. Prima il rumore procedurale creava blocchi a "pixel" e anelli a macchie su capanni, torri dell'acqua, barili e cataste. Le casse hanno assi pulite, senza la grana a puntini. Le facce piatte non si dividono più in triangoli chiari e scuri.
- **Rocce più belle**: niente più quadretti né puntini da vicino. Il rilievo viene da rumore 3D liscio invece che dalla texture. Le rocce hanno macchie morbide, strati ondulati e una leggera marezzatura. Il **muschio** cresce sulle facce in alto nei prati e nei boschi, mentre in montagna e nella zona innevata c'è una **calotta di neve** con bordo irregolare (prima erano triangoli bianchi e verdi a caso). Nel deserto le rocce sono in arenaria senza muschio.

### Novità: porte, case arredate, nuoto realistico e partite più lunghe

- **Porte vere**: ogni ingresso ha due ante in legno verniciato con riquadri in rilievo e maniglie d'ottone. Si aprono e chiudono con <kbd>E</kbd> (o *APRI*/*CHIUDI* sul telefono), con cigolio e battuta. Da chiuse bloccano passaggio e proiettili. I bot le aprono quando ci passano e online sono sincronizzate.
- **Interni arredati** secondo il tema della città: letti con coperte, cuscini e comodino con abat-jour, divani con tavolino, librerie piene di libri (scaffali con scatole nei porti e nelle zone industriali), armadi, cucine con lavello, fornelli e pensili, TV, scrivanie con portatile, camini accesi nelle baite e nei castelli, piante, lampade, quadri e un tavolo da pranzo con sedie su un tappeto. In più ci sono il parquet e i battiscopa. Bottino e forzieri compaiono solo negli spazi liberi.
- **Nuoto realistico**: in acqua l'inerzia ti fa scivolare. Da fermo resti a galla muovendo braccia e gambe; nuotando passi allo stile libero, con rollio, respiro di lato e corpo in superficie. Con lo sprint nuoti più veloce ma consumi resistenza. In acqua alta non puoi saltare né sparare. Tuffi, schizzi delle bracciate, cerchi che si allargano sull'acqua e suoni dedicati.
- **Montagne più dure**: sui pendii si rallenta e ci si stanca. Oltre circa 45° non si sale più e sulle pareti più ripide si scivola giù. Arrampicarsi sui muri è più lento, consuma più resistenza e serve più fiato per iniziare, che si ricarica più piano.
- **Partite più lunghe** (circa 21 minuti): la tempesta ha 7 fasi con attese più lunghe. I bot vedono meno lontano, hanno un campo visivo più stretto e atterrano più sparsi per la mappa, quindi gli scontri sono più rari.
- **Armi rare davvero rare**: a terra le epiche sono circa il 5% e le leggendarie circa l'1%. Forzieri ed eventi danno solo una *possibilità* di salire di rarità, molto bassa sopra la rara. Lanciarazzi, minigun e cecchino si trovano meno spesso.
- **Niente più bagliori**: neve meno abbagliante, rocce opache, sole un po' più morbido e bloom che si attiva solo su luci vere (spari, lampade, oggetti luminosi).
- **Nuovo mirino dello shotgun**: bindella ventilata in prospettiva, mirino in fibra ottica rosso, perla intermedia d'ottone (allineate formano un "8") e un anello leggero che mostra la rosata.
- **Legno, barili e rocce più tridimensionali**: rocce con rilievo calcolato in 3D, cavità in ombra e strati. Casse con texture a risoluzione doppia, nodi, fessure profonde e chiodi. Cataste di tronchi con corteccia irregolare, anelli sulle sezioni e cinghie di ferro. Barili di legno a doghe con cerchioni rivettati, fusti di metallo con costole, bordi arrotolati e tappi. Su tutti c'è un rilievo procedurale (venature, graffi, sporco alla base).

### Novità: erba in 3D, accessori, ottiche rifinite e sottobosco

- **Erba davvero tridimensionale**: ogni filo ora ha una sezione a "V" con la nervatura centrale, due metà con luce diversa e una leggera traslucenza, così resta pieno da ogni angolazione invece di sembrare un foglio piatto.
- **Accessori sulle armi** (solo estetici): torce tattiche con lente accesa, moduli laser rossi o verdi, impugnature verticali e angolate, copriottiche ribaltabili sul fucile da cecchino, magliette per la cinghia e una cinghia di cuoio sul fucile da caccia.
- **Ottiche rifinite**: torrette di regolazione e riflessi ambrati sul red dot, cappuccio con pulsanti sull'olografico, scala di distanza sul prismatico, alette di protezione sulle mire metalliche.
- **5 nuovi cappelli**: basco, elmetto tattico con visore notturno, cappello di Natale, orecchie da volpe e kabuto da samurai.
- **4 nuovi oggetti sulla schiena**: zaino tattico con radio, faretra con frecce, tavola da surf e scudo del guerriero. Gli zaini hanno spallacci e cinghia sternale sul petto, gli oggetti a tracolla una cinghia in diagonale; zainetto e zaino da trekking hanno tasche, cerniere, telaio e borraccia.
- **Mappa**: funghi (porcini e amanite), ceppi con radici e muschio, felci nel sottobosco dei boschi.
- **Battle Bus**: adesivi sui fianchi, bottazzi in gomma cromati, fango sulla parte bassa e barra luminosa sul tetto.
- **Personaggi**: la trama della mimetica non forma più una griglia chiara; nuovi suoni per il fucile a raffica e lo shotgun a tamburo.

### Novità: 15 armi con mirini propri, animazioni direzionali e Battle Bus più ricco

- **9 nuove armi**, ognuna con pro e contro diversi:

  | Arma | Caratteristica |
  |---|---|
  | Revolver | 6 colpi pesanti (48), lento ma preciso |
  | Mitraglietta compatta | danno basso (11) ma cadenza altissima |
  | Fucile a raffica | 3 colpi per pressione, molto preciso |
  | Fucile d'assalto pesante | più danni (38) ma rinculo forte |
  | Fucile tattico DMR | semiautomatico con ottica 2,6× e silenziatore |
  | Fucile a pompa tattico | meno danni del pompa (8×8) ma semiautomatico, 8 colpi |
  | Fucile a tamburo | automatico, 16 colpi, tanti pallini e poca gittata |
  | **Fucile da caccia** | noce e ottone, ottica d'epoca 2,4×, 90 danni, preciso anche senza mirare |
  | Minigun | le canne girano (e devono prendere giri) prima di sparare; rallenta chi la porta |
- **Mirino diverso per ogni arma**: punto per le pistole, "T" per le mitragliette, croce per i fucili, chevron per la raffica, cerchio della rosata per i pompa (tratteggiato per il tamburo), angoli per il DMR, croce sottile per il fucile da caccia, scala di alzo per il lanciarazzi e anello che si riempie per la minigun.
- **Ottica diversa in mira**: tacca e mirino (pistola), tacca a V con lama d'ottone (revolver), olografico, red dot, prismatico con chevron verde, bindella con perla d'ottone (pompa), telemetro (lanciarazzi). A schermo intero: cannocchiale con reticolo duplex e mil-dot (cecchino), ottica tattica con chevron e scala di caduta (DMR), ottica d'epoca con reticolo tedesco e anello d'ottone (fucile da caccia).
- **Animazioni che seguono il movimento**: avanti, indietro (passi corti, busto eretto), di lato (bacino girato e passo laterale), in diagonale e passettini quando ti giri da fermo; il busto resta sempre rivolto al bersaglio. Valgono per te, i bot e gli altri giocatori online.
- **Battle Bus**: passeggeri dietro i finestrini, insegna luminosa, lampeggiante, trombe, condizionatore, eliche laterali che girano, bruciatore con fiamma, zavorre, festoni di bandierine, bandiere, paracolpi, fendinebbia, stemma, targhe, scarico che fuma, paraspruzzi e bulloni sulle ruote.
- Le missioni "elimina con il cecchino / pompa…" contano anche le varianti della stessa famiglia.

### Novità: erba fitta e mondo più tridimensionale

- **Erba nuova**: ciuffi con più fili, curvi e a tre segmenti che si assottigliano fino alla punta; ogni filo prende la luce in modo diverso secondo l'orientamento (volume invece di un tappeto piatto). Densità aumentata vicino al giocatore e più ciuffi a media distanza. La densità resta regolabile nelle impostazioni (preset "basso" più leggero).
- **Case con tetto a due falde**: falde spesse con gronda, colmo, timpani in muratura e camini alti che escono dal tetto (il tetto si può calpestare). Restano piatti solo le facciate western e i castelli merlati. Da lontano la sagoma del tetto si vede anche nella versione semplificata.
- Lesene in rilievo agli angoli delle case, infissi a croce nelle finestre, gradino in pietra davanti alle porte.
- **Container** in lamiera ondulata con nervature, montanti d'angolo, longheroni e barre di chiusura.
- **Casse** di legno con i 12 spigoli rinforzati in rilievo.
- **Forzieri** rifatti: assi di legno con rilievo, coperchio a botte, fasce dorate, borchie agli angoli, serratura con anello e maniglie laterali.
- **Battle Bus** rifatto: carrozzeria arrotondata con pannelli rivettati e vernice lucida, finestrini incassati con cornici, parabrezza inclinato con tergicristalli, fari tondi luminosi, griglia cromata, paraurti, specchietti, porta, fascia "BATTLE BUS", portapacchi con bagagli, scaletta, ruote con pneumatici e cerchioni a razze. La mongolfiera ha spicchi cuciti in rilievo, una bocca e funi che scendono fino al tetto del bus.

### Novità: corpo unico senza giunture e cure rifatte

- **Personaggi senza giunture**: busto, collo, braccia e gambe sono ora un'unica mesh deformabile (skinning). Gomiti e ginocchia si piegano in modo morbido, le spalle sfumano nel busto e il collo nella testa: niente più sfere o pezzi staccati alle articolazioni. Le animazioni sono le stesse di prima e il corpo costa meno draw call.
- Maniche corte e pantaloncini hanno un orlo vero; i polsini aderiscono al braccio.
- **Bende**: due rotoli di garza con trama, spirale sulla testa, fascetta con croce rossa e un lembo srotolato.
- **Medikit**: valigetta arrotondata in plastica graffiata, croce rossa in rilievo su entrambi i lati, fascia e angoli in gomma rossa, maniglia e chiusure in metallo.
- **Mini scudo**: fiaschetta tonda di vetro con liquido azzurro luminoso, bollicine, tappo di sughero ed etichetta "+25".
- **Pozione scudo**: bottiglia alta con liquido blu intenso, tappo zigrinato, anelli dorati ed etichetta con scudo e fulmine "+50".
- **Icone nuove**: nella barra degli oggetti e nel messaggio "Raccogli" le emoji sono sostituite da foto dei modelli 3D.

### Novità: personaggi con stoffe e materiali veri

- Ogni skin ha il suo **tessuto**: mimetica (Recluta, Tattico), ripstop, jeans con cuciture, lino, seta con fantasia (Tamsin, Samurai), gessato (Agente), maglia (Vichingo, Rapper), scozzese (Cowboy), quadretti (Giardiniera), tuta imbottita (Astronauta), squame (Drago), esagoni luminosi (Cyber), brina (Spettro), macchie (Zombie).
- Ogni stoffa ha rilievo (normal map) e **lucentezza propria**: riflesso morbido sui tessuti, cuoio leggermente laccato, metallo spazzolato con pannelli e rivetti.
- Pelle con pori leggerissimi e un velo rosato ai bordi; capelli a ciocche con riflesso lucido.
- Luce di contorno: i personaggi si staccano dallo sfondo anche in ombra.
- Con "Qualità texture: bassa" (e al primo avvio su telefono) si usano materiali semplici, quindi niente costo extra.

### Novità: biomi, montagne, meteo, eventi e città tematiche

- **Mappa più irregolare**: rilievo generato con rumore frattale e *domain warping*, coste frastagliate con isolotti, fiumi che scendono dalle montagne, colline e creste ovunque.
- **Montagne alte** (fino a ~95 m) con roccia sui versanti ripidi e cime innevate; la quota della neve cambia con il bioma.
- **5 biomi** con terreno, alberi ed erba propri: *prati* (centro), *montagne innevate* (nord-ovest: abeti carichi di neve), *deserto* (sud-est: cactus, alberi secchi, rocce color sabbia), *bosco autunnale* (nord-est: querce e betulle rosse e arancioni), *costa tropicale* (sud-ovest: palme). Anche la minimappa mostra i biomi, la profondità dell'acqua e l'ombreggiatura dei rilievi.
- **Meteo locale**: la neve cade solo nella zona innevata e in alta quota, nel bosco autunnale cadono le foglie, nel deserto soffia la polvere; nebbia e colore del cielo cambiano con il bioma.
- **Profondità**: nebbia d'altezza (valli velate, cime nitide), prospettiva aerea e due catene montuose all'orizzonte oltre il mare.
- **Città tematiche**: *villaggio alpino* (case in legno con tetti innevati, pupazzi di neve, abeti), *città western* (facciate a falso fronte, torre dell'acqua, cactus, balle di fieno), *fattoria* (case rosse, silos, balle di fieno, staccionate), *borgo marinaro* (case colorate con tendoni, palme, ombrelloni), *porto* e *zona industriale* (ciminiere, container; il porto ha un faro), *castello* (case in pietra con merli e una torre con bandiera), *paese* classico; anche le località che iniziano con "Faro" hanno il loro faro. Il nome della località e il suo tema compaiono nell'HUD quando ci entri.
- **Eventi durante la partita** (annunciati con un banner e segnati sulla mappa): *rifornimento aereo* (cassa leggendaria col paracadute), *pioggia di meteoriti* (cerchi di avviso prima dell'impatto), *nebbia fitta*, *bufera di neve*, *ora d'oro* (casse con bottino migliore), *bassa gravità*. Online li decide l'host e arrivano a tutti.
- **Personaggi più curati**: mani con dita, polsini, colletto, bottoni, tasche, lacci e suole, frangia, viso più dettagliato e occhi che sbattono le palpebre.
- Gli alberi molto vicini alla telecamera si dissolvono, così la chioma non copre più la visuale.

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
- **Armadietto** con 24 skin, 17 cappelli, 12 zaini e 7 deltaplani: quelli bloccati si possono provare in anteprima e mostrano come sbloccarli.
- **Erba alta**: macchie d'erba di circa 1,4 m nei prati. Se ti accovacci (C) dentro, sei *nascosto*: i bot ti vedono solo entro 10 m, o 25 m se hai appena sparato.
- **Personaggi più realistici**: corpo arrotondato con articolazioni (gomiti, ginocchia, mani, piedi). Le animazioni sono nuove: camminata e corsa con le ginocchia, passo laterale, respiro, atterraggio, accovacciamento con il busto in avanti, arrampicata mano sopra mano e scavalcamento del bordo.
- I progressi si salvano nel browser (localStorage).

- **100 giocatori per partita** (99 bot; dal menu si può scegliere anche 25 o 50 per i PC più lenti). I bot fra loro si fanno meno danni, così la partita non si svuota nei primi minuti. I personaggi lontani usano un modello semplificato e quelli oltre la nebbia non vengono disegnati.
- **Armadietto con 13 skin** di varie rarità (Recluta, Esploratrice, Zombie, Agente Segreto, Ninja, Soldato Tattico, Pirata, Meccanico, Cyber Neon, Astronauta, Agente Banana, Cavaliere d'Oro, Drago Rosso), più 4 deltaplani. Le tre nuove (Soldato Tattico con elmetto e giubbotto, Esploratrice con coda di cavallo, sciarpa e zaino, Meccanico con salopette, barba e cintura degli attrezzi) riprendono i tre personaggi del pacchetto di asset.
- **Armi rifatte da zero** (`js/weapons.js`): sagome vere estruse e smussate al posto delle scatole, con canne, silenziatori, cannocchiali, caricatori curvi, calci scheletrati, guardie del grilletto forate, slitte e dettagli. Ogni arma è unita in pochi pezzi (uno per materiale), quindi pesa meno di prima.
  - **Finiture per rarità**: Comune grigio tattico zigrinato, Non comune mimetica boschiva, Raro mimetica digitale blu, Epico fibra di carbonio viola con filetti al neon, Leggendario oro inciso a volute. Ci sono anche metallo spazzolato, polimero zigrinato e legno di noce, tutti con normal map (rilievo).
  - **Icone nuove**: barra degli slot, scritta "Raccogli" e kill feed mostrano una foto del modello 3D vero, nella sua finitura di rarità. Le foto sono fatte all'avvio con un piccolo renderer separato, che poi viene chiuso.
- **Versione mobile** (`js/touch.js`): si attiva da sola su telefono e tablet (si può forzare o spegnere in Impostazioni → Controlli).
  - Joystick analogico dove appoggi il pollice sinistro (spingendo fino in fondo si corre); trascinando a destra ci si guarda intorno, anche dal pulsante di fuoco mentre spari.
  - Pulsanti: fuoco (anche a sinistra), mira, salta / apri deltaplano / staccati, abbassati, ricarica, costruisci, "Raccogli" o "Apri" quando sei vicino a bottino e forzieri, "Lanciati" dal Battle Bus, più pausa, mappa, balletti e lascia oggetto. Si mostrano solo quelli che servono in quel momento.
  - Gli slot si toccano per cambiare arma e la minimappa per aprire la mappa grande. L'HUD diventa compatto e rispetta i bordi dei telefoni con notch.
  - Al primo avvio su telefono parte la grafica "Bassa" con limite a 60 FPS. In verticale compare "Ruota il telefono" e la partita va in pausa; in schermo intero lo schermo si blocca in orizzontale dove il browser lo permette.
  - Il menu si adatta agli schermi bassi e stretti (il pulsante GIOCA resta sempre visibile). C'è un manifest web, quindi "Aggiungi a schermata Home" apre il gioco a schermo intero, con la sua icona.
  - Nuove impostazioni: sensibilità touch e dimensione dei pulsanti.
- **Eroi anime** (dal rig Blender `original_anime_heroes_rigged.py`): tre skin gratuite, già sbloccate, che riprendono palette e dettagli dei tre personaggi.
  - **Leo l'Esploratore**: cappello da pescatore giallo con fascia, occhiali tondi, capelli ricci, bandana arancione, camicia militare con taschini e maniche arrotolate, borsa a tracolla, orologio, pantaloncini cargo, calzini a righe e scarponcini.
  - **Tamsin la Monaca**: top rosso smanicato con colletto e bordi dorati, fascia in vita con code, pantaloni larghi, bende a braccia, mani e caviglie, treccia lunga con anello d'oro, ciocche laterali e orecchini.
  - **Oren l'Ombra**: tuta scura, maschera sul viso, mantellina verde acqua con bordo dorato e cappuccio abbassato, sciarpa rossa, bracciali d'acciaio, fondina sulla coscia, bende alle gambe, calzature tabi, bastone sulla schiena e capelli argento.
  - **Occhi anime per tutti**: la texture del viso ora ha doppia risoluzione, iride sfumata con pupilla, due riflessi di luce, ciglia spesse con codina esterna (più ciglia per Tamsin) e sopracciglia inclinabili. Anche i bot possono usare le nuove skin.
- **15 armi con texture procedurali** (metallo spazzolato, polimero zigrinato, legno di noce venato, pannello della rarità con motivo diverso per livello: righe, chevron, esagoni, oro inciso) e dettagli come mirini, red dot, ottica con lenti, bipiede, freno di bocca e cartucce sul fianco. 5 livelli di rarità (Comune → Leggendario, il danno cresce con la rarità): pistola, mitraglietta, fucile d'assalto, fucile a pompa, cecchino con mirino e lanciarazzi con danno ad area. Colpi alla testa ×2.
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
- **Tempesta lenta**: si restringe in 7 fasi, con attese da 3 minuti e mezzo all'inizio e danni crescenti. Una partita completa dura circa 21 minuti.
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
js/noise.js     rumore simplex / frattale per il terreno
js/world.js     terreno, biomi, città tematiche, chunk (dettaglio + LOD), collisioni, raycast
js/city.js      generatore delle città: strade, piazze, palazzi a più piani, negozi, capannoni, arredo urbano
js/citytex.js   texture procedurali delle città: facciate, asfalto, marciapiedi, insegne, prodotti
js/realchar.js  personaggi realistici: caricamento dei modelli .glb, ricolori delle skin, retargeting della posa e IK delle braccia
js/stove.js     stufe a legna delle casette: fuoco, fumo dal comignolo, luce calda, calduccio che cura
js/cars.js      auto realistiche: carrozzeria, vernice metallizzata, vetri, ruote, fari e targhe
js/weather.js   nebbia d'altezza, montagne all'orizzonte, neve / foglie / polvere locali
js/events.js    eventi della partita (rifornimento, meteoriti, nebbia, bufera, ora d'oro, bassa gravità)
js/props.js     modelli low-poly (alberi, rocce, legna, mattoni, barili, casetta) e caricamento dei .glb
models/         cartella facoltativa per i file .glb originali
js/character.js modelli 3D di personaggi, armi, deltaplano e bus
js/chartex.js   texture dei personaggi: tessuti, fantasie, pelle, capelli
js/items.js     consumabili 3D (bende, medikit, scudi) e loro icone
js/models3d.js  Battle Bus e forziere in 3D
js/audio.js     effetti sonori sintetizzati
js/main.js      ciclo di gioco, giocatore, arrampicata, IA dei bot, combattimento, HUD
js/site.js      scene 3D e animazioni del sito
js/transition.js transizione animata fra sito e gioco
vendor/         Three.js r187 (+ addons di post-processing) e PeerJS 1.5 (licenza MIT)
```
