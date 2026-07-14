# Keret — tudatos költségvetés

Boríték-alapú (zero-based) költségvetés-app magyar felhasználóknak, beépített
„tudatos vásárlás" funkciókkal. **Local-first**: minden adat a felhasználó
böngészőjében (IndexedDB) tárolódik — nincs regisztráció, nincs szerver, nincs
üzemeltetési költség, a banki adatok nem hagyják el az eszközt.

## Funkciók

- **Boríték-módszer**: számlák, tranzakciók (kiadás/bevétel/átvezetés), magyar
  alap-kategóriakészlet, havi keret-hozzárendelés, automatikus maradvány-átvitel
  (carryover), túlköltés-jelzés, „Beosztható" összeg.
- **Láthatóvá tétel**: havi költés kategóriánként, 6 havi bevétel/kiadás trend.
- **Banki CSV-import**: OTP, K&H, Erste, Revolut, Wise presetek + bármilyen
  egyéb formátum kézi oszlop-hozzárendeléssel. Automatikus kódolás-felismerés
  (a magyar bankok gyakran ISO-8859-2 / Windows-1250 exportot adnak), magyar
  szám- és dátumformátumok, duplikátum-szűrés újraimportnál, menthető sablonok.
- **Megvegyem? (second opinion)**: vásárlás előtt a saját adataidból számolt
  tényeket tükrözi vissza — hasonló korábbi vásárlások, boríték-állapot,
  impulzus-kockázati jelzések. Nem tilt, nem moralizál.
- **Impulzus-detektálás**: hétvége/napszak/fizetés-utáni-napok mintázatok a
  diszkrecionális költésekben; csak elég nagy mintánál (n ≥ 8) és elég erős
  hatásnál (≥ 1,3×) szólal meg.
- **Alternatíva-ajánló**: Vinted / Jófogás / Marketplace keresőlinkek + javítás,
  kölcsönzés tippek — „kell-e egyáltalán újonnan?".
- **Előfizetés-audit**: ismétlődő terhelések automatikus felismerése
  (árkúszás-tűréssel), havi összköltség, „használom / nem használom /
  lemondtam" státuszok, lemondással megspórolt összeg.
- **72 órás kívánságlista**: a tétel várólistára kerül, csak 72 óra után
  dönthetsz; a „meggondoltam magam" tételek összege megtakarításként látszik.
- **„Igazi ár" kalkulátor**: az ár munkaóra-egyenértéke és a megtakarítási
  célod százaléka, a nettó jövedelmed alapján.
- **PWA**: telepíthető, offline is működik.
- **Mentés/visszaállítás**: teljes adatexport/-import JSON-ban.
- **Opcionális AI**: saját Anthropic API-kulccsal a Megvegyem?-vélemény
  LLM-generált szöveggé javítható. Kulcs nélkül minden funkció működik
  (szabályalapú szövegekkel).

## Futtatás

```bash
npm install
npm run dev        # fejlesztői szerver
npm run test       # vitest (motorok, importer, dátum/pénz-parsing)
npm run build      # típusellenőrzés + production build a dist/ mappába
npm run preview    # a build helyi kiszolgálása
```

## Deploy

A build teljesen statikus — bármelyik ingyenes static hostingra feltehető:

- **Vercel**: a repo `app/` mappáját add meg root directorynak; a
  `vercel.json` SPA-rewrite már benne van.
- **Netlify**: build command `npm run build`, publish `dist`; a
  `public/_redirects` SPA-fallback már benne van.

## Architektúra

- Vite + React + TypeScript, react-router
- Dexie (IndexedDB) + `useLiveQuery` — a DB az egyetlen state-forrás
- Minden összeg **integer HUF**, minden dátum `YYYY-MM-DD` string
- Elemző motorok tiszta függvények a `src/lib/` alatt (unit-tesztelve):
  - `budgetMath.ts` — boríték-egyenlegek kumulatív összegekből
  - `recurrence.ts` — előfizetés-felismerés (intervallum-medián + konfidencia)
  - `impulse.ts` — impulzusminta-statisztika zajszűréssel
  - `similarity.ts` / `normalize.ts` — kereskedőnév-egyezés (bigram + Jaccard)
  - `payday.ts` — fizetésnap-következtetés a bevétel-idősorból
  - `importer/` — kódolás-detektálás, preset-felismerés, dedup
  - `advisor/` — a Megvegyem? tényei és szöveg-sablonjai

## Tudatos kompromisszumok

- **Nincs backend**: az adat eszközhöz kötött; eszközök közti szinkron később
  (pl. Supabase) építhető rá. Addig a JSON-export a mentés.
- **API-kulcs a böngészőben**: az opcionális AI-funkció a felhasználó saját
  kulcsát az eszközén tárolja (exportba sosem kerül). Hostolt edge-function
  mögé költöztethető, ha lesz backend — az `advisor/llm.ts` interfésze ehhez
  változatlan maradhat.
- **Banki presetek heurisztikák**: a bankok exportformátumai változnak, ezért
  a preset csak kiindulópont — a végső kontrakt a kézi oszlop-hozzárendelő UI.
