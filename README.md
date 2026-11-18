# Palm Shores

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/gemblongjos3-cmyk/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/gemblongjos3-cmyk/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Palm Shores** is an original open-world crime game that runs entirely in the browser — a
top-down 2D sunset city built with vanilla JavaScript, Canvas 2D and GSAP. Explore a coastal
city of named blocks, hotels, diners, a marina and piers on foot or behind the wheel of any
car you can reach: traffic keeps to its lanes, pedestrians stroll the boardwalk and scatter
when trouble starts, and the Shores PD answers a 1–5 star wanted level with cruisers that
chase, ram and shoot. A radar minimap, cash, health and ammo HUD, synthesized WebAudio sound
and a localStorage save round it out. No build step, no network requests: every file is
static and vendored locally, GSAP included.

## The story — missions

One chain of **6 story missions (8 objective steps)** for Luna, from the Anchor Diner to the
marina and back, each with its own reward and progress saved between sessions:

1. **Salt & Static** — pick up a package at the Marina Grill and deliver it to Pier Nine against the clock.
2. **Borrowed Time** — steal the red coupe by the diner and drive it into Bayline Garage.
3. **Tail Lights** — run the grey tail car off the road until it stops.
4. **Pier Nine** — clear the warehouse yard on foot: 3 armed targets.
5. **Heat Line** — shake the police until the wanted level reaches zero.
6. **The Long Goodnight** — drive the boss across the city to the marina under a 3-star wanted level.

## Side hunt — Sunset Stars

Twelve gold **Sunset Stars** stand hidden across the districts — downtown corners, dockside
pavements, the far avenues. Roll over one on foot or in a car to bank it for **+$150**; the
set is saved with your progress, and the hunt gives every free drive a direction.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move on foot / drive |
| Mouse | Aim |
| Left click | Shoot |
| E | Enter / leave a car |
| Shift | Sprint |
| R | Reload (restart mission / reset save in menus) |
| P / Esc | Pause |
| M | Mute sound |
| Enter | Start / confirm |
| C | Continue from save (start screen) |
| 1–6 | Mission markers |

## Run it

Play locally with the bundled static server (Node 22, standard library only):

```sh
node serve.ts --port 8123
# open http://localhost:8123
```

Build the hand-in dossier (copies `game/` and `screenshots/` and writes `dossier.json`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Deterministic screenshots of the game itself live in `screenshots/` and are described by
`shots.json` — each is a real render staged by the game's own `?shot=<scene>&seed=7` mode.

## License

MIT — see `LICENSE`.

<sub>Entered on [make.fun](https://make.fun/?ref=a12adhf8&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
