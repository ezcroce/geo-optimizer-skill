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
| Voto | istantaneo | tutti | A maggioranza |
| Tempi supplementari | 20 s | solo i sospettati in parità | Solo in caso di **pareggio**: arringa finale a turno, poi **ballottaggio** secco fra loro. Se anche il ballottaggio è pari, il Colpevole la fa franca |
| Verdetto | ~5 s | — | Colpevole preso: espulsione comica · innocente condannato: **Replay Reale** |

La villa è una griglia 3×2 di stanze, ognuna con la sua telecamera dall'alto (B/N, scanline,
timestamp): Cucina, Sala da Pranzo, **Studio** (con il gioiello), Biblioteca, Salone, Giardino.
Cucina e Giardino sono agli angoli opposti. Una stanza si attraversa in circa 3,4 s.

## 1. L'Edit Tool (sistema di manipolazione)

| Strumento | Limite | Cosa nasconde | Micro-indizi che lascia |
|---|---|---|---|
| ✂ **Taglia e Cuci** | 1 uso, 0,5–3 s | Sostituisce un pezzo di una camera con un altro momento **della stessa camera**: lo Studio vuoto di prima (cancella il furto) o te stesso in Cucina (alibi falso) | ⏱ Il timestamp mostra l'ora della sorgente: salta o va all'indietro (`:13 → :06 … :08 → :17`). 📉 **Scatto ambientale** a ogni giunzione: lampo di luce, righe strappate e micro-lag per 0,08–0,25 s, visibile senza leggere l'orologio. ⚡ Chi era nel pezzo incollato "si teletrasporta" ai bordi. 👥 Chi era nella sorgente può comparire in due stanze. 👻 Chi viene cancellato sparisce da tutte le camere. 💎 Il gioiello può ricomparire o svanire da solo |
| 🎭 **Deepfake** | 1 uso, 1,2–1,5 s secondo la difficoltà | Il tuo avatar diventa quello di un innocente (forma, motivo, iniziale) | **Il Colpevole sceglie quale dettaglio fallisce**: 🎩 l'oggetto in mano resta il tuo (cappello, tazza, bastone, libro, ombrello, sciarpa) *oppure* 🌑 l'ombra resta la tua (dimensione e sagoma). ✨ Per tutta la durata c'è un micro-sfarfallio costante (tremolio + "fantasma" della vera identità a scatti), legato al tempo del filmato quindi visibile anche fotogramma per fotogramma. 👥 Se la vittima è inquadrata altrove nello stesso istante, risulta in due posti |
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
* **Oggetto o ombra?** L'oggetto sbagliato è più vistoso ma lo sfarfallio è più leggero; l'ombra è più
  sottile ma lo sfarfallio è più forte. È una scommessa sul tipo di occhio degli avversari.

### Difficoltà

| Livello | Deepfake | Sfarfallio | Scatto del taglio | Attenzione dei bot |
|---|---|---|---|---|
| Facile | 1,5 s | forte (1,0) | 0,25 s | ×1,2 |
| Normale | 1,3 s | medio (0,6) | 0,15 s | ×1,0 |
| Esperto | 1,2 s | lieve (0,3) | 0,08 s | ×0,85 |

