# Infinite Alibi

Prototipo giocabile di un gioco di deduzione sociale da circa 3 minuti. Il **Colpevole** manipola i
filmati di sorveglianza di una villa (taglia e cuci, deepfake, glitch). Gli **investigatori** cercano
i micro-indizi che ogni trucco lascia: timestamp incoerenti, continuità spaziale, ombre e oggetti.

Il design e i numeri di bilanciamento sono in [DESIGN.md](DESIGN.md).

## Avvio

Nessuna dipendenza e nessuna build. Apri `index.html` nel browser (va bene anche il doppio clic),
oppure servilo in locale:

```bash
cd games/infinite-alibi
python3 -m http.server 8000   # poi apri http://localhost:8000
```

## Modalità

* **🎉 Party**: da 3 a 6 giocatori sullo stesso schermo. Ruoli segreti passando il dispositivo, montaggio
  di nascosto, discussione a voce con il laser, voto segreto, classifica fra un caso e l'altro.
* **🕵️ Detective**: un Colpevole IA ha già truccato i filmati. Metti le puntine, presentale alla giuria
  di bot e accusa.
* **🎬 Colpevole**: sei tu il ladro. Monta il video tenendo d'occhio l'indicatore di rischio, poi
  difenditi da 4 investigatori bot.

Il campo "Caso n°" rigenera esattamente lo stesso caso, utile per sfidare gli amici sullo stesso filmato.

## Comandi

| Azione | Comando |
|---|---|
| Play/Pausa | `Spazio` |
| Fotogramma per fotogramma | `←` `→` |
| Puntina (raccolta prove) | clic su una telecamera |
| Ingrandisci una telecamera | doppio clic (`Esc` per tornare) |
| Laser (processo) | trascina sul video; `1`–`6` cambia giocatore in Party |

## Struttura

```
index.html, style.css
js/world.js     villa, personaggi, generazione deterministica del filmato reale
js/footage.js   manipolazioni, analisi dei micro-indizi, giuria di bot, Colpevole IA
js/render.js    rendering CCTV su canvas, laser, Replay Reale, animazione di espulsione
js/app.js       fasi di gioco e interfaccia
tests/sim.test.js
```

## Test

```bash
node games/infinite-alibi/tests/sim.test.js
```

I test verificano il determinismo e che il filmato reale non produca falsi indizi. Controllano anche
che ogni manipolazione lasci almeno un micro-indizio, che il deepfake conservi oggetto e ombra, che
il taglio mostri il timestamp della sorgente e che il Colpevole IA batta il "nessun trucco".
