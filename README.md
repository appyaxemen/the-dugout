# Team Dugout — Travel Baseball (PWA)

A lightweight offline-first web app for coaches and team admins. Installable on iOS/Android (Add to Home Screen) and desktop.

## Features
- Batting lineup builder (drag & drop; save by game)
- Team roster management
- Schedule (upcoming/completed; quick link to lineup)
- Stat tracker (AB, H, 2B, 3B, HR, BB, SO, R, RBI, SB, HBP, SF) with AVG/OBP/SLG/OPS
- Export/import data (JSON) and export stats (CSV)
- Dark/light theme, offline support (Service Worker)

## How to run
Just open `index.html` in a modern browser. To "install", open on your phone and add to Home Screen; the service worker will cache assets for offline use.

## Data
All data is stored locally (LocalStorage). Use export for backups or moving devices.

## Notes
This is a client-only app for simplicity. If you want multi-user sync, we can add a Firebase/Sheets backend later.