La difficoltà si sceglie nel menu (e dall'host nelle stanze online) e vale per tutti.

## 2. Counter-play: come si scopre il bluff

L'analisi (`IA.analyze`) guarda **solo ciò che vede lo spettatore**: il timestamp mostrato, chi appare
in quale camera, ombre e oggetti. Sul filmato non manomesso non trova *nessun* indizio di manomissione
(c'è un test apposta), quindi ogni anomalia è un vero segnale.

| Indizio | Probabilità che un bot attento lo noti | Effetto sul sospetto |
|---|---|---|
| ▲ Glitch | 0,95 | +1 a chi entra o esce dalla camera |
| 💎 Furto visibile | 0,85 | +6 a chi è accanto al piedistallo |
| 👁 Presenza nello Studio vicino al furto | 0,85 | +2 |
| 🎩 Oggetto sbagliato (deepfake, se scelto) | 0,42–0,52 | +5 al vero proprietario, −3 alla vittima |
| ✨ Sfarfallio del deepfake | 0,3–0,45 × difficoltà (max 0,7) | +1,5 al Colpevole, −1,5 alla vittima |
| ⏱ Timestamp che salta | 0,45 (0,22 se lo sfasamento è < 2 s) | +2,5 / +1,2 a chi compare ai bordi del taglio |
| 📉 Scatto alla giunzione del taglio | ~0,35 × difficoltà (max 0,6) | 40% dei punti del timestamp; soprattutto dice *dove* guardare |
| 👻 Sparito da tutte le camere | 0,15 + 0,06 al secondo (max 0,5) | +1,5 / +3 se è vicino all'ora del furto (+1 se era sotto il glitch dello Studio) |
| 👥 In due posti | 0,55 | dipende da quale copia è falsa |
| ⚡ Spostamento impossibile | 0,40 | +2/+3 |
| 🌑 Ombra che non torna (deepfake, se scelta) | 0,26–0,36 | −3 alla vittima, +3 al Colpevole |
| 👣 False piste (passaggi nello Studio, gironzolare vicino) | 0,5–0,6 | +0,75 / +1 |

Ogni bot ha un'**acutezza** casuale (0,75–1,15) e un **istinto** personale (rumore gaussiano σ=1,8
per sospettato). Le accuse durante il processo spostano il sospetto dei bot che hanno prove deboli.

### Numeri misurati (40 casi, giuria di 4 bot, ballottaggio in caso di pareggio)

| Difficoltà | Nessuna manipolazione | Colpevole IA (il migliore fra 90 montaggi casuali) |
|---|---|---|
| Facile | 99% condannato | 78% |
| Normale | 97% | 68% |
| Esperto | 92% | 64% |

* Il ballottaggio dopo i supplementari toglie al Colpevole la "vittoria a tavolino" del pareggio; per
  compensare, deepfake e scatto del taglio valgono un po' meno punti di prima e l'istinto dei bot è più rumoroso.
* Un umano che bluffa bene al processo (accuse mirate, alibi credibile) scende ancora.
  In Party, con giocatori umani, la percezione reale degli indizi è il vero bilanciamento.

### I complici (al posto della barra di rischio)

Durante il montaggio non c'è più una percentuale. Tre complici virtuali (**il Socio**, **la Talpa**,
**Zio Montatore**) commentano il montaggio in chat con consigli narrativi presi dagli indizi più rischiosi,
per esempio: *"I bot odiano i glitch nello Studio: tutti guarderanno lì. Prova a tagliare una stanza vicina."*
oppure *"Ottimo: i sospetti cadono su Marco."* Un'etichetta d'umore (😎 tranquillo · 😬 nervoso · 😱 nel
panico) riassume il Monte Carlo da 80 giurie senza mostrare numeri.

### Aiuti per principianti (opzionali)

* **🧭 Filtro di movimento**: il bordo di una camera pulsa d'arancione nei momenti in cui c'è un'anomalia
  di continuità (giunzioni, teletrasporti, doppioni, deepfake, gioiello che sparisce). Non segnala mai il
  furto in sé né chi è il Colpevole: dice *dove* guardare, non *cosa* pensare.
* **🔍 Lenti automatiche** (2 a partita): portano il video sull'istante e sul punto del dettaglio sospetto
  più evidente non ancora indicato.

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
* **📱 Clip verticale 9:16** (fine partita, automatica, ~17 s): titolo → la camera sotto accusa nella
  versione truccata con il fumetto dell'indizio chiave e il laser → confronto truccato/reale → verdetto
  con espulsione comica. Pronta per TikTok / Shorts / Reels.

## 4. Modalità streamer

Per dirette su Twitch (o una chat proiettata su Discord). Il gioco legge la chat **in sola lettura**
(IRC anonimo via WebSocket, nessun login o token):

* `!vota <iniziale|numero|nome>` durante processo, supplementari e voto: la maggioranza della chat vale
  **1 voto di giuria** (se la chat è in parità, il voto è nullo). Al ballottaggio valgono solo i candidati.
* `!glitch` manda un disturbo di segnale **finto** su una camera a caso dello schermo dello streamer
  (cooldown 10 s globale, 30 s per spettatore). È etichettato "DISTURBO DALLA CHAT": non è una prova e
  non entra nell'analisi.
* `!indizio …` compare nel riquadro chat sopra il video.
* Una **chat simulata** permette di provare la modalità senza essere in diretta.

## 5. Online (server autoritativo)

`server/server.js` (Node.js + `ws`) serve il gioco e gestisce le stanze (codice di 4 lettere, 3–6 giocatori):

* Il server sceglie seed e Colpevole e genera il caso con lo stesso codice deterministico del client.
* **Agli investigatori non arriva mai nulla di segreto prima del verdetto**: né seed, né Colpevole, né
  percorsi reali. All'inizio della raccolta prove ricevono solo il **filmato precotto**
  (`IA.bakeFootage`: per ogni camera e ogni 0,1 s, timestamp mostrato, glitch, scatto, gioiello e ciò che
  si vede di ogni persona, cioè aspetto, ombra, oggetto e posizione). Non c'è un campo "identità reale",
  quindi il deepfake non si può smascherare leggendo la rete, solo guardando.
* Il Colpevole riceve seed e indice per montare in locale; il server **valida** ogni modifica e allo
  scadere usa l'ultima versione valida.
* Fasi e timer li decide il server; l'host può anticipare. Laser, chat e puntine presentate vengono
  inoltrati a tutti; pareggio → supplementari → ballottaggio come offline. Al verdetto il server rivela
  seed, Colpevole e montaggio, e tutti vedono Replay Reale e clip. Classifica per stanza; riconnessione
  automatica.

