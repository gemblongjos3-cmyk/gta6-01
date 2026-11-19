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

The HUD reads like a dispatcher's desk. A **left rail** carries the mission dossier — the
current chapter (`CH 7 — PAPER MOON`), its objective and condition line, a stage bar for its
steps, what comes next and the district — beside a **Shores PD response panel** that names
every responding unit (OSPREY-14, SANDPIPER-22, BONEFISH-08 and the rest), derives each one's
status — ramming, pursuit, intercept, roadblock, closing, patrol, air support — from its real
position, speed and distance, counts the units the panel cannot show (`+2 more units on
Tac-3`), and flags whether the player is IN SIGHT or EVADING. **Luna** speaks on a dispatch
dialogue strip with her own portrait, calling heat rises, nearby checkpoints and completed
jobs. The **minimap** draws an amber route that follows the actual avenues and streets to
the objective, shows police as heading triangles and the objective as a gold star under a
district label. The cockpit around it: a **DAY 1 clock** and cash top-right, **weapon slots**
for the three-gun arsenal (earned guns lit, the rest stamped LOCKED with their model names —
KESTREL 9, WASP 6149, MARLIN 12), **RESPECT and XP bars** under the radar, a radio pill
(WAVE 88.1 · Neon Drive) and a speedometer with gear (D1–D5) and a four-segment vehicle
condition bar with its exact percentage.

The response escalates like the real thing. At three stars a **police helicopter (AIR-1
OSPREY)** joins the hunt and holds its spotlight on the player; at four stars the department
stops chasing and starts **blocking** — cruisers parked nose-to-tail across the road ahead
behind striped barricades. A **weapon wheel** (hold Q) switches between the pistol, the
rapid WASP 6149 SMG and the six-pellet MARLIN 12 scattergun, each with its own magazine,
reserve, fire rate and spread; the SMG and scattergun are story payouts. Rooftop **FLAMINGO
FM billboards** light the downtown junction and the Pier Nine warehouse in neon pink.

## The story — missions

One chain of **8 story missions (12 objective steps)** for Luna, from the Anchor Diner to the
marina and back, each with its own reward and progress saved between sessions:

1. **Salt & Static** — pick up a package at the Marina Grill and deliver it to Pier Nine against the clock.
2. **Borrowed Time** — steal the pink Vespera GT coupe by the diner and drive it into Bayline Garage.
3. **Tail Lights** — run the grey tail car off the road until it stops. *(pays out the WASP 6149 SMG)*
4. **Pier Nine** — clear the warehouse yard on foot: 3 armed targets.
5. **Heat Line** — shake the police until the wanted level reaches zero. *(pays out the MARLIN 12 scattergun)*
6. **The Long Goodnight** — drive the boss across the city to the marina under a 3-star wanted level.
7. **Paper Moon** — lift the money at Pier Nine, lose a locked 4-star response (helicopter and roadblocks) before Luna's scanner window closes, then bring the money home to Bayline Garage.
8. **Star Run** — a checkpoint race around the Bayline block against a rival coupe: six checkpoints, winner takes the avenue's respect.

## Side hunt — Sunset Stars

Twelve gold **Sunset Stars** stand hidden across the districts — downtown corners, dockside
pavements, the far avenues. Roll over one on foot or in a car to bank it for **+$150** and
**+25 XP** toward your RESPECT level; the set is saved with your progress, and the hunt
gives every free drive a direction.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move on foot / drive |
| Mouse | Aim |
| Left click | Shoot |
| E | Enter / leave a car |
| Shift | Sprint |
| R | Reload (restart mission / reset save in menus) |
| Q (hold) | Weapon wheel |
| P / Esc | Pause |
| M | Mute sound |
| Enter | Start / confirm |
| C | Continue from save (start screen) |
| 1–8 | Mission markers |

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
