# Gravity Café — prima persona e gravità zero

Gioco arcade 3D a schermo pieno: prepara caffè in una stazione spaziale, soddisfa gli ordini prima che scadano e prova a non perdere la tazza quando salta la gravità. Progetto autonomo, indipendente dal toolkit GEO Optimizer.

## Giocare senza server: un solo file HTML

La versione autonoma è **`downloads/Gravity-Cafe.html`**. Scaricala e aprila con doppio clic in Chrome/Edge desktop (browser con WebGL 2 e accelerazione grafica). Non servono Node.js, terminale, connessione Internet, un account o un host: JavaScript, stile, font e tutti i GLB sono incorporati nel file (~13 MB). Tutte le otto stazioni, co-op locale, controller e audio restano disponibili. Per il mouse puoi usare il trascinamento se il browser limita il pointer lock sui file locali.

Un **link pubblico** richiede comunque hosting statico; l’HTML autonomo elimina invece la necessità di ospitare o avviare il gioco per giocare in locale. Su smartphone l’apertura di HTML scaricati dipende dalle restrizioni del sistema/browser. I record su `file://` dipendono dalle impostazioni di storage del browser; se lo storage è negato il gioco resta funzionante.

Per rigenerare il file da sorgente:

```sh
npm ci
npm run build:standalone
npm run test:offline
```

Il test dedicato apre realmente `file://`, disconnette la rete e verifica caricamento dei tre GLB incorporati, scelta delle stazioni, presa della tazza, estrazione e pausa, senza richieste HTTP. `downloads/` è un output generato, escluso dal versionamento. La normale build web usa percorsi relativi e può essere servita anche in una sottocartella statica.

## Avvio per sviluppatori

Node.js 22, browser con WebGL 2 e accelerazione grafica consigliata.

```sh
cd gravity-cafe
npm ci
npm run dev -- --port 5173
```

Premi **APRI IL BAR**, aspetta il conto alla rovescia e clicca nella scena per catturare il mouse. **Trascinare nella scena funziona anche senza pointer lock**, incluso nelle anteprime in iframe che lo vietano. Su touch, trascina direttamente nella visuale. Esc mette in pausa; il pulsante nell’angolo in basso a destra attiva il fullscreen del browser.

## Prima persona

Durante la partita ciascun giocatore ha una `PerspectiveCamera` alla testa del proprio barista. La posizione segue un punto di ancoraggio dell’osso `Head` del GLB, con un’altezza di riserva di 1,6 m durante il caricamento. Le animazioni non impongono la direzione dello sguardo. Il modello del giocatore viene nascosto **solo nella sua visuale**; il compagno rimane visibile. La tazza trasportata ha una rappresentazione dedicata davanti alla propria camera.

Il menu conserva una camera cinematica ortografica: non è la camera usata per giocare.

### Comandi

| Azione | P1 | P2 locale | Controller per giocatore |
| --- | --- | --- | --- |
| Muoversi rispetto allo sguardo | WASD | Frecce | Stick sinistro |
| Guardare | Mouse / trascinamento; tastierino 4/6/8/2 | I/J/K/L; trascinamento nella propria metà | Stick destro |
| Prendere / preparare / servire | E | Invio | A |
| Lanciare / scattare a mani vuote | Spazio | 0 | X |
| Lasciare cadere | Q | — | — |
| Frenare tutte le componenti della velocità in 0G | Shift | Shift condiviso | B |
| Spinta lungo alto/basso locale in 0G | R / F | PagSu / PagGiù | Y / LT |
| Rollio in 0G | Z / C | U / O | LB / RB |
| Pausa | Esc | Esc | Pulsante a schermo |

### Sei gradi di libertà in 0G

La traslazione usa tre componenti di velocità: avanti/indietro, destra/sinistra e alto/basso **locali al corpo**. Anche una spinta in avanti segue l’inclinazione dello sguardo. Rotazioni locali in quaternioni consentono imbardata, beccheggio e rollio, fino a volare capovolti senza blocchi agli angoli verticali. Senza input mantieni l’inerzia; Shift/B frena su tutti e tre gli assi.

Al ritorno della gravità recuperi gradualmente l’orizzonte, il movimento torna sul piano e cadi verso il pavimento o il bancone sottostante. I bordi, il soffitto, i banconi e i contatti tra baristi correggono posizione e velocità; in 0G i contatti tra giocatori trasferiscono anche quantità di moto verticale.

## Mirino e orientamento

**E non è più un tasto basato soltanto sulla vicinanza.** Un `Raycaster` parte dal centro della camera, fino a 3,4 m:

- il mirino diventa verde, compare il nome del bersaglio e viene evidenziato il suo volume;
- puoi puntare macchina del caffè, distributore, consegna attiva, tazze lanciate, ascensori o liane;
- il primo collider decide l’interazione: banconi, muri e piattaforme impediscono le interazioni attraverso gli ostacoli;
- una tazza vicina ma dietro le spalle non viene recuperata premendo E.

Sopra le postazioni ci sono **ologrammi 3D animati** e cerchi di destinazione. Indicatori nella propria visuale mostrano CAFFÈ / LATTE / CONSEGNA e distanza, restando ai bordi quando la destinazione è fuori campo. L’obiettivo consigliato è dorato. La consegna mobile dello Zen e quella che cambia piano nel Nucleo aggiornano anche bersagli e navigazione.

## Ricette e obiettivo

1. Guarda la macchina e premi **E** per prendere una tazza.
2. Un altro **E** avvia l’espresso: resta vicino per **1,35 s**.
3. Al distributore, E aggiunge il latte (**1 s**), poi la schiuma (**0,85 s**) per il cappuccino.
4. Guarda il bancone di consegna e premi E con una ricetta richiesta negli scontrini.
5. Spazio lancia, Q lascia cadere; punta una tazza lanciata e premi E per recuperarla. Gli urti forti rovesciano il contenuto in gocce che possono spingere i giocatori.

Il puntamento è richiesto per **avviare** la preparazione. Durante l’estrazione puoi guardarti attorno, ma devi mantenere tazza, vicinanza e posizione: allontanarsi, anche in quota, interrompe il lavoro. Pausa e modali congelano preparazioni, ordini, simulazione e timer.

- Stelle a **450 / 900 / 1.500 punti**.
- Ricompense per consegna da 100 a 200 punti con la combo.
- Ordine scaduto: −25 punti e combo interrotta.
- **5 clienti persi:** chiusura anticipata.
- Fine turno: almeno una stella per riuscire, altrimenti riprova.
- Allenamento: nessuna scadenza del turno o degli ordini, ma gravità e preparazioni rimangono attive. Qualsiasi uso dell’allenamento esclude quel turno dai record.

## Sala, postazioni e ritmo

La pianta principale misura **22 × 16 m**; pavimento, scacchiera, banconi, finestre, cornice vetrata e soffitto seguono lo stesso ingrandimento planare, senza ingrandire i baristi. I limiti del centro del corpo sono ±10,3 / ±7,25 m. Le mappe circolari hanno raggio giocabile **8,5 m**: ascensori, terrazze, postazioni e orbite condividono `MAP_SCALE`, mantenendo bersagli, fisica e grafica coerenti.

La macchina del caffè ha acciaio/rame, manometro, portafiltri, vaschetta a griglia, serbatoio traslucido e tazze impilate. Il latte ha cartoni etichettati, display che cambia durante la preparazione, bricco e lancia vapore. La consegna ha vassoio dorato antiscivolo, campanello, schermo con gli ordini attivi e vetrina con croissant e ciambelle. Vapore e flussi seguono le preparazioni reali. Venature, marmo, metallo spazzolato, griglie e cartelli sono `CanvasTexture` locali; anche l’ambiente riflettente è generato in locale, senza immagini scaricate.

- Ordini normali: **95–120 s**, con **+20 s** per ricette complesse o doppie.
- Turni delle prime cinque stazioni: **240 / 240 / 210 / 300 / 300 s**; nuove stazioni: **270 / 300 / 300 s**.
- Dopo **45 s**, alcuni nuovi clienti sono **VIP**: bordo dorato, pazienza al 72%, ricompensa ×2 e penalità di 50 punti invece di 25. Contano comunque come un solo cliente perso.
- Dopo **75 s**, può essere richiesto il **Doppio espresso**: premi E alla macchina portando un espresso per una seconda estrazione da 1,1 s.
- Dopo **90 s**, possono arrivare **ordini doppi**. Ogni consegna resta spuntata sullo stesso scontrino; ricompensa e conteggio dei serviti arrivano solo dopo entrambe le bevande. L’ordine completo vale due ricompense base. Non si può consegnare due volte la stessa voce.
- Puntando un cliente consegni **solo al suo scontrino**; il vassoio sceglie invece il primo ordine compatibile. Colori, numeri e bevande collegano badge 3D e interfaccia.
- Sotto il **25% di pazienza**, il cliente usa `Hurry`, si agita e il badge si illumina di rosso. In 0G uno sbuffo ogni tre secondi può smuovere gli oggetti vicini. Alla consegna completa esulta con `Cheer` e si allontana, mentre arriva il successivo.

