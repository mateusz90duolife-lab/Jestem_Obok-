# MOST BLISKOŚCI

Premium talia 77 kart dla dwojga. To repozytorium nie zawiera „projektu karty" —
zawiera **system**, który tę talię generuje: tokeny, silnik typograficzny,
komponenty kart, rasteryzer, QA i prepress. Karty są artefaktem, nie źródłem.

```
CONTENT JSON → DESIGN TOKENS → LAYOUT ENGINE → TEXT MEASUREMENT → AUTO-FIT
   → SVG → STRUCTURAL QA → PNG (300 DPI) → PIXEL QA → PROOFS → CONTACT SHEET → QA REPORT
```

Jedno polecenie buduje całość:

```bash
npm run build
```

---

## 1. Stan na dziś

| | |
|---|---|
| Karty | 60 pytań + 12 sytuacji + 5 mostów = **77** + 1 rewers |
| SVG | 77 awersów + 1 rewers, 76 × 106 mm |
| PNG | 78 plików, 898 × 1252 px (300 DPI) |
| Overflow | 0 |
| Naruszenia safe area | 0 (geometryczne i pikselowe) |
| Testy | 115, wszystkie zielone |
| Zależności npm | **brak** |
| Fonty | **SUBSTITUTED** — patrz §3 |

`AUTOMATED QA: PASS` **nie znaczy** `PRINT PROOF APPROVED`. Walidacja maszynowa
i przegląd wizualny przez człowieka to dwa osobne kroki; raport rozdziela je
jawnie.

---

## 2. Dlaczego zero zależności

W tym środowisku proxy odmawia dostępu do rejestru npm, PyPI i
`fonts.googleapis.com` (HTTP 403). Nie ma więc `opentype.js`, `resvg`, `sharp`,
`typescript` ani `vitest`. Zamiast udawać, że są, system stoi wyłącznie na tym,
co daje Node 22:

| Potrzeba | Zwykle | Tutaj |
|---|---|---|
| TypeScript | `tsc` / `tsx` | natywne type stripping w Node 22 (`node src/cli.ts`) |
| metryki fontów | opentype.js | własny parser TrueType + GPOS (`src/fonts/ttf.ts`) |
| SVG → PNG | resvg / sharp | headless Chromium (`src/render/chromium.ts`) |
| odczyt/zapis PNG | sharp / PIL | własny kodek na `node:zlib` (`src/qa/png.ts`) |
| testy | vitest / jest | `node:test` |

**Konsekwencja, którą trzeba znać:** bez pakietu `typescript` w tym środowisku
nie da się uruchomić pełnego sprawdzania typów. `tsconfig.json` jest kompletny
i przeznaczony dla edytora oraz dla CI, które ma dostęp do rejestru
(`npx tsc --noEmit`). Kod trzyma się składni „erasable-only", więc Node go
wykonuje bez transpilacji: bez `enum`, bez parametrów-właściwości w
konstruktorze, z `import type`.

---

## 3. Fonty — stan SUBSTITUTED

System jest zaprojektowany na **Cormorant Garamond** (display) i **Manrope**
(UI). Żadnego z nich nie da się w tym środowisku pobrać. Zgodnie z zasadą „nie
podmieniaj fontu po cichu", pipeline **nie** sięga po domyślny krój systemowy.
Zamiast tego `fonts.config.json` deklaruje jawny profil zastępczy, a każdy
artefakt — SVG, manifest, raport, wydruk CLI — zapisuje, że był użyty.

| Rola | Specyfikacja | W użyciu | Licencja |
|---|---|---|---|
| display | Cormorant Garamond | Instrument Serif | OFL 1.1 |
| ui | Manrope | Instrument Sans | OFL 1.1 |

Zastępniki dobrano wizualnie (`scripts/`-owy arkusz specimenów, przegląd
renderów): Instrument Serif ma wysoki kontrast i delikatność zbliżoną do
Cormoranta, Instrument Sans jest jego zaprojektowaną parą, ma wysoką wysokość
x i pełne pokrycie polskich znaków. Mapowanie grubości jest **stratne** i
zapisane w raporcie: Instrument Serif nie ma SemiBold (600 → Regular),
Instrument Sans nie ma Medium ani SemiBold (500 → Regular, 600 → Bold).

### Przywrócenie stanu EXACT

Wrzuć pliki do `assets/fonts/` i przebuduj:

