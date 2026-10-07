# Prokrastynacja w Kobiecym Zaciszu — pliki e-booka

## Gotowe pliki

| Plik | Do czego |
|---|---|
| `Prokrastynacja-w-Kobiecym-Zaciszu.pdf` | **Gotowy e-book**, A5, 96 stron, numeracja stron, grafiki wektorowe |
| `Zeszyt-cwiczen.pdf` | **Zeszyt ćwiczeń** do wydruku, A4, 13 stron — sprzedawany razem z e-bookiem |
| `Darmowy-fragment.pdf` | **Darmowy fragment** (Wstęp + Rozdział 1 + zaproszenie), A5, 20 stron — do zapisu na newsletter |
| `sprzedaz/opis-produktu.md` | Gotowe teksty: opis produktu, FAQ, posty, rekomendacja ceny |
| `Prokrastynacja-w-Kobiecym-Zaciszu.html` | Wersja przeglądarkowa, jeden samodzielny plik (grafiki wbudowane) |
| `prokrastynacja-w-kobiecym-zaciszu.md` | Źródło treści — tu wprowadzasz zmiany merytoryczne |
| `RAPORT-ZMIAN.md` | Mapowanie recenzji na wdrożone poprawki |
| `assets/okladka.svg` · `assets/okladka.png` | Okładka: wektor do druku, PNG 1400 px do sklepu |
| `assets/fig-*.svg` | Osiem ilustracji z wnętrza książki |

## Jak zmienić treść i przebudować

```bash
# 1. edytujesz prokrastynacja-w-kobiecym-zaciszu.md
python3 ebook/build/figures.py    # grafiki (tylko gdy zmieniasz ilustracje)
python3 ebook/build/build.py      # Markdown -> HTML
node    ebook/build/render.js     # HTML -> PDF
python3 ebook/build/workbook.py   # zeszyt ćwiczeń -> HTML
node    ebook/build/render.js ebook/Zeszyt-cwiczen.html ebook/Zeszyt-cwiczen.pdf
python3 ebook/build/sample.py     # darmowy fragment -> HTML
node    ebook/build/render.js ebook/Darmowy-fragment.html ebook/Darmowy-fragment.pdf
```

Ścieżki do `render.js` podawaj jako bezwzględne. `ebook/build/measure.js` mierzy wysokość stron w emulacji druku (przydatne, gdy strona zeszytu się przelewa).

`ebook/build/proof.js` robi zrzut ekranu w emulacji druku, do kontroli składu:
`node ebook/build/proof.js <plik.html> <zrzut.png> <offsetY> <wysokość>`

## Decyzje składu

- **Format A5** (148 × 210 mm), marginesy 17/16/19 mm, krój Charter 10,4 pt.
- **Fonty systemowe** (Charter, DejaVu) — bez zewnętrznych webfontów, plik jest samowystarczalny.
- **Trzy poziomy treści** z manuskryptu mają własne style ramek: badania (zielony),
  praktyka (śliwkowy), ćwiczenie (złoty), uwaga (ceglasty), alarm (czerwony).
- **Rys. 2 zastępuje tabelę** „Mapa — cztery mechanizmy” z Markdown. Grafika niesie
  te same informacje plus opis objawu, więc w składzie tabela byłaby powtórzeniem.
  W pliku źródłowym `.md` tabela pozostaje.
- Każdy rozdział zaczyna się od nowej strony, z ornamentem pod tytułem.

## Przed sprzedażą

1. Uzupełnić `[IMIĘ I NAZWISKO AUTORKI]` — w `.md`, w `build/figures.py` (okładka),
   w `build/build.py` (strona tytułowa) i w `build/workbook.py`, potem przebudować.
2. Uzupełnić dane kontaktowe w „Kilka słów o mnie” i adres strony w `build/sample.py`.
3. Zweryfikować numery kryzysowe i realia NFZ na dzień publikacji.
4. Dać rozdział 10 do przeczytania lekarzowi lub psychologowi klinicznemu.
