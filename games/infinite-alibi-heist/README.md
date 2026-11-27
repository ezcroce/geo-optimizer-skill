# Infinite Alibi — The Heist & Investigation

Prototipo stealth 2D **in tempo reale** per un giocatore. Non usa turni né un limite di tempo. L'Accademia dei Ladri è obbligatoria alla prima partita; il completamento viene salvato nel browser e sblocca la missione. Il precedente prototipo tattico a turni rimane in `games/infinite-alibi-tactical/`.

## Giocare

Apri `index.html` in Chrome, oppure avvia il sito completo dalla radice del repository:

```bash
cd games/infinite-alibi
npm install
npm start
# http://localhost:8080
```

Dalla homepage scegli **The Heist**. La pagina è utilizzabile anche come sito statico: il gioco non richiede un server o un account. Per la modalità multiplayer dell'altro prototipo è invece necessario il server Node.

- **WASD** o frecce: movimento continuo. **Shift**: corsa. **C** tenuto premuto: movimento furtivo. Il mouse orienta il personaggio.
- **E**: interagisci con l'oggetto vicino indicato sullo schermo. Il terminale nel corridoio apre la porta elettronica dello Studio. Avvicinati al diamante, poi torna sulle caselle d'uscita del Giardino d'Inverno e premi E. Nell'Accademia, dopo il furto attraversa il passaggio segreto `S` dallo Studio alla Biblioteca prima di fuggire.
- **Porte meccaniche:** avvicinati e premi E per forzare la serratura; l'effrazione rimane un reperto.
- **Armadi:** premi E vicino a un armadio per nasconderti; premi ancora E per uscire. Da nascosto non sei visibile, ma le guardie continuano a cercare per qualche secondo.
- **Controller:** levetta sinistra movimento, destra sguardo, A interazione, B furtivo, grilletto destro corsa. Su schermi piccoli compaiono joystick e pulsanti touch.
- **Pausa:** Esc o il pulsante in alto. **Audio:** il pulsante ♫ abilita/disabilita i passi sintetizzati; è disattivato inizialmente. Il pulsante ⛶ richiede lo schermo intero al browser.

I passi producono rumore: correre, pavimenti e movimento furtivo ne modificano il raggio percepito dalle guardie. In Cucina e Biblioteca si formano impronte: le particelle svaniscono, ma il segno e il reperto corrispondente restano. Accessi digitali, serrature forzate, avvistamenti e testimonianze degli ospiti sono altri reperti effettivamente generati dalle azioni. I coni verdi indicano pattuglia, gialli sospetto, rossi ricerca attiva. Un avvistamento di circa un secondo avvia la caccia, non termina subito la partita: allontanati dalla visuale o nasconditi. Se una guardia ti raggiunge e resta vicina per circa un secondo, la missione fallisce. Nell'Accademia la cattura è disattivata per consentire l'apprendimento.

## Investigazione e alibi

Dopo la fuga o la cattura si apre una plancia interattiva: gli investigatori scelgono fino a quattro reperti effettivamente registrati e chiedono dichiarazioni sulla loro posizione. Un successivo quesito mostra la piantina e una posizione ipotetica: occorre valutare se lo spostamento verso un reperto potrebbe avvenire in un secondo.

La verifica usa la griglia effettiva e include il passaggio segreto. Per evitare false certezze, stima un **limite inferiore ottimistico**: porte considerate aperte, velocità massima e margine per movimenti diagonali e posizioni non centrate. Se anche questo limite supera il tempo disponibile, lo spostamento è impossibile; questo non prova che il giocatore fosse davvero nella posizione ipotizzata. La traccia del passaggio segreto è presentata come informazione personale, non come testimonianza indipendente. Dichiarazioni contraddittorie portano a un alibi contestato; una versione coerente non viene definita prova di innocenza.

## Architettura e test

- `js/world.js`: griglia della villa, arredi solidi, porte e percorsi dei PNG.
- `js/vision.js`: raycasting, occlusioni da muri e coperture, visuale del giocatore.
- `js/engine.js`: simulazione in tempo reale, collisioni, guardie e ospiti, udito, ricerca, reperti e confronto investigativo basato su regole.
- `js/app.js`: rendering Canvas, personaggi animati in modo procedurale, camera fluida, input e HUD.

```bash
node games/infinite-alibi-heist/tests/heist.test.js
```

I test coprono collisioni, rumore, nascondigli, sospetto, interazioni e l'intera Accademia dalla posizione iniziale alla fuga usando soltanto il movimento simulato. Il browser ha inoltre un controllo di pausa e un passo di simulazione di 1/60 s; la scheda nascosta non avanza il gioco.

## Limiti del prototipo

È un prototipo single-player locale, non una modalità online. Le animazioni sono vettoriali e procedurali, non sprite disegnati a mano; l'immagine della schermata iniziale è illustrativa e non rappresenta esattamente la griglia giocabile. Le guardie usano semplici stati di pattuglia, sospetto e ricerca; gli ospiti ruotano sul posto. L'indagine è una ricostruzione interattiva basata su regole e fino a quattro reperti, non una simulazione avanzata con investigatori che esplorano fisicamente la villa. Le guardie non aprono porte bloccate. Non c'è un sistema di audio spaziale e il supporto controller dipende dal browser e dalla mappatura del dispositivo.