```
assets/fonts/CormorantGaramond-Medium.ttf
assets/fonts/CormorantGaramond-SemiBold.ttf
assets/fonts/CormorantGaramond-Italic.ttf
assets/fonts/Manrope-Regular.ttf
assets/fonts/Manrope-Medium.ttf
assets/fonts/Manrope-SemiBold.ttf
```

```bash
npm run build          # status fontów przełączy się na EXACT
node scripts/update-baseline.ts   # nowa baseline; przeczytaj diff
```

Nazwy plików są kontraktem z `fonts.config.json`. Brak pliku bez zadeklarowanego
zastępnika daje status `MISSING`, co jest twardym błędem, a nie ostrzeżeniem.

---

## 4. Geometria druku

```
Trim       70 × 100 mm        obszar po cięciu
Bleed       3 mm z każdej strony
Full       76 × 106 mm        artboard, na którym pracuje generator
Safe area  60 × 90 mm         5 mm od linii cięcia, x=8 y=8
Content    54 × 85 mm         kolumna layoutu, 8 mm padding
Narożniki   4 mm              specyfikacja wykrojnika, nie grafika
viewBox    0 0 76 106         1 jednostka = 1 mm
Raster     898 × 1252 px      300 DPI
```

`CARD / MASTER` (70 × 100) i `PRINT / BLEED` (76 × 106) to **dwa eksporty
jednego komponentu**, nie dwa komponenty. Generator zawsze składa na artboardzie
ze spadem; master to ten sam plik przycięty do trimu przez zmianę `viewBox`.
Żadna współrzędna się nie zmienia — pilnuje tego test.

Tło jest zawsze pełnospadowe, więc w SVG nie ma rysowanego zaokrąglenia
narożnika; promień 4 mm to informacja dla wykrojnika, zapisana w
`output/print/print-spec.json`.

### CMYK

Pipeline pracuje w sRGB i **nie wykonuje separacji barwnej**. Finalna konwersja
do CMYK należy do przygotowania do druku, zgodnie z profilem ICC drukarni.
Wartości w `design-tokens.json` są celem wizualnym, nie wartościami CMYK.

Tekst w SVG jest żywy, nie zamieniony na krzywe. Do drukarni trzeba przekazać
pliki fontów razem z grafiką albo zamienić tekst na krzywe na etapie prepressu.

---

## 5. Struktura

```
most-bliskosci/
├── design-tokens.json        FOUNDATIONS: kolor, poziomy, typografia, geometria, auto-fit
├── fonts.config.json         kontrakt fontowy + profil zastępczy
├── assets/fonts/             pliki fontów + licencje
├── src/
│   ├── types.ts              model danych (union rozłączny, bez `any`)
│   ├── tokens.ts             ładowanie i walidacja tokenów
│   ├── paths.ts
│   ├── data/                 ŹRÓDŁO PRAWDY DLA TREŚCI
│   │   ├── questions.json    60 pytań
│   │   ├── situations.json   12 sytuacji
│   │   └── bridges.json      5 mostów
│   ├── content/              ładowanie i QA treści (duplikaty, poziomy, placeholdery)
│   ├── fonts/
│   │   ├── ttf.ts            parser TrueType: head/hhea/hmtx/cmap/kern + GPOS
│   │   ├── registry.ts       rozstrzyganie fontów: EXACT / SUBSTITUTED / MISSING
│   │   └── measure.ts        pomiar, łamanie wierszy, TextLayoutResult
│   ├── layout/
│   │   ├── geometry.ts       trim / safe / content, siatka 12-kolumnowa
│   │   ├── bridgeMark.ts     KOMPONENT: Bridge Mark (parametryczny)
│   │   ├── autofit.ts        10 strategii naprawy + ocena jakości
│   │   ├── question.ts       KOMPONENT: Card / Question
│   │   ├── situation.ts      KOMPONENT: Card / Situation
│   │   ├── bridge.ts         KOMPONENT: Card / Bridge
│   │   └── back.ts           KOMPONENT: Card / Back
│   ├── svg/                  emisja SVG (deterministyczna, samowystarczalna)
│   ├── render/chromium.ts    rasteryzacja 300 DPI, własny fontconfig
│   ├── build/                generate, rasterise, print export
│   ├── qa/                   svgQa, pixel, png, sheets, stats, report, proofIndex
│   ├── pipeline.ts           jedyny pipeline
│   └── cli.ts
├── scripts/
│   ├── calibrate.ts          zgodność silnika pomiaru z rendererem
│   └── update-baseline.ts    aktualizacja baseline regresji
├── test/                     115 testów
└── output/                   WYGENEROWANE — nie edytować ręcznie
```

