# ☕✨ Gravity Coffee — Cosmic Barista Simulator

Simulazione gestionale / barista in ambiente fantascientifico con elementi magici.
Stazione spaziale **Orbita-7**, microgravità, caffè quantico e clienti alieni bizzarri.

## Gioca

Apri `index.html` con un server statico (es. `python3 -m http.server`) oppure
gioca dall'anteprima live. Nessuna build richiesta: Three.js via CDN.

## I protagonisti

- **👽 L'Alieno Organico** — pelle organica ad alta risoluzione (LatheGeometry +
  shader custom con subsurface-scattering simulato e fresnel rim), occhi espressivi,
  antennae luminose, coda fluttuante. Stat: **timing più facile**.
- **🧑‍🚀 L'Astronauta** — tuta fotorealistica (capsule smussate, pannelli rigidi,
  tubi flessibili intrecciati, visore riflettente PBR metalness 1.0, zaino e
  serbatoi). Stat: **+25% mance, più veloce**.

Cambia barista con **TAB** o il pulsante dedicato: i due si alternano al bancone
con animazioni procedurali (Idle fluttuante, Versamento, Saluto, Volo zero-G).

## Gameplay

1. Leggi l'ordine nel fumetto 3D sopra il cliente (o nel pannello 📋).
2. Seleziona fino a 3 ingredienti cosmici (barattoli 3D cliccabili o pulsanti).
3. Premi **Prepara** e ferma l'ago nella zona verde (SPAZIO / click).
4. Clicca il cliente per servire: velocità + precisione = crediti e ⭐.
5. Completa l'obiettivo giornaliero, potenzia il locale, vai al giorno dopo.

- **🧲 Ancora magnetica**: ON = oggetti stabili; OFF = fluttuazione libera (+10% Cr).
- **Fisica zero-G**: tazze, barattoli e sfere di caffè fluttuano con moto sinusoidale.
- **Effetti**: rune cosmiche orbitanti, scintille iridescenti, pianeta con anello,
  ologramma menu, vapore magico sopra la tazza.

## Tech

Three.js r160 WebGL · pipeline PBR (ACES tone mapping, RoomEnvironment IBL,
PCF soft shadows) · mesh organiche ad alta risoluzione, zero low-poly grossolana.
