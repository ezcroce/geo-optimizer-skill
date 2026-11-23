# Modelli 3D (facoltativi)

Il gioco funziona anche senza file in questa cartella: albero, catasta di legna, pila di mattoni,
casetta e barile sono già ricreati in versione low-poly direttamente nel codice (`js/props.js`).

Se metti qui i file originali **con questi nomi esatti**, il gioco li carica da solo all'avvio
e li usa al posto di quelli procedurali:

| File | Dove viene usato |
|---|---|
| `01_albero.glb` | tutti gli alberi dell'isola (con dimensioni e tinte variate) |
| `02_legna.glb` | cataste di legna (nelle città, nei boschi, accanto alle casette) |
| `03_mattoni.glb` | pile di mattoni (nelle città, soprattutto in quelle con i container) |
| `05_casa.glb` | casette isolate in campagna (circa 50) |
| `06_barile.glb` | barili; quelli esplosivi vengono tinti di rosso |

Note:
- il modello viene raddrizzato se è in asse Z, centrato, appoggiato a terra e scalato alla misura giusta;
- vengono usati i colori dei materiali (le texture diventano il loro colore medio);
- `04_personaggi_3_varianti.glb` non viene caricato: i personaggi del gioco sono fatti a pezzi
  separati (braccia, gambe, testa) per poter essere animati. Le tre varianti sono state ricreate
  come skin: **Soldato Tattico**, **Esploratrice** e **Meccanico**.
