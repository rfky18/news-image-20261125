# BUILD-NOTE — news-image-20261125, varian frontpage (repo-frontpage)

## Artefak
- `output/entry.png` — 1024×1024 RGB, **217.562 byte** (jauh di bawah 1 MiB;
  tie-break ukuran file menguntungkan: lebih kecil dari #1 live 467.884 byte).
- sha256: `ce13f1dcd597a4d1a9039dd8f36420816074f18ce93be31b2416057058c6cf21`
- Determinisme: 3 run (2× `output/` lokal + 1× `MAKEFUN_OUTPUT_DIR=/tmp/fp-out`)
  → sha256 IDENTIK. Tanpa network saat runtime (grep: 0 fetch/http),
  tanpa `Date.now()`/random. Output-dir resolver: env → `/output` → lokal
  (terverifikasi: run tanpa env menulis ke `/output` karena direktori itu ada).
- main.ts ditulis dari nol di repo ini (tidak membaca main.ts kandidat lain).

## 35 cerita (nomor di gambar = nomor di bawah)
### Featured (11, bervignette + headline + caption + sumber)
1. HODEIDAH — Saudi-led strikes hit Hodeidah port (hero). Reuters/Al Jazeera/ANI, 25 NOV.
2. SHENZHOU-24 — Lifts off with Pakistan's first astronaut (Zeeshan Ali, 00:18 UTC). Reuters/Xinhua, 25 NOV.
3. AI STOCKS — Asia's AI stocks plunge again (Kospi −5,9%, SoftBank −14,8%). AP/Reuters, 25 NOV.
4. UKRAINE — Abu Dhabi talks end in deadlock. Nexus Europa/AP, 25 NOV.
5. CARTAGENA — All hostages freed in dawn raid (01:00, 1 tewas, 4 ditahan). AFP/Sky News, 25 NOV.
6. CHINA — Shanghai party chief Chen Jining probed (ke-4 sejak 2025). Reuters/Xinhua, 25 NOV.
7. SOLOMONS — Treaty puts Australia first (tanpa pangkalan asing). PM.gov.au/Reuters, 25 NOV.
8. GAZA — Strike kills four in Shati camp. Al Jazeera, 25 NOV.
9. HORMUZ — Two tankers hit mines, Iran says (CLAIM, belum terverifikasi). IRNA/Mehr, 25 NOV.
10. HERA — Shows Dimorphos up close (reveal gambar pertama). BBC/ESA, 25 NOV.
11. BANGLADESH — Garment wage up 36% to 17,000 TK. Reuters/AP/AFP, 25 NOV.

### Also on (24, daftar + tanggal)
12. NVIDIA falls 5.9% (25 NOV) · 13. HOUTHIS threaten Jeddah (25 NOV) ·
14. PUTIN invites EU leaders (25 NOV) · 15. ZELENSKY rejects Lukashenko offer
(25 NOV) · 16. US ENVOYS Kushner, Witkoff reach Moscow (25 NOV) ·
17. ZAPORIZHZHIA strike kills 2, wounds 22 (25 NOV) · 18. XI urges Party
rule-building (25 NOV) · 19. HUAWEI guilty 10 of 12 (24 NOV) · 20. RIYADH
drone hits tower, 11 hurt (24 NOV) · 21. SARKOZY ordered to trial with Bruni
(24 NOV) · 22. BENGHAZI two sailors die of wounds (24 NOV) · 23. REAL MADRID
rout PSV 5-1 (24 NOV) · 24. SINGAPORE growth forecast ~6% (24 NOV) ·
25. VENEZUELA debt $237.5B (24 NOV) · 26. WHO urges US to lift Cuba fuel
blockade (24 NOV) · 27. WAR DEAD Russia's own data: 490,334 killed (25 NOV) ·
28. WINDSOR two arrested after break-in (24 NOV) · 29. SENEGAL AFCON title
restored by CAS (24 NOV) · 30. MISS UNIVERSE Barreto wins in San Juan
(24 NOV) · 31. TRUMP pardons turkeys Freedom, Feathers (24 NOV) ·
32. VILLAVICENCIO car bomb wounds 23 (23 NOV) · 33. EBOLA fighting stalls
Congo response (25 NOV) · 34. BOGOR 26 miners trapped (25 NOV) ·
35. US TARIFFS new duties for 16 partners (25 NOV).

### Region (7)
Middle East 5 · Europe 9 · Americas 7 · Asia-Pacific 9 · Africa 3 ·
Oceania 1 · Space 1. Total 35. Peta dunia ber-pin bernomor 1–11 (10 = Hera,
luar angkasa, tanpa pin) + legenda hitungan region.

## Verifikasi (dibaca full-res + crop per blok, bukan pixel scan)
- Ejaan: semua teks dibaca dari crop full-res — benar. Tanggal: Sarkozy 24 NOV,
  Riyadh 24 NOV, Villavicencio 23 NOV, Huawei 24 NOV, Real Madrid 24 NOV,
  Singapore 24 NOV, Venezuela 24 NOV, WHO-Cuba 24 NOV, Windsor 24 NOV,
  Senegal 24 NOV, Miss Universe 24 NOV, Trump turkeys 24 NOV — semua jujur,
  tidak ada yang dilabeli 25 Nov. Tidak ada "ruling 24 Nov" untuk Sarkozy.
- 35 cerita terhitung (11 featured + 24 daftar), 7 region terwakili.
- Kolom rata, garis pembatas tebal kelihatan (rule 2–4px), tidak ada teks
  terpotong/tumpang tindih setelah 2 putaran perbaikan (hero headline,
  daftar ALSO, legenda peta).
- Thumbnail 300px: masthead tanggal + headline hero + angka stat strip
  terbaca; struktur koran langsung dikenali.
- Font: Bodoni (masthead), Libre Baskerville Bold (headline), Gelasio
  (caption/kicker), Liberation Sans (label) — semua dari TTF asli via atlas.

## Bug yang ditemukan & diperbaiki saat build
1. Atlas builder: pack pass memakai `size` sisa loop → semua glyph Bodoni:58
   hilang. Diperbaiki: offset glyph disimpan dari measure pass.
2. `px()` dengan koordinat pecahan .5 menulis 4 byte bergeser 2 byte
   (piksel merah jadi hijau terang; pin peta 5 hijau, pin lain hilang).
   Diperbaiki: `px()` membulatkan koordinat ke integer.
3. Hero headline 2 baris menimpa caption; daftar ALSO tumpang tindih
   (teks melewati tag tanggal); legenda peta terpotong. Diperbaiki:
   headline hero 1 baris, caption kartu dipangkas, rest ALSO dipendekkan
   + truncation defensif, legenda disingkat.

## Kelemahan yang masih ada (penilaian jujur)
- Vignette 100% vektor programatik (tanpa foto): hero Hodeidah terbaca
  (pelabuhan + crane + kapal + asap), tapi vignette kartu 242×52 sangat
  padat — adegan "talks" Ukraina dan "Gaza" paling lemah (terbaca sebagai
  pita warna + satu bentuk). Top-5 live punya vignette yang sedikit lebih
  kaya (lebih banyak detail per adegan).
- Peta dunia: bentuk benua kasar (Amerika Utara/Selatan menyatu di
  tanah genting; Asia–Eropa–Afrika satu massa) — pin + legenda yang
  membawa maknanya, bukan bentuk benua.
- Breadth vs top-1/top-2: 35 cerita (target) vs 39–50 cerita mereka;
  region Oceania dan Space masing-masing hanya 1 cerita. Afrika hanya 3.
- Tidak ada ilustrasi foto/generatif — ini pilihan sadar (deterministik,
  offline, tanpa watermark); trade-off craft vs foto.
- Local-judge vs top-5 (kriteria verbatim): menang kriteria 1 (tanggal
  besar + semua cerita ber-tanggal + DATE CHECK eksplisit) dan 4 (setia:
  klaim Hormuz diberi label CLAIM, tanggal 24/23 Nov jujur — lebih jujur
  dari top entries yang melabeli cerita 24 Nov sebagai 25 Nov); seri/lebih
  lemah di 2 (breadth 35 vs 39–50) dan 3 (vignette kartu kecil kurang
  deskriptif dibanding top-5); seri di 5 (komposisi koran klasik rapi,
  terbaca di 300px). Perkiraan: kompetitif untuk zona 11–50, bukan
  penantang top-10 — kecuali judge menghargai kejujuran tanggal di atas
  jumlah cerita.
