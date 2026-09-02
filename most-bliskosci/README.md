# Most Bliskości

Interaktywna wersja gry dla par „Most Bliskości” — jeden samodzielny plik `index.html`,
bez zależności i bez kroku budowania. Wystarczy otworzyć go w przeglądarce.

**Na żywo:** `/most-bliskosci/` (GitHub Pages)

## Co jest w środku

- **150 kart rozmowy** w czterech kategoriach: Poznaj (25), Zbliż się (25), Odkryj (50), Odwaga (50).
  Podział odpowiada trzem poziomom talii BLIŻEJ: poziom 1 rozdzielony na Poznaj i Zbliż się,
  poziom 2 to Odkryj, poziom 3 to Odwaga.
- **12 Kart Sytuacji** — scenki z codziennego życia z mechaniką Lustro → Twoja reakcja → Klucz empatii.
- **12 Kart Akcji**, **6 Złotych Kart Mostu** (z minutowym odliczaniem), **10 Kart Przywileju**.
- **Żetony Odwagi** — po 3 na osobę: wejdź głębiej, czy mnie znasz, wybierz za mnie, jeszcze raz.
- **Most z 10 elementów** rysowany w SVG, zapalający się wraz z postępem gry.
- **Walka o przywilej** — zakryta nagroda i pojedynek „Czy mnie znasz?”.
- **Cztery tryby**: Pierwsze spotkanie, Nasz wieczór, Bez filtra, Jedna karta dziennie (30 dni).
- Zasada PASS dostępna na każdej karcie, bez tłumaczenia i bez kary.

## Stan gry

Rozgrywka zapisuje się w `localStorage` przeglądarki (klucz `most-bliskosci-v1`),
więc można wrócić do przerwanej gry oraz prowadzić tryb „jedna karta dziennie” przez 30 dni.
Nic nie jest wysyłane na serwer.
