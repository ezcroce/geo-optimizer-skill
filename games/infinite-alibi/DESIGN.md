# Infinite Alibi — Design del Bluff e Bilanciamento

Gioco di deduzione sociale da circa 3 minuti. Il rischio principale è che il Colpevole venga
scoperto subito, oppure che abbia un vantaggio troppo grande. Per questo la manipolazione delle
prove diventa un mini-gioco di abilità e creatività: **ogni trucco nasconde qualcosa e lascia un
micro-indizio**.

Tutti i numeri qui sotto stanno in `CONFIG` (`js/world.js`) e nei pesi degli indizi (`js/footage.js`).

## Struttura di una partita

| Fase | Durata | Chi | Cosa succede |
|---|---|---|---|
| Montaggio | 45 s | solo il Colpevole | Usa l'Edit Tool sui 30 s di filmato delle 6 telecamere |
| Raccolta prove | 60 s | tutti | Filmato truccato in loop: pausa, ¼×, fotogramma per fotogramma, puntine |
| Processo | 60 s | tutti | Discussione col puntatore laser colorato sul video condiviso |
| Voto | istantaneo | tutti | A maggioranza; **in caso di pareggio il Colpevole la fa franca** |
| Verdetto | ~5 s | — | Colpevole preso: espulsione comica · innocente condannato: **Replay Reale** |

La villa è una griglia 3×2 di stanze, ognuna con la sua telecamera dall'alto (B/N, scanline,
timestamp): Cucina, Sala da Pranzo, **Studio** (con il gioiello), Biblioteca, Salone, Giardino.
Cucina e Giardino sono agli angoli opposti. Una stanza si attraversa in circa 3,4 s.

## 1. L'Edit Tool (sistema di manipolazione)

| Strumento | Limite | Cosa nasconde | Micro-indizi che lascia |
|---|---|---|---|
| ✂ **Taglia e Cuci** | 1 uso, 0,5–3 s | Sostituisce un pezzo di una camera con un altro momento **della stessa camera**: lo Studio vuoto di prima (cancella il furto) o te stesso in Cucina (alibi falso) | ⏱ Il timestamp mostra l'ora della sorgente: salta o va all'indietro (`:13 → :06 … :08 → :17`). ⚡ Chi era nel pezzo incollato "si teletrasporta" ai bordi. 👥 Chi era nella sorgente può comparire in due stanze. 👻 Chi viene cancellato sparisce da tutte le camere. 💎 Il gioiello può ricomparire o svanire da solo |
| 🎭 **Deepfake** | 1 uso, 0,8 s ("fotogramma chiave") | Il tuo avatar diventa quello di un innocente (forma, motivo, iniziale) | 🌑 L'ombra resta la tua (dimensione e sagoma). 🎩 L'oggetto resta il tuo (cappello, tazza, bastone, libro, ombrello, sciarpa). 👥 Se la vittima è inquadrata altrove nello stesso istante, risulta in due posti |
| ▲ **Glitch** | 1 uso, 0,5–3 s | Statico totale su una camera | ▲ È sempre notato: i glitch non sono mai casuali. 👻 Chi non si vede in nessun'altra camera durante il disturbo era lì dentro |

Scelte di bilanciamento chiave:

* **Il piedistallo è vicino alle porte** dello Studio. Entrata, furto (3 s) e uscita durano circa
  5,8 s: coprirli tutti richiede di combinare *due* strumenti (taglio + glitch). Combinarli moltiplica
  gli indizi.
* **Il taglio prende solo dalla stessa camera**: lo sfondo combacia, ma il timestamp no. È il compromesso
  che rende il trucco credibile e allo stesso tempo scopribile.
* **Nessun testimone innocente** entra nello Studio tra Tc−2,5 s e Tc+5 s. Così il Colpevole ha sempre
  qualcosa da nascondere e nessun innocente "risolve" il caso per caso. Almeno un innocente però passa
  nello Studio in un altro momento: una falsa pista.
