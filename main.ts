// Palm Shores — a make.fun gta6-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder: a three.js open-world crime game
// (neon-night coastal city, on-foot + driving, wanted system, police helicopter,
// five story missions, collectibles, synthesized WebAudio) as plain static files
// a desktop browser loads offline. This program hands it in: it copies game/
// and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun
// library. It also validates the screenshots folder first (the dossier refuses
// a missing or oversized shot anyway, but a clear local error beats a cryptic
// one) and logs the entry title once the dossier is written.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const shotsDir = join(here, 'screenshots');

// Validate the screenshots folder: 3 or 4 JPEG/PNG renders, each under 256 KiB.
if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing — capture the 4 staged scenes first');
const shots = readdirSync(shotsDir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`screenshots/ holds ${shots.length} images, expected 3 or 4`);
}
for (const shot of shots) {
  const size = statSync(join(shotsDir, shot)).size;
  if (size > 262144) throw new Error(`screenshot ${shot} is ${size} bytes, over the 256 KiB cap`);
  console.log(`screenshot ok: ${shot} (${size} bytes)`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log('Palm Shores — dossier written to', join(out, 'dossier.json'));