I personaggi dei clienti sono riutilizzati in un pool limitato: tre attivi più quelli in uscita, senza accumulare modelli o mixer a ogni ordine. Animazioni, arrivi, uscite, pazienza e sbuffi rispettano la pausa; l’allenamento continua a escludere i record.

## Co-op split-screen e touch

Due giocatori, **due vere camere**, due mirini e due inventari: split sinistra/destra, oppure sopra/sotto sugli schermi verticali. Ordini, timer e punteggio sono condivisi. Puoi giocare con tastiera condivisa, due controller, oppure mouse per P1 e controller/tastiera per P2. Le ossa e i mixer delle copie dei personaggi sono indipendenti.

Su touch: pad di movimento, trascinamento per lo sguardo, E, lancio, freno, salita/discesa e rollio. Le aree di contatto sono almeno 44×44 px e hanno feedback alla pressione, cleanup su cancellazione, perdita della capture, pausa o focus. Il pad touch controlla P1; nella co-op P2 usa tastiera/controller e può trascinare nella propria visuale per guardarsi attorno.

## Modelli GLB e animazioni

`src/models.js` usa `GLTFLoader` per caricare tre file **locali originali**, senza CDN:

- `public/models/barista.glb`: barista umanoide riggato (~4,6 MB), proporzioni adulte, uniforme continua, grembiule e cappello aderente;
- `public/models/customer.glb`: cliente umanoide riggato (~4,6 MB), corpo continuo senza giunture a sfera, volto con lineamenti integrati, occhi piccoli incassati e accessori discreti;
- `public/models/cup.glb`: ceramica, manico, piattino, crema, latte art, schiuma 3D e vapore; le superfici della bevanda cambiano con la ricetta.

Ogni personaggio ha uno `SkinnedMesh`, uno scheletro e le clip **Idle / Walk / Float / Cheer / Hurry**. `SkeletonUtils.clone` evita scheletri condivisi; un `AnimationMixer` per istanza aggiorna e miscela le clip con cross-fade di 0,25 s. I clienti attendono sul bordo anteriore del servizio, senza essere nascosti dai mobili: un personaggio per ogni scontrino, con colore corrispondente all’avatar e fumetto 3D con ricetta e pazienza. In 0G il compagno segue l’orientamento del corpo e usa la clip di fluttuazione.

Baristi e clienti usano anatomia continua a proporzioni adulte e materiali PBR; le tazze mantengono una geometria più leggera. La nuova direzione abbandona l’aspetto da pupazzo assemblato. Restano modelli procedurali, non scansioni fotorealistiche o motion capture. Sono generati fuori dal runtime e importati dal gioco come GLB. Per rigenerarli:

```sh
npm run models:generate
```

Lo script sorgente è `scripts/generate-models.mjs`. Per sostituirli con modelli d’autore, conserva nomi delle clip, scala in metri, osso `Head` e nodo `Fill` della tazza, oppure adatta `models.js`. Il fallimento del caricamento mantiene una geometria di riserva giocabile e mostra un avviso senza bloccare la partita.

## Otto stazioni

1. **Orbita tranquilla:** 1G/0G ogni 32 s, cucina base.
2. **La stazione rotante:** gravità ogni 25 s; il movimento e la camera rimangono coerenti con il riferimento locale della cabina.
3. **Un caffè nel vuoto:** gravità ogni 22 s e attrazione verso il piccolo buco nero.
4. **Il Nucleo in Ebollizione:** tre quote e ascensori puntabili con E, ciclo 0 → 1 → 2 → 0. Caffè al piano 1, latte al 2, servizio al piano 0. Guasto ogni 45 s per 15 s: 0G, piano terra evacuato e consegna al piano 2. R/F permette volo continuo, non più soltanto cambi di quota discreti; le terrazze ad anello hanno collisioni verticali, mentre il pozzo centrale lascia passare.
5. **L’Osservatorio Zen:** cucina centrale e consegna orbitante. Campi normale, nord, soffitto e radiale cambiano ogni 18 s; il volo rimane controllabile, con forze aggiuntive sul piano. Le liane danno slancio e liberano spore quando urtate in velocità.