---

## 6. Model danych

```ts
type Card = QuestionCard | SituationCard | BridgeCard | BackCard;
```

Rozłączny union po polu `type`, bez `any` w rdzeniu. Każda karta ma stabilne
`id`. Poziom pytania jest **wyprowadzany z jego numeru** i porównywany z tym, co
w JSON — `Q13` nie może przypadkiem trafić do POZNAJ.

| Poziom | Nazwa | Kolor | Karty |
|---|---|---|---|
| 01 | POZNAJ | `#A98272` | Q01–Q12 |
| 02 | ODKRYJ | `#8E6260` | Q13–Q24 |
| 03 | OTWÓRZ SIĘ | `#75464F` | Q25–Q36 |
| 04 | ZBLIŻ SIĘ | `#672F3D` | Q37–Q48 |
| 05 | WYBIERZ NAS | `#43202A` | Q49–Q60 |

Talia stopniowo ciemnieje wraz z pogłębianiem relacji — nośnikiem jest wyłącznie
kolor poziomu. Test wymusza monotoniczny spadek luminancji.

### Dodanie karty

Dopisz rekord do `src/data/questions.json` i uruchom `npm run build`. Generator
nie wymaga żadnej zmiany w kodzie.

---

## 7. Pomiar tekstu

To jest podsystem, nie funkcja pomocnicza. **Szerokość nie jest szacowana z
liczby znaków.** `src/fonts/ttf.ts` czyta prawdziwe tabele: `hmtx` (advance),
`cmap` (mapowanie znaków), `hhea`/`OS/2` (metryki pionowe) oraz pary kerningowe
z `kern` i z GPOS (lookup typu 2, formaty 1 i 2, z obsługą Extension).

API: `measureText`, `wrapText`, `calculateLines`, `calculateHeight`,
`calculateBoundingBox`, `layoutText` → `TextLayoutResult`.

Dwie rzeczy wykraczają poza zwykłe łamanie:

- **Wyrównanie chorągiewki.** Po ustaleniu minimalnej liczby wierszy program
  dynamiczny wybiera podziały minimalizujące sumę kwadratów luzu **wszystkich**
  wierszy, ostatniego też. Pominięcie ostatniego — klasyczny koszt dla tekstu
  justowanego — wypełnia wiersze początkowe i zostawia ogon na krótkim wierszu
  końcowym.
- **Polskie sieroty.** Jednoliterowy spójnik lub przyimek (`a i o u w z`) nigdy
  nie kończy wiersza — jest przenoszony razem z następnym słowem.

### Kalibracja

```bash
node scripts/calibrate.ts
```

Mierzy te same ciągi silnikiem i rendererem. Zgodność na tym zestawie fontów:
**0,025 mm (0,073 %)** w najgorszym przypadku. Dlatego tolerancja safe area
wynosi 0,3 mm — dwunastokrotny zapas, a nie zamiatanie błędu pod dywan. Test
pilnuje, żeby tolerancja została zapasem.

---

## 8. Auto-fit i odpowiednik Auto Layout

Nagłówek i stopka mają **stałe** pozycje na wszystkich 60 kartach pytań. Wolny
jest wyłącznie blok pytania: jego wysokość liczy się z liczby wierszy razy
interlinia, a blok jest centrowany w pasie między nagłówkiem a stopką. Karta z
dwoma wierszami i karta z sześcioma mają tę samą ramę.

Auto-fit ocenia **dziesięć** ustalonych strategii i wybiera najwyżej ocenioną
poprawną — nie pierwszą, która się zmieści:

| # | Strategia | Co zmienia |
|---|---|---|
| 1 | `preferred` | 16 pt / 21 pt / miara 44 mm |
| 2–4 | `widen-measure-*` | miara 46 → 48 → 50 mm, stopień pisma bez zmian |
| 5–6 | `tighten-leading-*` | interlinia 19,5 → 18 pt |
| 7–10 | `reduce-size-*` | stopień 15 → 14 pt |

