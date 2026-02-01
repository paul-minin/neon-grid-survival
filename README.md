# Neon Grid Survival 🎮

Minimalistisches Neon-Top-Down Endlos-Spiel (HTML5 Canvas, Vanilla JS). Spielbar auf PC und iPad.

Features
- 20×20 wiederholendes Spielfeld
- Spieler sammelt Energie-Orbs, baut Blockfelder, Slow-Felder, Häuser und **Turrets (Verteidigungsanlagen)**
- Gebiet (Territorium) einnehmen (Taste `C` oder Häuser bauen) und auf eigenen Feldern Verteidigungsanlagen bauen
- Neu: Auf der aktuellen Kachel kannst du jetzt mit **Buy Tile (5 Energy)** Kacheln kaufen (nur verbunden / angrenzend an bestehendes Gebiet). Auf einer gekauften Kachel kannst du **Upgrade → Turret (8 Energy)** drücken, um ein Geschütz zu bauen.
- Wellenmodus: Aliens kommen als Wellen (jede ~1 Minute), Anzeige oben zeigt **Wave** und Countdown bis zur nächsten Welle.
- Aliens bewegen sich zufällig, greifen Gebäude an; Turrets schießen automatisch auf Aliens
- Pixeliger, neonfarbener Look (canvas pixelated)
- Highscore gespeichert in localStorage
- Touch & Keyboard Steuerung

Wie starten
1. Öffne `index.html` im Browser (oder nutze einen lokalen Server).
2. Verwende WASD / Pfeiltasten oder die Buttons für Bewegung.
3. Klick/Tap auf eine Kachel, um dort zu bauen (Tool im Toolbar wählen).

Deployment zu GitHub Pages
1. Erstelle ein neues Repo und kopiere diesen Ordner hinein.
2. `git add . && git commit -m "Add neon grid game" && git push origin main`
3. Aktiviere GitHub Pages in den Repo-Settings (Branch: `main`, Ordner: `/`).

Viel Spaß! ✨