6. **Il Crogiolo Magnetico** (`MAGNETIC`): **270 s**, alternanza 1G/0G ogni **20 s**. Il campo cambia fra Nord/Sud ed Est/Ovest; nel ciclo successivo inverte l’ordine per esporre tutte e quattro le direzioni anche in 0G. Una forza costante agisce su corpi e tazze libere. Cinque piastre ciano (tre a terra, due sui banconi) smorzano la velocità sui tre assi alla quota della piastra. Cucina a croce, piloni con avvolgimenti rotanti, indicatori dei poli attivi e scariche elettriche.
7. **La Serra Criogenica** (`CRYO`): **300 s**, gravità ogni **24 s**. Le passerelle a croce hanno attrito ridotto del **75%**, anche in 1G; Shift aiuta a frenare. I getti di azoto sono attivi per 1,4 s ogni 8 s e sollevano giocatori e tazze. In 0G sette cristalli orbitanti separano e riflettono le tazze in contatto, senza moltiplicarne l’energia. Cupola trasparente con nervature, serbatoi N₂, condensatori brinati e barriere termiche fisiche ai lati del servizio.
8. **Il Reattore a Impulsi** (`REACTOR`, **Difficile**): **300 s**, impulso ogni **16 s**, avviso visivo e tre segnali sonori nei **3 s precedenti**. L’impulso radiale viene applicato una sola volta per ciclo, a entrambi i giocatori e alle tazze libere; banconi e paratie interrompono la linea dal nucleo e offrono riparo. Seguono **12 s di 0G** con micro-turbolenze. Il ponte di consegna è a **1,3 m**, accessibile anche in 1G dalla rampa centrale. Il nucleo e le paratie hanno collider e occludono le interazioni.

### Archetipi e materiali dei clienti

La gerarchia rimane **Hips → Spine → Head / ArmL / ArmR**, con **LegL / LegR** sotto Hips: sette ossa e cinque clip compatibili con il sistema esistente. `Idle` aggiunge respirazione del torso, `Walk` e `Hurry` oscillazione della testa; sopracciglia indipendenti si aggrottano in `Hurry` e si rilassano dopo. Le geometrie statiche del corpo sono raggruppate per materiale per contenere le draw call.

- **0 — tecnico:** visore trasparente, pelle desaturata e giacca verde scuro.
- **1 — esploratore:** casco aperto, pelle ambrata e giacca tortora.
- **2 — viaggiatore:** volto scoperto, pelle malva tenue e giacca prugna scuro.
- **VIP:** sciarpa e mantello dorati aggiunti all’archetipo, rimossi correttamente quando il personaggio del pool viene riutilizzato.

Pelle satinata `MeshPhysicalMaterial` con roughness **0,48**, senza clearcoat plastico: micropori distribuiti in modo deterministico e canali **bump / roughness separati**. I tessuti di tute, colletto e grembiule hanno una propria trama intrecciata, due mappe dedicate, bump lieve, roughness **0,88–0,92** e sheen diffuso; non riutilizzano il rumore della pelle. Le quattro `DataTexture` lineari da 128×128 sono condivise, ripetute e filtrate con mipmap, senza immagini esterne. Gli accessori metallici conservano metalness **0,75**.

`scripts/sculpted-character.mjs` sostituisce la vecchia costruzione a pezzi. Una superficie implicita viene estratta e saldata offline con marching cubes: spalle, ascelle, torso, bacino e gambe appartengono a **un solo guscio connesso**, senza sfere sovrapposte per muscoli o ginocchia. La divisione fra giacca e pantaloni è di materiale, non una separazione della silhouette. I pesi sfumano tra bacino, colonna e arti, preservando le sette ossa e tutte le clip.

Le proporzioni sono state riequilibrate senza schiacciare o stirare l’intero personaggio: testa leggermente più larga e meno lunga, collo più corto, spalle meno larghe, avambracci più vicini al corpo e gambe meno sottili. Mani e cuffie seguono i nuovi punti anatomici; il grembiule resta davanti alle cosce. La correzione dedicata ai clienti è in `scripts/customer-anatomy.mjs`: riallinea anche i pivot delle sette ossa e gli accessori. Testa e collo sono bilanciati rispetto alle spalle, bacino e gambe hanno più volume e le mani hanno lunghezza di circa 16 cm, senza restare nascoste nelle maniche. I polsini sono pesati sulle braccia, mai sulle gambe: questo evita deformazioni innaturali durante Walk/Cheer. Il barista mantiene il proprio asset indipendente.

Il volto è un unico reticolo da 112×96 sezioni, con proporzioni adulte: naso, ponte nasale, zigomi, orbite, labbra, mento, orecchie e collo sono deformazioni continue dello stesso tessuto, non mesh sferiche appoggiate al cranio. Gli occhi a mandorla e le iridi sono piccoli e incassati. Sono stati rimossi antenne, rotule metalliche, bracciali e occhi giganti. Mani e uniforme si separano soltanto ai polsini, come vestiti reali. Colori per vertice aggiungono sfumature di pelle, labbra, cuciture e suole senza moltiplicare i pezzi. Il grembiule segue bacino e colonna; lo scattering dei tessuti è approssimato dal modello PBR sheen, non da simulazione volumetrica SSS o stoffa fisica.
 Ogni istanza ha i propri materiali, mentre geometrie e texture sono condivise. L’aspetto viene applicato anche se il GLB termina il caricamento dopo l’assegnazione dell’ordine. Gli avatar SVG riprendono volto, incarnato e accessori dei tre archetipi.

