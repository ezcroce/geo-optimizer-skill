# Infinite Alibi: Tactical Heist

Prototipo 2D top-down cooperativo per **2–4 persone sullo stesso dispositivo**. È un gioco separato dal precedente prototipo CCTV in `games/infinite-alibi/`: non sostituisce né modifica quest'ultimo.

Per aprire entrambi i giochi da un unico sito in Chrome, vedi le [istruzioni del sito](../README.md).

## Avvio

Nessuna dipendenza o build: apri `index.html` in un browser moderno, oppure dalla radice del repository:

```bash
python3 -m http.server 4173 --bind 0.0.0.0 --directory games/infinite-alibi-tactical
# apri http://localhost:4173
```

## Training del Ladro

Dal menu scegli **Inizia il training**: è una missione guidata in solitaria con allarme disabilitato. Corri nella Biblioteca per lasciare impronte, pianifica il tragitto attraverso il passaggio segreto, ruba il diamante e usa i reperti realmente registrati per rispondere all’interrogatorio. Puoi saltarla in qualsiasi momento.

## Come giocare

La mappa occupa tutto lo schermo; la camera segue lo specialista selezionato. Trascina la mappa per esplorare, usa la rotella o i pulsanti +/− per lo zoom, e ⌖ per tornare al personaggio. Il pulsante ⛶ richiede la modalità a schermo intero del browser; ◧ (o `H`) nasconde e ripristina gli overlay.

1. Scegli 2–4 specialisti diversi. Ogni giocatore controlla il proprio personaggio; tutti possono discutere e pianificare senza limiti di tempo.
2. Seleziona un personaggio, scegli Furtivo, Passo o Corsa e clicca sulla mappa per accodare una o più destinazioni. Aggiungi azioni e, quando previsto, clicca sul bersaglio: una telecamera, una guardia o una porta. La coda può attraversare più turni. Se la destinazione è bloccata, un percorso condizionale richiede che un compagno apra la porta prima che l'azione di movimento inizi (accoda un'attesa per coordinarti); la stima dei secondi su ogni movimento presuppone le condizioni attuali delle porte e una partenza dal centro della casella.
3. Conferma ciascuno specialista. Una conferma può essere annullata selezionando di nuovo il personaggio, prima che tutti siano pronti. Quando tutti confermano, i piani vengono eseguiti **simultaneamente per 5 secondi di gioco**, poi tutto si ferma per una nuova pianificazione. Se la scheda viene sospesa, la simulazione non avanza in background.
4. Porta un personaggio vicino al diamante nello Studio e accoda **Ruba diamante**. Porta **ogni** membro sulle caselle dell'uscita e accoda **Fuggi**. Fuggire tutti senza diamante fa fallire il colpo.
5. A fuga completata o allarme generale inizia l'indagine: esamina la mappa rivelata e i reperti, poi scegli le dichiarazioni. Una dichiarazione incompatibile con un reperto, o con gli spostamenti possibili fra dichiarazioni di turni diversi, produce una contraddizione. Per una fuga pulita servono il diamante, tutta la banda all'uscita e nessuna contraddizione.

Simboli: `◆` diamante, `⌘` terminale nel corridoio, `≋` estremità di condotto, `▧` uscita; i quadrati azzurri sono telecamere, i cerchi verdi guardie, quelli beige ospiti. Le porte con `×` sono bloccate; `S` indica il passaggio segreto. La nebbia copre le zone fuori dalla visuale dello specialista selezionato; una microspia può mostrare PNG vicini anche attraverso i muri. Durante l'esecuzione guardie, telecamere e ospiti proiettano coni di visibilità; un'esposizione totale davanti a una guardia o telecamera scatena l'allarme. Gli ospiti osservano e possono fornire testimonianze, ma non fanno scattare l'allarme.

## Specialisti e tracce

- **Infiltrato:** può usare i condotti. Per le porte meccaniche, accoda **Scassina**, seleziona la porta e supera la prova di precisione senza timer. L’azione viene eseguita dopo le mosse già in coda e richiede di trovarsi vicino alla porta; lascia segni di effrazione.
- **Hacker:** può aprire automaticamente porte elettroniche oppure sbloccarle a distanza entro la visuale; può anche spegnere una telecamera per 15 secondi di esecuzione, hackerare il terminale (`⌘`) nel corridoio per disabilitarle tutte e falsificare le tracce digitali. Le azioni a distanza vanno accodate e richiedono un bersaglio visibile e in portata quando sono eseguite.
- **Trasformista:** vicino agli ospiti è più difficile da individuare. Può distrarre una guardia vicina per 7 secondi di esecuzione e piazzare fino a tre esche: ciascuna riduce il numero massimo di reperti contestati dall'investigatore, senza cancellare gli eventi reali.
- **Ricognitore:** ha un campo visivo più ampio, può sbirciare una porta adiacente per rivelare una stanza e piazzare microspie che mostrano i PNG vicini anche attraverso i muri.

L’azione **Copertura** accovaccia vicino agli arredi, riducendo l’esposizione; muri e arredi bloccano la linea visiva. Muoversi fa uscire dalla copertura. La corsa in Cucina (bagnata) o Biblioteca (polverosa) lascia impronte. I testimoni, il bicchiere al bar, gli avvistamenti, gli accessi digitali e le effrazioni sono associati alla posizione e al momento effettivi; i primi due documentano anche possibili alibi. Falsificare i registri nasconde le prove digitali dalla plancia, ma non modifica il registro interno degli eventi. Il furto viene registrato nel log di simulazione, non è automaticamente un reperto identificativo: un avvistamento deve effettivamente verificarsi.

## Architettura

- `js/world.js`: griglia, stanze, porte e arredi; ricerca del percorso con Dijkstra e collegamenti speciali dei condotti. La funzione `routeTime` calcola la durata di un percorso con il passo fisso di simulazione; porte chiuse e condotti hanno costi espliciti.
- `js/vision.js`: raycasting di coni e linea di vista, con occlusione da muri, arredi e porte bloccate; calcolo della visuale per la fog of war.
- `js/game.js`: simulazione, piani individuali, sincronizzazione e avanzamento per 5 secondi; IA di pattuglia e osservatori; `events` e `evidence` per il registro e l'indagine.
- `js/app.js`: rendering Canvas, input, comandi e plancia. Il browser esegue la simulazione a passi fissi di 50 ms.

## Test

```bash
node games/infinite-alibi-tactical/tests/tactical.test.js
```

I test coprono percorso e condotti, tempi, occlusioni, sincronizzazione e pausa, impronte, interazioni, prove, condizioni di fuga, allarme e indagine, incluso un colpo completo dalla posizione iniziale con gli osservatori disattivati per isolare il percorso.

## Limiti del prototipo

La cooperazione è **locale**, non online. L'indagine è un sistema di carte e confronti a regole, non una IA investigativa avanzata né una modalità competitiva con investigatori umani. Gli ospiti sono fermi e ruotano lo sguardo; le guardie seguono percorsi predefiniti. I passaggi segreti sono indicati sulla mappa, senza sistema di scoperta; non ci sono vetri rompibili, chat vocale, sistema di impronte sonore o salvataggi. La falsificazione può essere eseguita dall'Hacker senza un terminale fisico. Il disegno di copertina è illustrativo; la mappa giocabile è disegnata dal motore a griglia. L'interfaccia presenta i reperti e permette di formulare dichiarazioni per stanza, non di esplorare liberamente come investigatore separato. Queste sono semplificazioni, non funzionalità online o investigative già complete.
