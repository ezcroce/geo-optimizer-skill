# THE HEIST SOCIAL: LA VILLA DEI SOSPETTI

Videogioco multiplayer **online e offline** di azione e deduzione sociale in tempo reale per un massimo di **10 giocatori**, giocabile istantaneamente via browser (Google Chrome) senza download né configurazioni di hosting lato giocatore.

---

## Caratteristiche Implementate

### 1. Architettura Web, Matchmaking & Stanze Private
- **Server Node.js Express + Socket.IO + Three.js WebGL**: quando il server Node è pubblicato su un host che supporta connessioni persistenti, gestisce la simulazione delle stanze e il movimento. Rimane disponibile anche il trasporto WebSocket precedente (`/ws`).
- **Versione statica su Vercel**: se non è configurato alcun backend persistente, il gioco ripiega su PeerJS/WebRTC e il browser del capostanza coordina la partita; richiede un servizio di segnalazione e il capostanza deve rimanere connesso. Non è un backend Node persistente su Vercel e la connessione P2P può non funzionare su tutte le reti.
- **Tre Modalità Immediate dal Menu**:
  1. **Gioca Subito (Offline / 10 Giocatori con IA)**: partita istantanea con 9 ospiti IA contestuali che pattugliano la villa, usano la Sala CCTV, ricordano chi hanno incrociato, mentono (se Ladro) e votano in italiano. Il ruolo è sempre assegnato casualmente.
  2. **Matchmaking Rapido Online**: coda pubblica automatica fino a 10 giocatori.
  3. **Stanza Privata tramite Codice (`VL-XXXX`)**: generazione codice stanza + link invito diretto (`?room=VL-XXXX`), con possibilità di completare i posti liberi fino a 10 con Bot IA.
- **Personaggi umanoidi 3D proporzionati (`src/graphics/humanoid.js`)**: abiti da gala personalizzabili e animazioni procedurali di camminata, corsa e interazione.

### 2. Mappa Completa: "Villa Bellavista" (`src/data/villaLayout.js` & `src/graphics/villaScene.js`)
- **Interni Arredati**: Atrio d’Ingresso (con Teca Infranta e Pulsante d’Emergenza), Salone delle Feste (pianoforte a coda, divani, paraventi), Studio Privato, Sala di Controllo CCTV, Camera Padronale, Bagno di Lusso / Spa, Camera degli Ospiti, Cucina Gourmet & Sala da Pranzo, Galleria Ovest / Centrale / Est.
- **Esterni Completi**: Giardino Frontale con Fontana e Cancello, Area Piscina illuminata & Solarium, Retro-Villa con Gazebo antico, Vialetto Orientale & Roseto.
- **Visuale e coperture**: nebbia di guerra dinamica, con linea di vista bloccata da muri, porte bloccate, arredi alti e siepi attraversabili. Il blackout dura 12 secondi, azzera la visuale dei civili e lascia al ladro un raggio ridotto. La visibilità è applicata al rendering del client: non costituisce protezione anti-cheat.
- **Zone di Occultamento (`[E]`)**: Armadi, paraventi di seta, dispensa e siepi esterne.
- **Movimento e visuale**: WASD/frecce, clic destro per muoversi, Shift per correre. La visuale in partita è ingrandita rispetto al menu; usa `+`, `−` o la rotellina per regolarla. Premi `M` per aprire la piantina ingrandita.
- **4 Passaggi Segreti per il Ladro (`[Q]`)**: Libreria Girevole (Studio), Armadio a Doppiofondo (Camera Padronale), Botola Cantina Vini (Cucina) e Botola Antica sotto il Gazebo (Retro-Villa).

### 3. Ruoli, Gioielli & "La Stella di Venezia"
- **1 Ladro + 9 Civili** assegnati casualmente a inizio partita.
- **Il Diamante Principale ("La Stella di Venezia")**: già in possesso del Ladro a inizio partita; può essere occultato o spostato tra **4 Nascondigli Segreti** (Cassaforte Studio, Baule Ospiti, Vano Filtro Piscina, Statua Giardino), mentre i Civili possono ispezionare i nascondigli per recuperarlo.
- **12 Gioielli Minori Sparsi**: il Ladro vince trafugandone **8** senza farsi incastrare (oppure manipolando le votazioni finché restano 2 giocatori).
- **Sabotaggi del Ladro (`[1]` `[2]` `[3]`)**: Glitch Telecamere CCTV, Blackout Elettrico delle Luci e Blocco Porte per ala della Villa.

### 4. Sorveglianza CCTV Reale & Prove Fotografiche
- **6 Telecamere a Circuito Chiuso Live** (`CAM 01` – `CAM 06`) consultabili dalla **Sala di Controllo** o tramite **Tablet Portatile (`[C]`)**.
- **Raccolta Prove**: il pulsante **Salva Prova Fotografica** cattura un vero fotogramma WebGL della telecamera con orario, stanza e rilevamento forense automatico, condivisibile poi nella Lavagna Prove durante le Riunioni Plenarie.

### 5. Riunioni Plenarie, Chat Testuale/Vocale & Votazione
- Richiamabili tramite il **Pulsante d’Emergenza** nell’Atrio o segnalando una **Teca appena scassinata (`[R]`)**.
- Chat testuale in tempo reale + supporto **Push-to-Talk Vocale (`🎤`)** per le stanze online + condivisione istantanea delle foto CCTV salvate + espulsione a maggioranza.

---

## Avvio Locale

```bash
cd the-heist-social
npm install
npm run dev
```

Apri Google Chrome su `http://localhost:3000`.

## Frontend e backend separati

Pubblica `server/index.js` su un servizio Node persistente, ad esempio usando `render.yaml`; la memoria delle stanze è locale a una singola istanza e si perde al riavvio. Configura sul server `CLIENT_ORIGINS=https://the-heist-social.vercel.app` (più origini separate da virgola). Compila il frontend con `VITE_BACKEND_URL=https://INDIRIZZO-DEL-BACKEND npm run build:standalone` e pubblica il risultato. Usa l'URL HTTPS reale, senza percorso. Con `VITE_BACKEND_URL` impostato, un backend non raggiungibile produce un errore anziché ripiegare silenziosamente su WebRTC.

Il server calcola posizione e velocità a tick fissi, verifica collisioni e ingresso/uscita dei passaggi segreti e sincronizza gli stati. Non è ancora una soluzione anti-cheat completa: diverse azioni e le immagini CCTV prodotte dal client non sono verificate indipendentemente. I modelli sono procedurali low-poly con un rig personalizzato, non asset fotorealistici con scheletro standard.
