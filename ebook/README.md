# Prokrastynacja w Kobiecym Zaciszu — pliki e-booka

## Gotowe pliki

| Plik | Do czego |
|---|---|
| `Prokrastynacja-w-Kobiecym-Zaciszu.pdf` | **Gotowy e-book**, A5, 95 stron, numeracja stron, grafiki wektorowe |
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
```

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

1. Uzupełnić `[IMIĘ I NAZWISKO AUTORKI]` — w `.md`, w `assets/okladka.svg`
   i w `build/build.py` (strona tytułowa), potem przebudować.
2. Uzupełnić dane kontaktowe i link do trackera w rozdziale „Zakończenie”.
3. Zweryfikować numery kryzysowe i realia NFZ na dzień publikacji.
4. Dać rozdział 10 do przeczytania lekarzowi lub psychologowi klinicznemu.