* Ogni personaggio ha **sagoma, altezza dell'ombra e oggetto unici**, quindi il deepfake è sempre
  smascherabile da chi guarda bene.

## 2. Counter-play: come si scopre il bluff

L'analisi (`IA.analyze`) guarda **solo ciò che vede lo spettatore**: il timestamp mostrato, chi appare
in quale camera, ombre e oggetti. Sul filmato non manomesso non trova *nessun* indizio di manomissione
(c'è un test apposta), quindi ogni anomalia è un vero segnale.

| Indizio | Probabilità che un bot attento lo noti | Effetto sul sospetto |
|---|---|---|
| ▲ Glitch | 0,95 | +1 a chi entra o esce dalla camera |
| 💎 Furto visibile | 0,85 | +6 a chi è accanto al piedistallo |
| 👁 Presenza nello Studio vicino al furto | 0,85 | +2 |
| 🎩 Oggetto sbagliato (deepfake) | 0,42–0,55 | +6 al vero proprietario, −4 alla vittima |
| ⏱ Timestamp che salta | 0,50 (0,25 se lo sfasamento è < 2 s) | +1,5 a chi compare nel pezzo incollato, +2 a chi è nello Studio ai bordi del taglio |
| 👻 Sparito da tutte le camere | 0,15 + 0,06 al secondo (max 0,5) | +1,5 / +3 se è vicino all'ora del furto (+1 se era sotto il glitch dello Studio) |
| 👥 In due posti | 0,55 | dipende da quale copia è falsa |
| ⚡ Spostamento impossibile | 0,40 | +2/+3 |
| 🌑 Ombra che non torna | 0,20–0,35 | −3 alla vittima, +2 al Colpevole |
| 👣 False piste (passaggi nello Studio, gironzolare vicino) | 0,5–0,6 | +0,75 / +1 |

Ogni bot ha un'**acutezza** casuale (0,75–1,15) e un **istinto** personale (rumore gaussiano σ=1,5
per sospettato). Le accuse durante il processo spostano il sospetto dei bot che hanno prove deboli.

### Numeri misurati (40 casi, giuria di 4 bot)

* Nessuna manipolazione: il Colpevole viene condannato nel **95%** dei casi.
* Il Colpevole IA (sceglie fra 70 combinazioni casuali la meno rischiosa): **~65–69%**.
* Un umano che bluffa bene al processo (accuse mirate, alibi credibile) scende ancora.
  In Party, con giocatori umani, la percezione reale degli indizi è il vero bilanciamento.

Durante il montaggio l'indicatore **Rischio** (BASSO/MEDIO/ALTO) mostra questa probabilità stimata
con un Monte Carlo da 80 giurie. Insegna al Colpevole quanto è rumoroso ogni trucco, senza svelare
quale indizio lo tradirà.

## 3. Processo e viralità

* **Puntatore laser**: trascina sul video per lasciare una scia luminosa che svanisce in circa 2 s.
  In Party ogni giocatore ha il suo colore (tasti 1–6). I bot cerchiano a loro volta gli indizi di cui parlano.
* **Puntine**: messe durante la raccolta prove; in Detective puoi *presentarle* alla giuria. Se colpiscono
  un vero micro-indizio, tutti i bot lo "vedono".
* **Voto rapido**: rivelato voto per voto, con il conteggio animato.
* **Espulsione comica**: stivale, BAM!, volo a spirale fuori dalla villa con coriandoli.
* **Replay Reale**: il filmato senza tagli, con il Colpevole cerchiato in rosso, i pezzi manomessi con
  la cornice tratteggiata e l'etichetta "TAGLIO: mostrava 23:14:06". Puoi passare dalla versione vera a
  quella truccata, con l'elenco di tutti i micro-indizi che c'erano e di chi li aveva notati.
* **⏺ Clip**: registra il canvas in WebM (MediaRecorder) da condividere.