## Test e build

```sh
npm test
npm run build
npm run preview
npx playwright install chromium
npm run test:browser
```

I test unitari includono mappe procedurali dei personaggi, connettività effettiva del guscio saldato, proporzioni testa/spalle, normali del volto orientate all’esterno, pesi di skinning normalizzati, materiali tessili e rig di entrambi i GLB, oltre a stato, ricette, collisioni, otto mappe, polarità e ancoraggi, attrito del ghiaccio, getti/cristalli, cicli e ripari del reattore, rig/clip del GLB generato, isolamento dei materiali, accessori VIP, record, audio/touch e matematica della prima persona: rotazioni locali, spinta relativa allo sguardo, rollio, frenata 3D, quota, gravità, contatti e occlusione del raycast.

I test Playwright usano simulazione, input e caricamento GLB reali. Disabilitano soltanto il draw GPU per avanzare deterministicamente il clock, e verificano partite complete, pausa, recupero, co-op, GLB/mixer, split-screen, controller, touch e fallback degli asset. Le nuove missioni verificano anche preparazione e servizio in ciascuna mappa, ancoraggio, sollevamento reale in 1G, riflessione delle tazze, conto alla rovescia, impulso singolo, quota del ponte e accessori del cliente caricato. Gli hook vengono inseriti intercettando i moduli nei test, mai nel bundle di produzione. Il rendering viene verificato separatamente nell’anteprima.

Per server o Chromium già disponibili: `PLAYWRIGHT_BASE_URL` e `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## Note tecniche e ambito

Fisica a passi fissi di 1/60 s; clock del turno separato dal rendering. Materiali condivisi, batch statici e risoluzione adattiva riducono il carico. Audio Web Audio ripreso esplicitamente se sospeso. Record isolati in `gravity-best:<tag stazione>`; errori audio/storage non interrompono il gioco.

La navigazione in 0G è tridimensionale a sei gradi di libertà, ma le collisioni rimangono **arcade**, con collider semplificati e assistenza di evacuazione nel Nucleo: non un simulatore rigido/fluidodinamico completo. I clienti sono animati e mobili ma non hanno pathfinding avanzato. Multiplayer solo locale, nessun server o matchmaking. L’intero gioco funziona senza asset o servizi remoti.

### Reference alieno / astronauta

La revisione `grey-alien-eva-v1` interpreta le reference fornite con asset procedurali originali: cranio alieno più ampio sulle tempie, mento affusolato, occhi scuri a mandorla, rilievi frontali; tuta pressurizzata avorio con pieghe scolpite, zaino, pannello toracico, raccordi e tubi d'ossigeno. L'archetipo astronauta indossa un casco completo con guarnizione e visiera scura. Nessuna foto, filigrana o insegna NASA viene incorporata. Il barista conserva grembiule e identità. `scripts/reference-details.mjs` genera equipaggiamento e volume della tuta; accessori e visiera seguono il rig e il pooling.

### Pubblicazione Vercel

- URL produzione: https://gravity-cafe-five.vercel.app
- Progetto: `gravity-cafe` (team `acme-6428`).
- Release del gioco: commit `72bdd89cf23c5af571820110373fe48ee0b5baab`.
- Deployment riuscito: `dpl_6f2w4KZhRdrsiNRZR3ngdfnQ2e3X` (`READY`, alias assegnato; pagina pubblica verificata).

Poiché il collegamento Vercel–GitHub non era configurato, il deployment usa un piccolo bootstrap di testo, non asset binari inline: scarica l'archivio pubblico del commit esatto da GitHub, esegue `npm ci` e la build Vite nel sottoprogetto, quindi pubblica solo `dist/`. Modello riutilizzabile: `scripts/vercel-source-build.mjs`. Nel payload del connector il bootstrap è salvato come `gravity-cafe/deploy.mjs`, rispettando la Root Directory del progetto. Comandi per **quel payload**: installazione `node deploy.mjs install`, build `node deploy.mjs build`, output `dist`. Aggiornare lo SHA di release per le pubblicazioni successive. Per tornare al deploy Git diretto, collegare GitHub e ripristinare `npm ci` / `npm run build` con root `gravity-cafe`.
