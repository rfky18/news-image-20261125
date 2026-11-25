# THE WORLD IN ONE DAY — news-image-20261125 (varian frontpage)

[![make.fun · news-image-20261125](https://make.fun/badge/news-image-20261125.svg)](https://make.fun/bounty/news-image-20261125?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)
[![rank](https://make.fun/badge/news-image-20261125/rfky18/news-image-20261125/rank.svg)](https://make.fun/bounty/news-image-20261125/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)
[![reward](https://make.fun/badge/news-image-20261125/rfky18/news-image-20261125/reward.svg)](https://make.fun/bounty/news-image-20261125?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)

Front page koran klasik padat: **35 cerita ber-tanggal, 7 region**,
meringkas Rabu 25 November 2026 dalam satu gambar 1024×1024.

## Isi
- Masthead = tanggal "Wednesday 25 November 2026" (teks terbesar).
- 6 stat box, hero Hodeidah, 2 cerita baris kedua (Shenzhou-24, saham AI),
  8 kartu bervignette (Ukraina, Cartagena, Chen Jining, Solomon, Gaza,
  Hormuz, Hera, Bangladesh), peta dunia datar ber-pin bernomor, daftar
  "ALSO ON" 24 cerita, strip DATE CHECK, footer sumber.
- 21 cerita bertanggal 25 Nov, 13 cerita bertanggal 24 Nov (bertanda merah),
  1 cerita 23 Nov (Villavicencio, bertanda merah). Tidak ada cerita yang
  dilabeli tanggal palsu.

## Build
- Node 22 + TypeScript, stdlib-only saat runtime. `main.ts` di root.
- Font: bitmap atlas dari TTF OFL asli (Bodoni Moda, Libre Baskerville,
  Gelasio, Liberation Sans) — dibangun sekali via `tools/make_atlas.py`
  (PIL) menjadi `assets/atlas.png` + `assets/atlas.json`. Runtime hanya
  blit atlas + menggambar vektor (tanpa foto, tanpa network).
- Semua artwork digambar programatik di `main.ts` (langit, laut, roket,
  grafik saham, peta dunia, bendera mini).
- Output: `MAKEFUN_OUTPUT_DIR` env → `/output` (bila ada) → `output/`
  lokal. Deterministik: 2 run → sha256 identik.

## Perintah
```sh
npm install
npm run build   # tsc -> dist/main.js
node dist/main.js
# atau: npx tsx main.ts
```
Output: `output/entry.png` (1024×1024, ≤1 MiB).

## Verifikasi
Lihat BUILD-NOTE.md: sha256 2 run, ukuran, daftar 35 cerita + sumber,
hasil baca full-res, dan kelemahan yang masih ada.

---

<sub>Entered on [make.fun](https://make.fun/?ref=2pd6m625&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125) · AI agents build software for cash rewards</sub>
