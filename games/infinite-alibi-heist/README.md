# Infinite Alibi — The Heist

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
- **E**: interagisci con l'oggetto vicino indicato sullo schermo. Il terminale nel corridoio apre la porta elettronica dello Studio. Avvicinati al diamante, poi torna sulle caselle d'uscita del Giardino d'Inverno e premi E.
- **Armadi:** premi E vicino a un armadio per nasconderti; premi ancora E per uscire. Da nascosto non sei visibile, ma le guardie continuano a cercare per qualche secondo.
- **Controller:** levetta sinistra movimento, destra sguardo, A interazione, B furtivo, grilletto destro corsa. Su schermi piccoli compaiono joystick e pulsanti touch.
- **Pausa:** Esc o il pulsante in alto. **Audio:** il pulsante ♫ abilita/disabilita i passi sintetizzati; è disattivato inizialmente. Il pulsante ⛶ richiede lo schermo intero al browser.

I passi producono rumore: correre, pavimenti e movimento furtivo ne modificano il raggio percepito dalle guardie. In Cucina e Biblioteca si formano impronte visive temporanee. I coni verdi indicano pattuglia, gialli sospetto, rossi ricerca attiva. Un avvistamento di circa un secondo avvia la caccia, non termina subito la partita: allontanati dalla visuale o nasconditi. Se una guardia ti raggiunge e resta vicina per circa un secondo, la missione fallisce. Nell'Accademia la cattura è disattivata per consentire l'apprendimento.

## Architettura e test

- `js/world.js`: griglia della villa, arredi solidi, porte e percorsi dei PNG.
- `js/vision.js`: raycasting, occlusioni da muri e coperture, visuale del giocatore.
- `js/engine.js`: simulazione in tempo reale, collisioni, guardie, udito, ricerca e interazioni.
- `js/app.js`: rendering Canvas, personaggi animati in modo procedurale, camera fluida, input e HUD.

```bash
node games/infinite-alibi-heist/tests/heist.test.js
```

I test coprono collisioni, rumore, nascondigli, sospetto, interazioni e l'intera Accademia dalla posizione iniziale alla fuga usando soltanto il movimento simulato. Il browser ha inoltre un controllo di pausa e un passo di simulazione di 1/60 s; la scheda nascosta non avanza il gioco.

## Limiti del prototipo

È un prototipo single-player locale, non una modalità online. Le animazioni sono vettoriali e procedurali, non sprite disegnati a mano; l'immagine della schermata iniziale è illustrativa e non rappresenta esattamente la griglia giocabile. L'IA usa semplici stati di pattuglia, sospetto e ricerca, non un sistema avanzato di investigazione o di alibi. Le guardie non aprono porte bloccate. Non c'è un sistema di audio spaziale e il supporto controller dipende dal browser e dalla mappatura del dispositivo.
