# Most Bliskości

Interaktywna wersja gry dla par „Most Bliskości” — jeden samodzielny plik `index.html`,
bez zależności i bez kroku budowania. Wystarczy otworzyć go w przeglądarce.

**Na żywo:** `/most-bliskosci/` (GitHub Pages)

## Co jest w środku

- **150 kart rozmowy** w czterech kategoriach: Poznaj (25), Zbliż się (25), Odkryj (50), Odwaga (50).
  To finalna, autorska talia — regulacja konfliktu i wzorce z wcześniejszych relacji są wplecione
  w Odkryj i Odwagę, a nie wydzielone osobno.
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

**Bezpieczniki przy wysokiej podatności.** Poziom Odwaga ma cztery zabezpieczenia:

1. *Bramka zgody* przed pierwszą kartą — para umawia się, że wolno powiedzieć pas, że to co padnie
   nie wraca w kłótni i że „stop” kończy rozmowę bez negocjacji.
2. *Karta TERAZ* po każdej karcie Odwagi — obowiązkowy rytuał regulujący (12 kart: od cichego
   oddychania razem po przytulenie), zanim para dołoży element Mostu. Odsłonięcie się bez powrotu
   do kontaktu zostawia gorszy ślad niż milczenie, więc ten krok nie jest opcjonalny — jest wymienny
   (przycisk *Inna karta*) i przerywalny w każdej chwili (*Wystarczy*).
3. *Limit dwóch kart Odwagi z rzędu* — potem kategoria jest chwilowo zablokowana, a gra proponuje
   Odkryj albo Zbliż się.
4. *Karta TERAZ na żądanie* — przycisk w nagłówku działa przez całą grę, nie tylko po Odwadze.

Do tego przycisk **Kończymy na dziś** dostępny w każdej chwili: zamyka wieczór tym samym pytaniem
co finał („co zabieramy ze sobą?”), zapisuje most w miejscu, w którym stanął, i pozwala wrócić.

## Talia TERAZ

Dwanaście krótkich rytuałów regulujących, podzielonych na cztery grupy narastającej bliskości
fizycznej: **bez dotyku** (oddech, spojrzenie, jedno zdanie, siedzenie obok), **lekki dotyk**
(trzymanie za rękę, oparcie głowy, masaż dłoni, czoła), **pełny kontakt** (uścisk, oparcie plecami)
i **rozładowanie** (potrząśnięcie ciałem, przyniesienie wody). Rozkład jest celowy — dla par,
u których dotyk po odsłonięciu podatności bywa deregulujący, a nie kojący, karty bez dotyku
i rozładowujące dają odpowiedź inną niż zbliżenie.

Karty akcji **Bez słów** i **Powiedz mi coś dobrego** zostały w talii akcji — to ruchy w grze,
zmieniające sposób odpowiedzi. **Bliskość** przeniosła się do TERAZ, bo pełniła inną funkcję:
nie urozmaicała odpowiedzi, tylko regulowała stan po niej.

**Regulacja konfliktu wewnątrz Odkryj.** Kilkanaście kart tej kategorii dotyczy wprost tego, co dzieje
się w kłótni i po niej: po czym poznajesz, że rozmowa idzie w złą stronę, co dzieje się w Tobie tuż
przed zamknięciem się, jaki sygnał moglibyśmy umówić na „potrzebuję przerwy, ale nie odchodzę”,
co sprawia, że po konflikcie jesteś gotowy/a znowu mnie usłyszeć.

**Wzorce z przeszłości** wracają w obu głębszych kategoriach — wzorzec komunikacji z domu rodzinnego
i decyzje, które czegoś nauczyły (Odkryj), oraz lęk przed powtórzeniem schematu i rana, która wciąż
się odzywa (Odwaga).

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