Ocena: stopień pisma 40, interlinia 15, miara 10, światło 13, równość
chorągiewki 22 (z karą za osierocony krótki wiersz). Stopień pisma dominuje, więc
strategia zmniejszająca tekst nigdy nie wygra z taką, która go nie zmniejsza;
punktacja rozstrzyga tylko między wariantami tej samej wielkości. Wynik jest
deterministyczny.

Raport podaje dla każdej karty, na którym szczeblu drabiny wylądowała
(`iterations`) oraz ile wariantów w ogóle oceniono (`evaluated`).

Twarde granice: **nigdy** poniżej 14 pt, nigdy poniżej 18 pt interlinii, nigdy
więcej niż 6 wierszy. Po wyczerpaniu dziesięciu strategii karta jest zgłaszana
jako `FAIL` — tekst nie jest przycinany, ukrywany ani zmniejszany dalej.

Aktualna talia: 42 pytania w 3 wierszach, 16 w 4, 2 w 2. Wszystkie 60 pytań
składa się w 16 pt przy interlinii 21 pt — 47 na preferowanej mierze 44 mm, 13 na
poszerzonej. Zero kart osiąga limit 6 wierszy, zero schodzi poniżej stopnia
bazowego, zero ma osierocony krótki wiersz.

Pytania: 5–9 słów (mediana 7), 30–55 znaków (mediana 42).

---

## 9. QA

| Etap | Co sprawdza |
|---|---|
| content | 60/12/5/77, unikalne i ciągłe ID, poziomy, placeholdery, duplikaty dokładne (FAIL) i bliskie (WARNING) |
| fonts | każdy zadeklarowany krój rozstrzygnięty do pliku; EXACT / SUBSTITUTED / MISSING |
| svg | wymiary, viewBox, poprawność, brak zasobów zewnętrznych i skryptów, brak nakładki debug |
| safe area | każdy element niedekoracyjny wewnątrz 60 × 90 mm, z tolerancją 0,3 mm w stronę odrzucenia |
| overflow | przepełnienie X i Y, liczba wierszy, stopień pisma vs podłoga |
| png | istnienie, rozmiar > 0, poprawny obraz, dokładnie 898 × 1252 px |
| pixel | dekoduje PNG i mierzy, **gdzie farba faktycznie wylądowała** |
| contact sheet | 77 miniatur, unikalne ID, poprawna kolejność, rozmiar pliku |

Pixel QA klasyfikuje piksel jako farbę po odległości od zadeklarowanego tła
karty, więc pełnospadowe tło nie jest mylone z treścią. To niezależna kontrola
przewidywań silnika, nie ich powtórzenie.

Gdy renderer jest niedostępny, raport mówi `BLOCKED`, a build kończy się kodem
niezerowym. Nigdy `PASS`.

### Poziomy

`FAIL`: overflow, brakująca karta, zduplikowane ID, brakujący font, niepoprawny
SVG, naruszenie safe area, placeholder, dokładny duplikat pytania.
`WARNING`: pytanie > 20 słów, bliski duplikat, podstawiony font, stopień pisma
lub interlinia na minimum, 6 wierszy, blok nietypowo gęsty lub pusty.

---

## 10. Polecenia

```bash
npm run audit           # środowisko, renderer, fonty, tokeny, treść
npm run validate        # walidacja bez generowania
npm run generate        # tylko SVG
npm run generate -- Q37 # jedna karta, tym samym generatorem co pełny build
npm run render          # SVG + PNG
npm run qa              # pełny pipeline + raporty
npm run proof           # pełny pipeline + arkusze proof
npm run contact-sheet   # pełny pipeline + arkusz 77 kart
npm run inspect -- Q37  # pomiary, auto-fit, ostrzeżenia dla jednej karty
npm run inspect -- Q37 --debug   # + nakładka debug do output/qa/debug/
npm test                # 115 testów
npm run build           # PEŁNY PIPELINE — oficjalna droga
npm run build -- --skip-render   # bez rasteryzacji; PNG raportowane jako BLOCKED

node scripts/calibrate.ts         # zgodność pomiaru z rendererem
node scripts/update-baseline.ts   # aktualizacja baseline regresji
```

`npm run inspect -- Q37 --debug` zapisuje SVG i PNG z nakładką: trim, safe area,
prostokąty otaczające i linie bazowe. Nakładka istnieje **wyłącznie** w
`output/qa/debug/`; test pilnuje, żeby nie trafiła do produkcji.

---

## 11. Output

