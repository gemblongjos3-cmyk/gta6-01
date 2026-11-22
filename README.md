[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/gemblongjos3-cmyk/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/gemblongjos3-cmyk/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Palm Shores

A 3D open-world crime game in the spirit of GTA 6, built with three.js — set in
Palm Shores, a fictional neon-night coastal city: rain-slick streets, violet
skies, neon signs, palm silhouettes and a working docks district. Everything
here is original: the city name, districts, characters, story, art and sounds.

You play a newcomer taking jobs from Reno, a radio dispatcher. Steal cars,
outrun the police, survive a shootout at the docks, and pull off the final
getaway — or just cruise Neon Row collecting street cash while the rain falls.

## How to play

- **W A S D** — walk / drive (W gas, S brake & reverse, A/D steer)
- **Shift** — run on foot
- **Mouse** — orbit camera / aim; click the canvas to lock the mouse for aiming
- **Click** — shoot the pistol (on foot)
- **E** — enter / exit the nearest car (stealing in front of witnesses raises your wanted level)
- **R** — reload the pistol · **H** — horn · **Esc / P** — pause

Systems: wanted stars that rise with witnessed crime and decay when you go
quiet, police cruisers that pursue and ram, a police helicopter with a
searchlight at 4+ stars, traffic and pedestrians who flee danger, six vehicle
types with different handling, a 5-mission story chain with cash rewards, cash
pickups and palm-star collectibles, health + armor, a live minimap, and
WebAudio-synthesized engine hum, sirens, gunshots, chimes and rain. Progress
(cash + mission) saves to localStorage — continue from the title screen.

## Missions

1. **Paket Neon** — pick up a package in Neon Row, deliver it to the Old Docks.
2. **Ekor Si Kuning** — tail a yellow taxi for 30 seconds without being spotted.
3. **Kabur dari Panas** — lose a 3-star police chase.
4. **Baku Tembak di Dermaga** — clear six armed thugs from the docks.
5. **Pelarian Terakhir** — steal the Night Muscle in Vice Mile and break through to Coral Bay.

## File structure

```
game/
  index.html            page, HUD, title / pause / game-over screens
  vendor/three/         three.js (vendored library, untouched)
  src/
    config.js           tuning, districts, vehicle types, mission definitions
    random.js           seeded RNG (deterministic ?seed= runs)
    input.js            keyboard + mouse state
    textures.js         procedural canvas textures (windows, roads, neon, water)
    city.js             sky, road grid, buildings, palms, lamps, docks, rain
    vehicles.js         car meshes + car records
    traffic.js          AI traffic + parked cars
    pedestrians.js      sidewalk walkers, fleeing, armed docks thugs
    player.js           on-foot movement, entering / exiting cars
    driving.js          car handling, collisions, chase + foot cameras
    police.js           wanted stars, cruiser spawn / pursuit / ram / bust
    airunit.js          police helicopter + searchlight
    combat.js           pistol, muzzle flash, raycast hits
    missions.js         5-mission story chain, markers, timers, rewards
    collectibles.js     cash pickups + palm stars
    hud.js              HUD bars, wanted stars, objective, live minimap
    audio.js            WebAudio-synthesized sounds (no audio files)
    save.js             localStorage save of cash + mission progress
    shots.js            deterministic screenshot scene staging (?shot=)
    main.js             boot, fixed-step loop, screens, shot mode
main.ts                 dossier build (copies game/ + screenshots/ to /output)
serve.ts                static server for game/ on port 8080
shots.json              the 4 staged screenshot scenes
```

## Run it

```sh
node serve.ts            # http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # build the dossier
```

## How it was built

Written from scratch in one recorded authoring session for the make.fun
gta6-01 bounty: every game file composed here, three.js vendored as the only
library, all visuals generated in code (canvas textures / three.js geometry /
CSS) — no image, font or audio files anywhere in the game. Screenshots are
staged deterministically through `?shot=<name>&seed=7`.
