// ─────────────────────────────────────────────────────────────
//  Cartello delle novità (lobby): ultime versioni del gioco
// ─────────────────────────────────────────────────────────────
export const NEWS_VERSION = 'v47';

export const NEWS = [
  {
    v: 'v47', title: 'Caricamento molto più veloce', color: '#7ee0a1', icon: '⚡',
    items: [
      'Il gioco non resta più fermo al 92%: le foto delle texture si scaricano insieme al resto invece di bloccare l’avvio fino all’ultima immagine',
      'Meno della metà dei dati da scaricare (circa 7 MB invece di 16): texture in formato WebP alla risoluzione che il gioco usa davvero, modelli dei personaggi senza animazioni inutilizzate, three.js compresso',
      'Tutti i file partono subito in parallelo (prima si scoprivano uno dopo l’altro) e la schermata con l’illustrazione appare in un attimo',
      'Preparazione delle texture più rapida: le normal map e le foto si elaborano in memoria normale invece di passare avanti e indietro dalla scheda video',
      'Nella barra di caricamento ora vedi quante texture sono arrivate (per esempio 12/18)',
      'Grafica identica alla v46',
    ],
  },
  {
    v: 'v46', title: 'Ancora più foto: roccia, neve, sabbia e metallo', color: '#9fb4c7', icon: '🪨',
    items: [
      'Rocce e colline rocciose con la foto di vera roccia di granito, crepe e licheni, proiettata da tutti i lati così non si stira sui fianchi',
      'Montagne e villaggi alpini: neve fotografica con la crosta e le impronte, strade innevate vere e piazze con i sampietrini che spuntano dalla neve',
      'Spiagge, deserto e Colosseo con sabbia vera increspata dal vento',
      'Città moderne in cemento a vista con i fori dei casseri, baracche e camion del far west in lamiera ondulata arrugginita',
      'Dentro le case: parquet vero a spina, porte in legno verniciato scrostato; i tetti grigi e blu ora sono in ardesia vera, quelli rossi restano in coppi',
      'Le nuove immagini pesano circa 2 MB e gli FPS restano quelli della v44',
    ],
  },
  {
    v: 'v45', title: 'Texture fotorealistiche', color: '#c9b48a', icon: '🧱',
    items: [
      'Tutto il mondo ha nuove texture fotografiche, nello stile di un vero borgo medievale: pietra a blocchi irregolari con muschio e licheni, intonaco consumato con crepe e macchie, mattoni rossi anneriti, coppi di terracotta con il muschio, assi di legno con venature e nodi',
      'Strade e piazze vere: sampietrini di granito con l’erba negli interstizi, asfalto con crepe e ghiaietto, marciapiedi a lastre di pietra, terra battuta con i sassolini, sabbia e passerelle di legno',
      'Prato fotografico (erba, trifoglio e zolle di terra) e terreno con la grana vera dei sassolini; sfuma con la distanza, così non si vede la ripetizione',
      'Castelli, torri, camini e zoccoli delle case in pietra vera; le case colorate mantengono il loro colore, ma su intonaco vero; facciate delle città, parquet, casse e il Colosseo con grana e venature realistiche',
      'Il rilievo (normal map) viene dalle foto: le fughe fra le pietre e i mattoni sono incavate e catturano la luce del sole',
      'Le immagini pesano circa 3 MB in tutto e si scaricano insieme al gioco; se una non arriva, quella superficie torna alla texture disegnata di prima',
    ],
  },
  {
    v: 'v44', title: 'Grafica di nuovo piena, FPS comunque alti', color: '#ffd166', icon: '🎨',
    items: [
      'La Qualità automatica era troppo aggressiva: abbassava la risoluzione fino a un terzo e spegneva ombre, bloom, erba e anti-aliasing. Ora toglie solo ciò che quasi non si nota (occlusione ambientale, MSAA → FXAA, ombre ultra → alte) e, se proprio serve, semplifica le ombre e dirada un po’ l’erba. Non spegne più ombre, bloom e distanza visiva e non tocca la risoluzione',
      'La grafica torna piena appena il gioco supera i 42 FPS (prima servivano 50), e ogni nuova partita riparte con la grafica completa',
      'Risoluzione dinamica più gentile: interviene solo sotto i 40 FPS (prima sotto i 48) e non scende mai sotto il 75% (prima fino al 50%), così l’immagine resta nitida',
      'Le porte delle case lontane si vedono di nuovo fino a dove arriva il dettaglio delle case',
      'Restano tutti gli alleggerimenti della v43 che non si vedono: personaggi fuori schermo non disegnati, dettagli ridotti solo da lontano, bot lontani più leggeri, icone preparate solo nei menu',
    ],
  },
  {
    v: 'v43', title: 'Più leggero: almeno 30 FPS', color: '#7dff9a', icon: '⚡',
    items: [
      'Nuova opzione Qualità automatica (minimo 30 FPS), attiva di base in Impostazioni › Grafica: se il gioco scende sotto i 30 FPS abbassa da sola la risoluzione e poi, un passo alla volta, occlusione ambientale, antialiasing, ombre, bloom, erba e distanza visiva. Quando torni sopra i 50 FPS ripristina tutto. Le tue impostazioni non vengono toccate e un avviso ti dice cosa è cambiato',
      'La risoluzione dinamica può scendere fino al 50% nei momenti più pesanti',
      'I personaggi fuori dallo schermo non vengono più disegnati, quelli lontani hanno meno dettagli, non fanno ombra e si animano meno spesso. Il tuo personaggio e chi ti è vicino restano identici',
      'Porte più leggere: maniglie e placche in un unico pezzo, e le porte lontane non vengono disegnate',
      'Il bottino a terra fa ombra solo vicino a te',
      'I bot lontani da tutti i giocatori pensano un po’ meno spesso, e la ricerca di case e tetti è molto più veloce',
      'Le icone delle armi si preparano solo nei menu, mai durante la partita',
      'Risultato in una partita con 100 giocatori: circa 3,5 volte meno oggetti disegnati per fotogramma (da circa 2700 a circa 760), 6 volte meno triangoli e metà del tempo di calcolo per fotogramma',
    ],
  },
  {
    v: 'v42', title: 'Scivolate, scavalchi e il Colosseo in verticale', color: '#ff9a3c', icon: '🏃',
    items: [
      'Scivolata: mentre corri premi C. Ti abbassi quasi a terra, mantieni lo slancio (in discesa acceleri) e puoi curvare un po’; con SPAZIO salti via senza perdere velocità. Costa un po’ di resistenza',
      'Scavalco automatico: correndo contro un muretto, una cassa o un gradone del Colosseo (fino a 1,25 m) lo superi da solo senza fermarti; con SPAZIO fino a 1,75 m, e saltando verso un bordo ti aggrappi e sali',
      'Saltare a ripetizione non conviene più: ogni salto costa resistenza, i salti di fila sono più bassi, in volo la mira è molto imprecisa e torna normale 0,4 s dopo l’atterraggio. Vale anche per i bot',
      'Colosseo: quattro scalinate diagonali portano dalla sabbia al podio e su per tutte le gradinate, e ad ogni ingresso una scala di legno sale dall’ultima gradinata fino in cima al muro. Lassù vedi tutta l’arena, ma ti vedono tutti',
      'Nuovi oggetti tattici: Trampolino di lancio (piazzalo e saltaci sopra: vola in alto e il deltaplano si apre da solo) e Trappola a spuntoni (75 danni e rallenta chi ci passa sopra, invisibile da lontano). Tieni premuto G per vedere dove finiscono',
      'Bottino a terra più utile: niente più munizioni sparse di un tipo a caso né mucchietti di legna. Solo armi con le loro munizioni, cure, scudi e oggetti tattici',
      'Ombre del sole più nette e stabili: niente più bordi che tremolano camminando, e più dettaglio dove guardi',
      'Le esplosioni e i colpi alla testa fanno un bagliore (con il bloom attivo, grafica Alta e Ultra)',
      'Con poca vita i bordi dello schermo si scuriscono, i colori si spengono e si sente il battito del cuore',
      'Proiettili diversi a seconda di cosa colpiscono: scintille sul metallo, polvere e schegge sulla pietra, zolle di terra, schegge di legno, sbuffi di sabbia e neve, ciascuno con il suo suono',
    ],
  },
  {
    v: 'v41', title: 'Granate, segnalazioni e case più grandi', color: '#6ad8ff', icon: '💣',
    items: [
      'Oggetti da lancio: granata a frammentazione (esplode dopo 2,5 s, rompe muri e strutture), fumogeno (una nube densa che nasconde anche ai bot) e granata a impulso (spinge via chi è vicino; lanciata sotto i piedi ti catapulta in aria senza danni da caduta). Tieni premuto G per vedere la traiettoria, rilascia per lanciare, H cambia oggetto. Rimbalzano sui muri e sul terreno',
      'Lasciare un oggetto ora è X (G serve per lanciare)',
      'Segnalazioni per la squadra: Z o clic della rotellina. Sul nemico lo segnala in rosso e lo segue, sul bottino ne scrive il nome, altrove «Andiamo qui» (doppio tocco: «Pericolo»). I compagni bot ci vanno e segnalano da soli i nemici che vedono',
      'Quando ti colpiscono un arco rosso attorno al mirino indica da dove arriva il colpo, e la visuale trema in proporzione al danno',
      'Bot più furbi: con poca vita corrono dietro un riparo (a volte con un fumogeno) e si curano lì, se stanno per perdere scappano a zigzag, aggirano di lato chi si nasconde (i compagni da lati opposti) e lanciano granate a chi resta fermo o dietro i muri',
      'Passi diversi su erba, pietra, legno, metallo, neve, sabbia e acqua; senti anche i passi degli altri, più forti quando corrono, a destra o a sinistra a seconda di dove sono',
      'Costruzione: oltre al muro ci sono pavimenti e rampe. In modalità costruzione 1 muro, 2 pavimento, 3 rampa (o R e la rotellina); guardando in alto il pavimento va un piano più su',
      'Fine partita con le statistiche complete: precisione, colpi alla testa, uccisione più lontana, danni subiti, cure, distanza percorsa, muri, forzieri e oggetti lanciati',
      'Il mirino diventa verde sui compagni di squadra',
      'Zoom in mira regolabile per ogni classe d’arma (Impostazioni › Controlli); pistole e pompa entrano in mira più in fretta, i cecchini con calma',
      'Case più alte e più larghe, città più grandi, mobili un po’ più grossi. Saltando dentro casa non si viene più spinti fuori dai muri: si sbatte la testa sul soffitto',
      'Salto rifatto: stacco con una gamba, gambe raccolte in volo, braccia per l’equilibrio e piedi che cercano il suolo nelle cadute lunghe',
      'Gli Artigli restano attaccati ai polsi; Colosseo: nei corridoi sotto le gradinate non si vede più attraverso i muri',
    ],
  },
  {
    v: 'v40', title: 'Stagione 2 · Il Colosseo', color: '#ffcf2e', icon: '🏛️',
    items: [
      'Nuovo pass battaglia con 80 ricompense: una gratis e una premium a ogni livello. Il pass riparte dal livello 1, ma tutto quello che hai sbloccato resta tuo (più un regalo di monete)',
      'Puoi comprare un livello a 150 monete; dopo il livello 40 ogni 1000 XP è un livello bonus da 50 monete; gli oggetti del pass che possiedi già diventano monete',
      'Sei skin nuove: Gladiatore e Imperatore (premium), Arlecchino, Chef Gusto e Sommozzatrice, e la Mummia nel negozio',
      'Cappelli nuovi (alloro, elmo da legionario, paglietta da gondoliere, cappello da chef, tricorno), zaini nuovi (scudo romano, aquila della legione, bombole da sub) e cinque deltaplani',
      'Da telefono: Impostazioni › Disponi i pulsanti per spostare e ingrandire ogni comando, fuoco automatico, mira assistita, trasparenza dei pulsanti e vibrazione',
      'Schermate di caricamento illustrate, con le fasi del caricamento e un consiglio',
      'Installa il gioco dal browser («Aggiungi a schermata Home»): ha un’icona tutta nuova',
    ],
  },
  {
    v: 'v39', title: 'Balletti nuovi e un Gargoyle in carne e ossa', color: '#ff7ab6', icon: '💃',
    items: [
      'Balletti rifatti da zero: si muove tutto il corpo, a tempo di musica. Fianchi che ondeggiano, spalle, ginocchia che si piegano, piedi che restano piantati a terra, testa e mani che seguono il movimento con un attimo di ritardo',
      'Sei balletti: Ballo disco, Saluto, Floss, Esultanza e i nuovi Robot (a scatti) e Running man. Con la tastiera: B li fa girare, oppure 6 7 8 9 0 e il tasto ’ per sceglierli',
      'Il Gargoyle ha un corpo nuovo, scolpito: niente più palle e cilindri ma una pelle unica con muscoli, costole, addominali e tendini che si piega con le articolazioni. Muso da pipistrello con le orecchie lunghe, le sopracciglia, il naso a grugno e le zanne, mani con le dita e gli artigli ricurvi, una criniera folta a ciocche. Si comporta come prima',
      'Colosseo: sopra ai quattro ingressi le gradinate ora sono chiuse, dall’arena non si vede più attraverso il muro',
    ],
  },
  {
    v: 'v38', title: 'Il Colosseo, il Gargoyle e i suoi artigli', color: '#ffb347', icon: '🦇',
    items: [
      'Al centro della mappa c’è il Colosseo: gradinate, archi, tende a strisce e la statua dell’imperatore in mezzo all’arena, con due forzieri sulla sabbia',
      'In alcune partite nell’arena dorme il Gargoyle, un mostro alato con la criniera: si sveglia quando scendi sulla sabbia e non esce mai dal Colosseo. Graffia, colpisce con due mani, gira su sé stesso, balza addosso da lontano e ruggisce contro chi resta sugli spalti. In alto compare la sua barra della salute',
      'Sconfiggilo e lascia gli Artigli (leggendari): colpi infiniti, una combo di quattro attacchi (graffio destro, graffio sinistro, giravolta, doppio colpo) che muove tutto il corpo e, mirando, il balzo. Sono gli stessi attacchi del Gargoyle',
      'Una chiesa barocca in una delle città: facciata con colonne, statue, orologio e due campanili',
      'Forzieri nuovi in legno scuro con borchie di ottone, angoli color crema e la chiusura d’oro a fiamma con il lucchetto',
      'Panchine con le assi arancioni e i fianchi in ghisa nera, fontane in marmo color crema a tre vasche con gli zampilli',
      'Da fermo il braccio che regge l’arma non attraversa più il corpo',
    ],
  },
  {
    v: 'v37', title: '1 contro 1 con gli amici, cielo a pixel e gioco più fluido', color: '#ff6a5a', icon: '⚔️',
    items: [
      'Nuova modalità ⚔️ 1 contro 1: crea una lobby, scegli la modalità e sfida un amico. Niente bot, niente bus: partite subito in una piccola arena con fucile d’assalto, pompa, mitraglietta, mini scudi e bende, e la tempesta si chiude in pochi minuti. Da solo giochi contro un bot che viene a cercarti',
      'Gioco più fluido: gli oggetti a terra lontani non vengono più disegnati pezzo per pezzo (prima costavano più della città intera), le ombre si ridisegnano a frame alterni e gli alberi dettagliati arrivano meno lontano. Fino a metà dei draw call in meno',
      'Risoluzione dinamica (attiva di base, nelle impostazioni grafiche): se il gioco scende sotto i 48 FPS abbassa da sola la risoluzione e poi la rialza quando torna fluido',
      'Cielo nuovo in stile pixel art: sfumatura di blu a bande, strisce di nuvole sottili e grandi nuvole 3D a fumetto con i riccioli e il bordo scuro',
      'Munizioni con le scatole vere: leggere stile Game-Shot blu, medie e pesanti nelle scatole di cartone da caccia, cartucce nella scatola verde Privilege e razzi a fuso con la gabbia gialla (anche quando volano)',
      'Armi impugnate meglio: il calcio sta sulla spalla destra e i gomiti si piegano in modo naturale, quando corri il fucile va in diagonale con la canna giù a sinistra. Niente più braccia “da zombie” che facevano ballare l’arma',
      'Tolti i salici piangenti',
    ],
  },
  {
    v: 'v36', title: 'Borghi medievali, salici e deserto di dune', color: '#ffb84d', icon: '🏡',
    items: [
      'Ingresso nelle lobby degli amici riparato: prima il collegamento usava un solo server ponte che molte reti (fibra con CGNAT, 4G/5G, Wi-Fi di scuola) bloccavano. Ora ci sono più server STUN/TURN, anche sulla porta 443, e tre tentativi, l’ultimo forzando il ponte',
      'Mentre entri vedi a che punto è il collegamento (server, lobby trovata, ponte) e gli errori dicono cosa fare. Se l’host ha una versione diversa del gioco te lo dice chiaramente',
      'Le casette sparse per l’isola sono diventate case da borgo medievale: zoccolo in pietra, tavole consumate, travi a vista, scuri con la croce e tetto spesso di ardesia azzurra',
      'Salici piangenti con la corteccia arancione e le lunghe chiome che scendono fino a terra, soprattutto vicino all’acqua',
      'Cactus saguaro rifatti: fusto costolato, bracci a gomito e spine chiare',
      'Prati punteggiati di fiorellini viola e chiazze più gialle; deserto con dune più alte dalla cresta morbida, sabbia color crema e increspature del vento',
    ],
  },
  {
    v: 'v35', title: 'Mirini al neon e boschi rifatti', color: '#7dff5a', icon: '🌳',
    items: [
      'Mirini ridisegnati con un alone luminoso: fucili a pompa con quattro archi sulle diagonali (il tattico con i pallini, il tamburo che ruota a ogni colpo, la doppietta con le due canne)',
      'Fucili d’assalto con l’anello: d’assalto con le tacche che attraversano l’anello e il punto, a raffica con la croce sottile interna, pesante con l’anello spesso e la croce lunga, mitragliatrice con l’anello spesso e il più al centro',
      'Sette colori del mirino nelle impostazioni: bianco, magenta, blu, azzurro, verde, giallo e rosso',
      'Alberi rifatti da zero: chiome gonfie fatte di centinaia di ciuffi di foglie, con l’ombra all’interno e le cime schiarite dal sole. Querce verdi, alberi verde lime, querce rosse e alberi arancioni (anche nei boschi normali, non solo in autunno)',
      'Abeti a palchi di rami che pendono verso il basso, con la neve sulle punte in montagna',
      'Cespugli fitti di rametti fogliosi con l’interno scuro, alcuni con i fiori. Si muovono ancora con il vento',
    ],
  },
  {
    v: 'v34', title: 'Online sistemato, bot più forti a squadre e niente più scatti', color: '#3ad6ff', icon: '🌐',
    items: [
      'Partite online con gli amici riparate: l’avvio della partita (con 100 giocatori) superava il limite dei messaggi del collegamento e faceva cadere chi entrava. Ora i messaggi grandi si spezzano in pezzi e si ricompongono',
      'L’host aspetta che tutti abbiano caricato l’isola prima di far partire il bus (al massimo 45 secondi), e niente di quello che succede nel frattempo va perso',
      'Un errore momentaneo sul canale non butta più fuori un giocatore dalla lobby: si esce solo se il collegamento si chiude davvero',
      'Difficoltà che cresce con la modalità: in duo, trio e squad i bot nemici mirano meglio, reagiscono prima, vedono più lontano e sparano raffiche più lunghe; online con gli amici ancora un po’ di più. I bot tuoi compagni restano al livello base',
      'Nel riepilogo del menu vedi il livello effettivo (es. “normale +3” in squad)',
      'Prime partite senza scatti: shader di armi, oggetti, forzieri, deltaplani e personaggi vengono preparati prima del lancio dal bus, le icone si disegnano nel menu e i personaggi di tutte le skin si scaricano in anticipo (alla prima partita una breve schermata di caricamento)',
    ],
  },
  {
    v: 'v33', title: 'Tutto si rompe: distruzione, gravità e modalità spettatore', color: '#ff3dbb', icon: '💥',
    items: [
      'Strutture distruttibili: picconate, proiettili ed esplosioni rompono pareti, pavimenti, solai e mobili a pezzi di poco più di un metro (non tutto in una volta). Auto, massi e oggetti si sgretolano e lasciano materiali. Il terreno, le strade e le piazze non si rompono',
      'Gravità: se abbatti tutti gli appoggi a terra di una casa (muri esterni e interni), la struttura crolla. I pezzi cadono, si alza la polvere e restano mucchi di materiali da raccogliere. A ogni nuova partita tutto torna in piedi',
      'Modalità spettatore: quando vieni eliminato la telecamera segue chi ti ha battuto. Con ‹ › (o ← →) guardi gli altri, K torna al tuo eliminatore, trascinando il mouse giri la visuale, Esc apre i risultati e da lì puoi tornare a guardare',
      'L’inventario non mette più in pausa: con TAB aperto la partita continua e ti muovi con WASD (si cambia slot con le frecce)',
      'Mappa con zoom fino a 8×: rotellina, pizzico, + e −, trascina per spostarti, ◎ per tornare su di te. Da vicino si vedono le case e i nomi delle località, con la scala in metri',
      'Armadietto con zoom: rotellina o pizzico verso il punto che vuoi guardare, trascina su e giù per spostarti, tasti per il primo piano sul viso e per la figura intera',
      'Mirini nuovi da zero per i fucili a pompa: pompa a quattro archi con i pallini (gli archi si ritirano mentre pompi), tattico a parentesi, tamburo con l’anello che ruota a ogni colpo, doppietta con le due canne che si svuotano. Ridisegnati anche gli altri: pistole con l’arco, mitragliette a 120°, raffica a tre chevron, cecchino con i mil-dot, lanciarazzi con le distanze',
      'Alberi e cespugli: foglie a ciuffi con foglioline e luce che filtra, corteccia con solchi e nodi. Ogni tanto una raffica di vento attraversa l’isola e piega le chiome, e le foglie fremono',
      'Miniere sistemate: la collina non ha più massi che galleggiano sopra l’ingresso e ora è di roccia vera (prima sembrava legno)',
    ],
  },
  {
    v: 'v32', title: 'Armi nella mano destra, camminata vera e un mirino nuovo', color: '#ffd23a', icon: '🎯',
    items: [
      'Tutte le armi e il piccone ora si tengono con la mano destra (indice sul grilletto), la sinistra regge la canna',
      'Ogni arma ha la sua presa: le leggere (pistole, mitragliette) compatte e alte, a braccia strette; le medie al petto; le pesanti (mitragliatrici, cecchini, lanciarazzi, minigun) basse, col busto girato e i piedi più larghi. La pistola si spara a una mano',
      'Camminata più realistica: passo lento e rilassato, corsa con la fase di volo, scatto lungo; le braccia oscillano in opposizione alle gambe e bacino e spalle ruotano insieme al passo',
      'Cure e scudi animati: le bende si avvolgono attorno all’avambraccio, col medikit ci si inginocchia e si medicano le ferite, il mini scudo si stappa e si beve d’un sorso, la pozione grande si svita e si beve a sorsi con la testa all’indietro (anche chi ha casco o barba non ci passa più attraverso); alla fine scintille verdi o azzurre',
      'Piccone nuovo con texture vera (manico in frassino, impugnatura in cuoio, lama d’acciaio battuto): da fermi appoggiato alla spalla, in corsa che ondeggia, colpo con carica e affondo',
      'Nessuna arma, nessun piccone e nessuna pozione trapassa più le skin: controllato skin per skin in ogni posa',
      'Mirino rifatto: si apre davvero quanto la dispersione (muovendosi, saltando, sparando in fila) e “salta” a ogni colpo; diventa rosso sopra un nemico, sbiadisce fuori portata o mentre scatti; anelli per ricarica, uso di cure e scudi, colpo pronto e caricatore quasi vuoto; forma diversa per ogni famiglia d’armi',
      'Indicatori di colpo nuovi: bianco sul corpo, azzurro sullo scudo, giallo alla testa e una croce rossa con onda quando elimini qualcuno',
    ],
  },
  {
    v: 'v31', title: 'Skin sistemate, animazioni più fluide e accessori più belli', color: '#ff7a4a', icon: '🥷',
    items: [
      'Ninja: la testa non è più invisibile da dietro (il cappuccio copre di nuovo tutta la nuca); la katana ora è appoggiata alla schiena in diagonale, dal fianco sinistro alla spalla destra, con il fodero laccato rosso scuro che si vede sul vestito nero',
      'Samurai: katana e wakizashi infilate nella fascia sul fianco sinistro con l’elsa in avanti (prima spuntavano dietro come due bastoni); il paranuca dell’elmo copre la nuca e lascia libero il viso',
      'Cavaliere e Pirata: le spade pendono dal fianco con l’elsa alla cintura e la lama verso il basso e all’indietro (prima erano al contrario, con l’elsa vicino al ginocchio); l’ascia del vichingo sta più in basso nella cintura',
      'Accovacciarsi è più realistico: da fermi mezzo in ginocchio (una gamba avanti, l’altra indietro sulle punte), camminando passi bassi; i piedi restano sempre a terra anche durante la transizione, che parte e arriva morbida',
      'Salti e atterraggi senza scatti: la posa delle gambe in aria si fonde con quella a terra; da fermi il peso passa lentamente da una gamba all’altra',
      'Cappelli in feltro vero (cowboy, cilindro, mago, basco), cappello di Natale morbido che ricade di lato con pelliccia a ciuffi, texture di cuoio, paglia, lana e cordura più definite; tavola da surf in vetroresina lucida con listello e tre pinne',
      'Deltaplano: in volo la camera sale sopra la vela, così si vede la tela con il suo disegno invece del bordo sottile',
    ],
  },
  {
    v: 'v30', title: 'Accessori su misura, deltaplani nuovi e una lobby nel bosco', color: '#7ad04a', icon: '🪂',
    items: [
      'Cappelli e zaini calzano davvero: si misurano testa e schiena di ogni personaggio, così niente più cappelli che fluttuano o capelli che bucano la calotta, e gli zaini aderiscono alla schiena (anche sopra armature e tute)',
      'Cappelli rifatti: cowboy con la piega e la tesa in cuoio rialzata, paglietta intrecciata con nastro e fiocco, cilindro in feltro, cappello da mago floscio con stelle, corona d’oro con gemme, elmo vichingo rivettato con corna ricurve, cuffie con archetto, padiglioni e microfono',
      'Zaini rifatti: chitarra acustica in legno vero (rosetta, tasti, meccaniche), spada nel fodero di cuoio, jetpack con serbatoi e spie, ali d’angelo di piume vere, ali di drago con dita e membrana venata, scudo e tavola in legno',
      'Deltaplani nuovi: vela bombata a doppia superficie con stecche e bordo a festoni, chiglia, king post con i cavi, trapezio con le manopole, imbrago e alette; ogni vela ha il suo disegno (fiamme, tigre, notte stellata, arcobaleno, raggi d’oro…)',
      'La lobby ora è un angolo della mappa: prato col sentiero e la staccionata, boschetto, capanno con la legna, rocce, fiori e lucciole, colline e montagne nella foschia, nuvole e il bus della battaglia che passa in cielo',
    ],
  },
  {
    v: 'v29', title: 'Animazioni nuove e 6 armi in più', color: '#4ad0ff', icon: '🏃',
    items: [
      'Le armi non trapassano più il personaggio: il calcio va alla spalla, il lanciarazzi poggia sulla spalla, la minigun si tiene all’anca e le mani stanno sull’impugnatura in ogni posa (mira, corsa, ricarica, rinculo)',
      'Corsa con l’arma di traverso davanti al petto, pistola bassa in una mano, balestra puntata verso terra',
      'Ricarica vera: la mano va al caricatore, alla tasca sul fianco e torna sull’arma',
      'Passo più naturale: tallone che tocca per primo, spinta di punta, bacino che ondeggia, in corsa il tallone sale; arrampicata con mani che cercano l’appiglio e corpo che oscilla',
      'Nuove armi: Mitragliatrice leggera (nastro da 60), Doppietta, Pistola pesante, Balestra silenziosa (il dardo cade, mira più in alto), Lanciagranate a tamburo (colpi a parabola) e Mitraglietta silenziata',
    ],
  },
  {
    v: 'v28', title: 'Le skin si riconoscono!', color: '#ff5a4a', icon: '🐉',
    items: [
      'Drago Rosso: pelle a scaglie con ventre a piastre, muso, corna, occhi da rettile, cresta di spine, ali membranose e coda',
      'Ninja: cappuccio con fessura per gli occhi, maschera, fascia rossa, fasce su braccia e gambe e katana sulla schiena',
      'Samurai con armatura laccata, elmo con mezzaluna d’oro e maschera · Cavaliere in armatura d’oro con elmo chiuso, pennacchio, mantello e spada',
      'Astronauta con casco e zaino · Pirata con tricorno, benda e giacca · Vichingo con elmo cornuto, pelliccia e scudo · Robot di metallo · Spettro di ghiaccio · Banana vera · Scienziata col camice',
      'Tutto si muove con le animazioni (corsa, mira, salti) e non servono download in più',
    ],
  },
  {
    v: 'v27', title: 'Ogni città ha il suo tema', color: '#e8b05a', icon: '🏘️',
    items: [
      'Città tutte diverse: villaggio alpino innevato con chalet e campanile, paese del deserto fatto di camion abitabili con piccole miniere, borgo di mare su palafitte, fattoria con fienili e campi, castello cinto da mura',
      'Strade a tema: sterrato e passerelle di legno nel far west, neve battuta in montagna, sabbia al mare, ciottoli nel castello',
      'Danni da caduta: oltre i 4 metri circa ti fai male (in acqua e col deltaplano no)',
      'Munizioni con texture: cassette militari con fascia colorata e scritte, scatola di cartucce, cassa di razzi',
    ],
  },
  {
    v: 'v26', title: 'Ogni skin è una persona diversa', color: '#ffb35a', icon: '🧑',
    items: [
      '24 personaggi realistici, uno per skin: viso, corpo, capelli, barba e vestiti propri (non più solo un colore diverso)',
      'Le casette di legno si aprono: porta vera con E, interni con letto, tavolo, mensole e bottino dentro',
      'Novità: la stufa a legna! Accendila con E, guarda il fumo dal comignolo e resta al calduccio per recuperare salute',
    ],
  },
  {
    v: 'v25', title: 'Grafica realistica', color: '#7fd0ff', icon: '🎮',
    items: [
      'Personaggi veri al posto dei pupazzi a cubi e sfere: soldato in armatura e ragazza con modelli umani scolpiti e texturizzati',
      'Le skin ricolorano armatura, tessuti e dettagli · dita che stringono l’arma, braccia che seguono l’impugnatura',
      'Auto realistiche: berline, utilitarie e SUV con vernice metallizzata lucida, vetri a specchio, cerchi in lega, fari e targhe',
      'Entrando in una casa il soffitto resta al suo posto: intonaco bianco e plafoniera accesa',
    ],
  },
  {
    v: 'v24', title: 'Città vere', color: '#ff9f2e', icon: '🏙',
    items: [
      'Città 10 volte più ricche: strade asfaltate con strisce, marciapiedi, semafori e piazze',
      'Palazzi fino a 7 piani con scale, balconi e tetti calpestabili · capannoni con soppalco',
      'Negozi veri con insegna e interni: bar, pizzeria, farmacia, armeria, supermercato e altri',
      'Lampioni, panchine, auto parcheggiate, fermate del bus, chioschi e monumenti',
      'Niente più sagome strane all’orizzonte · i nemici lontani svaniscono nella nebbia',
    ],
  },
  {
    v: 'v23', title: 'Squadre, Versus e lobby nuova', color: '#ffcf2e', icon: '👥',
    items: [
      'Nuove modalità: Singolo, Duo, Trio e Squad (anche contro i bot)',
      'Online: gioca in squadra con gli amici oppure in Versus, tu contro di loro',
      'Compagni con targhetta, salute in HUD e punto sulla minimappa · niente fuoco amico',
      'Skin più realistiche: tessuti con cuciture e pieghe, scarpe, cappelli e zaini più dettagliati',
      'Lobby ridisegnata con il cartello delle novità',
    ],
  },
  {
    v: 'v22', title: 'Inventario e materiali', color: '#4fd3ff', icon: '🎒',
    items: [
      'Inventario con TAB: trascina gli oggetti, guarda munizioni e armi',
      'Legno e pietre ridisegnati, rocce con muschio e neve',
    ],
  },
  {
    v: 'v21', title: 'Mondo più vivo', color: '#7dff5a', icon: '🏔',
    items: [
      'Nuoto, porte che si aprono e interni delle case',
      'Montagne più alte, tempesta più lunga (~21 minuti)',
      'Armi leggendarie ed epiche più rare, mirino del fucile a pompa nuovo',
    ],
  },
  {
    v: 'v20', title: 'Erba 3D e accessori', color: '#c04dff', icon: '🌿',
    items: [
      'Erba alta in 3D, sottobosco con felci e funghi',
      'Accessori visivi per le armi e dettagli nuovi sul bus',
    ],
  },
  {
    v: 'v19', title: '15 armi', color: '#ff7a4a', icon: '🔫',
    items: [
      '15 armi diverse con mirini dedicati',
      'Animazioni direzionali di corsa e mira',
    ],
  },
];
