# jassen-webapp-public

A browser-based Swiss Jass game with diffrent gamemodes:

- **Bieter** (3 players, teams) - add here

- **Pandur** (2-4 players) - add here

- **Schieber** (4 players, teams) — trump selection with Schieben, Stöck, match bonus.
  Round 1 is led by the holder of the **Rosen 10**. Trump multipliers: Rosen/Eichel ×1,
  Schelle/Schilten ×2, Obenabe/Undenufe ×3. Configurable target score (default 2500).
- **Differenzler** (4 players) — predict a **card-point total** (0–157); penalty is the
  absolute difference from your actual points. Random trump each round; 12 rounds; lowest
  total wins.
- **Fuck Your Neighbour** (2–6 players) — round sizes ramp 1→6→1; the **8 is the highest
  rank**; suit hierarchy Rosen > Eichel > Schelle > Schilten; no follow-suit. In 1-card
  rounds you see everyone's card except your own.

Rooms are shareable by link, the in-game UI is in **German**, and each mode has a
**Regeln** button that opens its rules. A live **Rangliste** (leaderboard) is available
during play, and the host can start a new game (**Neues Spiel**) once a game ends.

## Structure

- `packages/game-engine` — pure, unit-tested TypeScript rules engine (Vitest).
- `apps/server` — Express + Socket.io realtime server (in-memory rooms).
- `apps/web` — Next.js client.
- `apps/web/.env` - .env-File for privacy policy and others

## Development

```bash
npm install
npm run test:engine        # run the engine test suite
npm run dev:server         # http://localhost:4000  (tsx watch)
npm run dev:web            # http://localhost:3000  (next dev, HMR)
```

Start each dev server **only once** — running `npm run dev` twice causes port conflicts
and stale hot-reload. Set `NEXT_PUBLIC_SERVER_URL` (web) / `CLIENT_ORIGIN` (server) to
override the defaults. The client version shown in the start-page footer comes from
`apps/web/package.json`.

## License
This project follows a dual-licensing model to separate the application logic from the creative media assets:

* **Source Code:** The source code of this web application is licensed under the [GNU General Public License v3 (GPLv3)](LICENSE).
* **Card artwork:** All images used within this application are strictly excluded from the GPLv3 and are licensed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/) license. 

### Commercial Use Notice
Due to the Creative Commons license of the image assets, **any commercial use, monetization, or distribution of this application that includes these images is strictly prohibited.** If you wish to use the source code commercially under the terms of the GPLv3, you must completely remove or replace all CC BY-NC-SA 4.0 protected images first.

## Card artwork - Link
Cards are from [diegosteiner/ch_jasskarten_svg](https://github.com/diegosteiner/ch_jasskarten_svg),
licensed **CC BY-NC-SA 4.0 (non-commercial)**. See `apps/web/public/cards/ATTRIBUTION.md`.

## How to setup (Work)