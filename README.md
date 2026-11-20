[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/gemblongjos3-cmyk/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/gemblongjos3-cmyk/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Palm Shores

Game open-world kriminal 3D orisinal dengan nuansa GTA 6, berlatar kota pesisir
fiktif di malam neon yang diguyur hujan: jalanan basah, langit ungu, papan neon,
siluet palem, dan distrik dermaga yang hidup. Dibangun dari nol dalam satu sesi
perekaman (r18) — semua kode, kota, cerita, dan suara ditulis sendiri di sesi ini.

## Cerita

Kamu adalah **Jax Marlowe**, pengemudi baru di Palm Shores. Fixer bernama **Rook**
memberimu lima pekerjaan lewat radio: ambil paket, curi mobil, kabur dari polisi,
bersihkan dermaga, lalu lari terakhir melewati kota. Kota ini milikmu — kalau kamu
bisa bertahan hidup di dalamnya.

## Kontrol

| Input | Aksi |
|---|---|
| W A S D | Jalan / mengemudi |
| Mouse | Arah pandang & bidikan (klik untuk mengunci pointer) |
| Klik kiri | Tembak pistol |
| E | Masuk / keluar mobil |
| Shift | Lari |
| Space | Handbrake (mengemudi) |
| P / Esc | Jeda |
| R | Mulai lagi setelah game over |

## Fitur

- **Kota 3D**: grid jalan 5×5, gedung dengan jendela menyala dan papan neon,
  pohon palem, lampu jalan, dermaga + laut, hujan miring, langit malam dengan
  bulan dan bintang, pantulan cahaya basah di aspal.
- **Berkendara**: jalan kaki dan mengemudi, kamera kejar, 5 tipe kendaraan
  (hatch, sedan, coupe, pickup, van) dengan handling berbeda, mobil bisa dicuri
  (parkir maupun lalu lintas).
- **Lalu lintas & pejalan kaki**: mobil AI mengikuti jaringan jalan, pejalan
  kaki berjalan di trotoar dan lari saat ada bahaya.
- **Wanted level**: bintang naik karena kejahatan yang terlihat (mencuri,
  tabrakan, tembakan, menabrak pejalan kaki) dan turun saat tak terlihat;
  mobil patroli mengejar dan menabrak, helikopter dengan lampu sorot di level 4+.
- **Pertarungan**: pistol dengan bidikan mouse, muzzle flash, reaksi kena tembak,
  health & armor, penjaga dermaga bersenjata.
- **Misi**: rantai cerita 5 misi (ambil/antar, curi mobil, kabur, baku tembak
  di dermaga, final) dengan penanda dunia, timer, hadiah uang, dan briefing
  radio dari Rook.
- **Konten sampingan**: uang tunai dan 20 koin palem tersebar di kota.
- **HUD**: health/armor, uang, amunisi, bintang wanted, objektif, timer misi,
  speedometer, dan minimap canvas live (jalan, pemain, polisi, penanda misi).
- **Suara**: semua disintesis WebAudio — deru mesin, sirene, tembakan, bunyi
  ambil item, dan ambience hujan. Tanpa file audio.
- **Save**: uang dan progres misi tersimpan di localStorage, dengan opsi Continue.

## Struktur file

```
game/
  index.html            shell + import map three.js + gaya HUD
  vendor/three/         three.js yang di-vendor (pustaka, jangan diedit)
  src/
    config.js           konstanta dunia, distrik, tuning, ekonomi
    random.js           RNG ber-seed (mulberry32) agar kota deterministik
    textures.js         tekstur prosedural dari canvas (fasad, neon, aspal)
    input.js            keyboard + mouse + pointer lock
    audio.js            semua suara disintesis WebAudio
    city.js             membangun kota: jalan, gedung, palem, lampu, dermaga, hujan
    vehicles.js         pabrik mobil + light bar polisi
    traffic.js          mobil AI + mobil parkir yang bisa dicuri
    pedestrians.js      pejalan kaki + perilaku lari dari bahaya
    player.js           kontrol jalan kaki + kamera follow
    driving.js          fisika mengemudi + masuk/keluar mobil + kamera kejar
    police.js           wanted level + mobil patroli pengejar
    airunit.js          helikopter polisi + lampu sorot
    combat.js           pistol + penjaga dermaga bersenjata
    missions.js         rantai 5 misi + penanda + hadiah
    collectibles.js     uang tunai + koin palem
    hud.js              layar, bar, bintang, minimap canvas
    save.js             localStorage
    shots.js            staging adegan screenshot lewat ?shot=<nama>&seed=<n>
    main.js             boot + game loop + state machine
```

## Cara membangun & menjalankan

Game ini file statis, tanpa build step dan tanpa jaringan:

```sh
node serve.ts            # http://localhost:8080
```

Screenshot (staging deterministik, seed 7):

```sh
# ?shot=cover | foot | docks | start
```

Dossier untuk juri dibuat dengan:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Cara game ini dibuat

Semua file di `game/src/` ditulis tangan dari deskripsi tugas, dalam sesi ini,
satu modul satu pekerjaan. Kota dibuat prosedural dengan seed tetap sehingga
adegan screenshot bisa diulang persis. Setelah game pertama kali jalan
end-to-end, tiga file direvisi (handling + handbrake di `driving.js`, cooldown
ram di `police.js`, timer misi di `hud.js`) dan adegan screenshot diperbaiki
sampai keempat gambar terbaca dengan jelas.
