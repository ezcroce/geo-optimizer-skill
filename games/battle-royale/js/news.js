// ─────────────────────────────────────────────────────────────
//  Cartello delle novità (lobby): ultime versioni del gioco
// ─────────────────────────────────────────────────────────────
export const NEWS_VERSION = 'v34';

export const NEWS = [
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