```
output/
├── front/                    77 SVG, 76 × 106 mm (PRINT / BLEED)
├── back/back.svg             1 rewers
├── png/front/ · png/back/    78 PNG, 898 × 1252 px
├── print/
│   ├── master-70x100/        CARD / MASTER, ten sam layout przycięty do trimu
│   └── print-spec.json       geometria, raster, nota CMYK i wykrojnika
├── proof/
│   ├── index.html            golden cards + przypadki skrajne + metryki
│   ├── level-*.png           arkusze po poziomach
│   ├── situations.png · bridges.png · back.png
│   └── extremes/extremes.png
├── contact-sheet/all-77-cards.png    7 × 11
├── qa/
│   ├── report.json · report.html
│   ├── overflow-report.json · overflow-report.html
│   ├── content-stats.json · design-stats.json
│   ├── content-revisions.json
│   └── debug/                (ignorowane przez git)
└── manifest.json
```

`output/qa/content-revisions.json` jest dziennikiem **automatycznych** zmian
treści przez pipeline. Generator nigdy nie przepisuje treści po cichu, więc
dziennik jest pusty. Redakcyjne zmiany tekstu są zmianami w
`src/data/*.json` i widać je w historii gita.

---

## 12. Determinizm i regresja

Bez losowości, bez znaczników czasu w artefaktach, liczby formatowane ze stałą
precyzją. Ten sam wejściowy JSON daje bajtowo identyczny SVG i identyczny PNG.

`test/snapshots/baseline.json` przypina hasze wszystkich 78 SVG oraz hasze
plików fontów. Zmiana tokenu, treści albo fontu pojawia się jako jawny diff w
teście regresji. Zamierzoną zmianę zatwierdza się świadomie:

```bash
node scripts/update-baseline.ts   # wypisze, które karty się zmieniły
```

Arkusz kontaktowy jest najszybszym detektorem regresji na poziomie talii: jedna
zmiana tokenu widoczna od razu na 77 kartach.

---

## 13. Checklista art direction

| | |
|---|---|
| Czy wygląda premium? | Tak — proporcje, typografia, materiałowość koloru, przestrzeń |
| Czy wygląda jak produkt dla dorosłych? | Tak — brak dekoracji, dojrzała paleta |
| Romantycznie bez serduszek? | Tak — zero serc, kwiatów, gradientów, ilustracji par |
| Czy poziom rozpoznaje się po kolorze? | Tak — pięć kolorów o monotonicznie malejącej luminancji |
| Czy pytanie jest pierwszą rzeczą, którą widać? | Tak — 16 pt, największy typ na karcie; test to wymusza |
| Czy jest dość pustej przestrzeni? | Tak — najszerszy wiersz zajmuje 66–86 % kolumny treści, mediana 78 % |
| Czy SITUATION różni się od QUESTION? | Tak — ciemne tło, szampańskie akcenty, krój display, odwrócona stopka |
| Czy MOST jest charakterystyczny? | Tak — jedna parametryczna funkcja, ta sama forma w każdej skali |
| Czy rewers nie zdradza poziomu? | Tak — funkcja bez argumentów; test szuka nazw poziomów i numerów |
| Czy całość jest spójna? | Tak — arkusz kontaktowy 77 kart plus testy niezmienników |

Zakazane elementy — serca, różowe gradienty, kwiaty, ilustracje par, emoji, 3D,
cienie, gradienty, ozdobne ramki — są egzekwowane testem, który skanuje każdy
wygenerowany SVG.

---

## 14. Znane ograniczenia

1. **Fonty są podstawione.** Output nie jest gotowy do druku w zadeklarowanej
   formie, dopóki nie wróci Cormorant Garamond i Manrope. §3 opisuje, jak.
2. **Brak sprawdzania typów w tym środowisku.** Nie ma pakietu `typescript`.
   Kod jest napisany pod `tsc --noEmit`, ale tu nie da się tego uruchomić.
3. **Brak separacji CMYK.** Świadomie — należy do prepressu drukarni.
4. **Rasteryzacja zależy od Chromium.** `headless_shell` jest preferowany, bo
   jego viewport równa się `--window-size`; pełny Chromium w trybie headless
   rezerwuje ~87 px na obramowanie okna i po cichu zmniejsza render.
5. **Pixel QA używa progu odległości koloru.** Antyaliasing tolerowany jest do
   3 px na krawędzi; próg i tolerancja są jawne w `src/qa/pixel.ts`.
