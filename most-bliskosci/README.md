# Most Bliskości

Interaktywna wersja gry dla par „Most Bliskości” — jeden samodzielny plik `index.html`,
bez zależności i bez kroku budowania. Wystarczy otworzyć go w przeglądarce.

**Na żywo:** `/most-bliskosci/` (GitHub Pages)

## Co jest w środku

- **187 kart rozmowy** w pięciu kategoriach: Poznaj (25), Zbliż się (25), Naprawa (25),
  Odkryj (56), Odwaga (56). Podstawą jest talia BLIŻEJ: poziom 1 rozdzielony na Poznaj i Zbliż się,
  poziom 2 to Odkryj, poziom 3 to Odwaga. Naprawa i karty o wzorcach z wcześniejszych relacji
  to warstwa dopisana do tamtego szkieletu.
- **18 Kart Sytuacji** — scenki z codziennego życia z mechaniką Lustro → Twoja reakcja → Klucz empatii.
- **12 Kart Akcji**, **6 Złotych Kart Mostu** (z minutowym odliczaniem), **10 Kart Przywileju**.
- **Żetony Odwagi** — po 3 na osobę: wejdź głębiej, czy mnie znasz, wybierz za mnie, jeszcze raz.
- **Most z 10 elementów** rysowany w SVG, zapalający się wraz z postępem gry.
- **Walka o przywilej** — zakryta nagroda i pojedynek „Czy mnie znasz?”.
- **Cztery tryby**: Pierwsze spotkanie, Nasz wieczór, Bez filtra, Jedna karta dziennie (30 dni).
- Zasada PASS dostępna na każdej karcie, bez tłumaczenia i bez kary.

## Architektura rozmowy

Talia to nie wszystko — o tym, jak rozmowa przebiega, decyduje kilka reguł wbudowanych w turę.

**Przewidywanie jest filarem, nie ozdobą.** Mechanika „Czy mnie znasz?” odpala się z częstotliwością
zależną od trybu (20% w Pierwszym spotkaniu, 30% w Naszym wieczorze, 42% Bez filtra), a nie tylko
z żetonu. Trafienia są liczone osobno dla każdej osoby i pokazane w finale — nie jako wynik,
tylko jako obraz tego, jak dobrze każde z Was czyta drugie. Do tego 18 kart sytuacji, w których
najpierw przewiduje się reakcję partnera, a dopiero potem sprawdza prawdziwą.

**Bezpieczniki przy wysokiej podatności.** Poziom Odwaga ma trzy zabezpieczenia:

1. *Bramka zgody* przed pierwszą kartą — para umawia się, że wolno powiedzieć pas, że to co padnie
   nie wraca w kłótni i że „stop” kończy rozmowę bez negocjacji.
2. *Domknięcie* po każdej karcie Odwagi — trzy kroki (odbicie bez rady, nazwanie własnej potrzeby,
   jedno słowo o stanie) zanim para dołoży element Mostu. Odsłonięcie się bez odpowiedzi drugiej
   strony zostawia gorszy ślad niż milczenie, więc ten krok jest obowiązkowy, nie opcjonalny.
3. *Limit dwóch kart Odwagi z rzędu* — potem kategoria jest chwilowo zablokowana, a gra proponuje
   Naprawę albo Zbliż się.

Do tego przycisk **Kończymy na dziś** dostępny w każdej chwili: zamyka wieczór tym samym pytaniem
co finał („co zabieramy ze sobą?”), zapisuje most w miejscu, w którym stanął, i pozwala wrócić.

**Regulacja konfliktu jako osobna oś.** Kategoria Naprawa (25 kart) dotyczy eskalacji, przerwy,
przeprosin i powrotu po kłótni. Celowo nie leży na drabinie głębokości — nie jest „trudniejsza”
od Odkryj, tylko inna, więc można po nią sięgnąć również po to, żeby zejść z wysokiego napięcia.

**Wzorce z wcześniejszych relacji** mają dwanaście własnych kart, rozdzielonych między Odkryj
(czego nauczyły, co przestało obowiązywać) i Odwagę (jaki lęk jeszcze wraca, przed czym się
chronisz, choć to nie ja Cię zraniłem).

## Stan gry

Rozgrywka zapisuje się w `localStorage` przeglądarki (klucz `most-bliskosci-v1`),
więc można wrócić do przerwanej gry oraz prowadzić tryb „jedna karta dziennie” przez 30 dni.
Nic nie jest wysyłane na serwer.

## Publikacja

Strona jest przygotowana do udostępniania publicznie:

- **Podgląd linku** — `og-image.png` (1200×630) plus komplet tagów `og:` i `twitter:`,
  więc wklejenie adresu na Messengerze czy Facebooku pokazuje kartę z tytułem i mostem.
- **Ikony i instalacja** — `icon.svg`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`
  oraz `manifest.webmanifest`. Na telefonie „dodaj do ekranu głównego" daje pełnoekranową aplikację.
- **Prywatność** — gra nie zbiera żadnych danych i nie ma analityki; postęp żyje wyłącznie
  w `localStorage` przeglądarki, więc nie jest potrzebna zgoda na cookies.
- **Dostępność** — wszystkie kolory tekstu mają kontrast powyżej 3:1 wobec swojego tła.
- **Nota o charakterze gry** — ekran startowy i panel zasad mówią wprost, że to gra towarzyska
  dla dorosłych, a nie terapia ani narzędzie diagnostyczne.

Adres kanoniczny ustawiony w `<link rel="canonical">` i tagach `og:` to
`https://mateusz90duolife-lab.github.io/Jestem_Obok-/most-bliskosci/`.
Jeśli gra trafi na własną domenę, trzeba podmienić go w pięciu miejscach w nagłówku `index.html`.

### Do zrobienia przed komercyjną publikacją

- **Self-hosting fontów.** Strona ciągnie Faustinę, Karlę i IBM Plex Mono z CDN Google, co przy
  odbiorcy z UE oznacza przekazanie adresu IP do Google bez zgody. Pobierz woff2 (np. z
  `gwfh.mranftl.com`), wrzuć do `most-bliskosci/fonts/`, dodaj reguły `@font-face`
  z `font-display:swap` i usuń trzy tagi `<link>` do `fonts.googleapis.com`.
- **Autor, kontakt i licencja.** Repozytorium nie ma pliku `LICENSE`, a strona nie mówi, czyja jest gra.
- **Jedna kanoniczna talia.** Aplikacja ma 150 kart w czterech kategoriach, a PDF do druku 90 kart
  w trzech sekcjach. Do rozstrzygnięcia, która wersja jest tą właściwą.
- **Generator arkuszy do druku** z tej samej listy kart, żeby wersja pudełkowa i strona
  nie rozjeżdżały się przy każdej zmianie.
