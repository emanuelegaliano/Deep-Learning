# Deep Learning

Comandi da usare:
- `make` per compilare i sorgenti latex
- `make clean` per pulire
- `make web` per generare la versione web in `out/web`
- `make web-dev` per la versione web con server di sviluppo (http://localhost:5180), che si aggiorna a ogni salvataggio
- `make web-check` per controllare i sorgenti senza generare niente

La versione web usa [texweb](https://github.com/emanuelegaliano/texweb), da clonare accanto a questa repo (`../texweb`, con `npm install`). Se è altrove: `make web TEXWEB=/percorso/di/texweb/bin/texweb.js`.

Le figure interattive della versione web sono in `widgets/`: nel PDF ciascuna di queste figure resta la figura TikZ (o l'immagine) di sempre.
