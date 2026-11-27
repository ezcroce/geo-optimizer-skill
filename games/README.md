# Infinite Alibi — sito dei giochi

La pagina `index.html` raccoglie i due prototipi: **Tactical Heist** e **Infinite Alibi** (telecamere). Per usare entrambi in Chrome, compresa la modalità online del gioco originale, avvia il server Node:

```bash
cd games/infinite-alibi
npm install
npm start
```

Apri **http://localhost:8080** in Chrome. Il server offre la homepage, entrambi i giochi e il WebSocket `/ws` dalla stessa porta. Per giocare online, gli altri partecipanti devono poter raggiungere l'indirizzo del computer che ospita il server (non il loro `localhost`); l'accessibilità dipende dalla rete e dalla configurazione del firewall. `PORT=...` cambia porta.

Per giocare solo in locale è anche possibile aprire `games/index.html` direttamente in Chrome; la modalità online del gioco originale richiede comunque il server. Tactical Heist è un prototipo cooperativo sullo stesso dispositivo, non online. Le istruzioni specifiche sono nei README delle due cartelle.

## Pubblicazione su Render

Il file `render.yaml` nella radice del repository descrive un servizio web Node che serve il sito e il WebSocket sulla stessa origine. Per pubblicare occorre un account Render e creare un Blueprint dal repository/branch che contiene tale file. Il piano configurato è gratuito: verifica limiti e disponibilità nel tuo account prima della conferma. Il servizio può sospendersi dopo inattività; le stanze sono conservate solo in memoria e si perdono al riavvio. Tactical Heist rimane cooperativo locale anche dopo la pubblicazione.
