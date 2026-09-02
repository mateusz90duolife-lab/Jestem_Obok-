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

## Bezpieczeństwo i przeciwwskazania

Gra jawnie mówi, dla kogo nie jest przeznaczona: dla par, w których jedna osoba boi się reakcji
drugiej, albo w związku występuje przemoc, groźby lub kontrola. Ten komunikat jest na ekranie
startowym (osobny blok, wizualnie odróżniony od ogólnej noty o charakterze gry) i w panelu zasad —
nie jest to techniczny disclaimer, tylko realne ostrzeżenie kliniczne: szczera odpowiedź wymaga
poczucia bezpieczeństwa, a bez niego mechanika gry (przewidywanie odpowiedzi partnera, odsłanianie
lęków w Odwadze) może zostać użyta jako narzędzie kontroli zamiast bliskości.

Numery wsparcia — Niebieska Linia 800 120 002 (przemoc domowa, całodobowo) i 116 123 (Telefon
Zaufania dla Dorosłych w Kryzysie Emocjonalnym) — są klikalne (`tel:`) w trzech miejscach: nocie
ostrzegawczej, panelu zasad i stopce widocznej na każdym ekranie gry.

Karta akcji **Kradzież** (partner przejmuje cudzą kartę i odpowiada pierwszy) jest wykluczona
z losowania przy kartach kategorii Odwaga — wymuszałaby odpowiedź na cudzych warunkach dokładnie
tam, gdzie gra wcześniej ustawiła bramkę zgody. Pozostaje dostępna w pozostałych kategoriach.

Każda przyznana Karta Przywileju (z trafienia w „Czy mnie znasz?" i z Walki o Przywilej) pokazuje
się teraz z przyciskiem **„Nie pasuje — dobierzcie inną"** obok „Zatrzymajcie". To domyka regułę,
którą panel zasad już obiecywał („jeśli karta nie pasuje, odrzućcie i dobierzcie inną"), a wcześniej
nie była nigdzie zaimplementowana przy samym momencie przyznania nagrody.

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

### Fonty

Faustina, Karla i IBM Plex Mono są self-hostowane w `most-bliskosci/fonts/` (pliki TTF pobrane
z oficjalnego repozytorium `google/fonts`, licencja OFL dołączona jako `OFL-*.txt` przy każdym
kroju). Strona nie ładuje niczego z `fonts.googleapis.com` ani `fonts.gstatic.com` — zero żądań
sieciowych do Google, zero przekazywania adresu IP odwiedzającego stronę trzecią.

## Jak powstała ta gra

Treść kart i kod zostały stworzone przy współpracy z sztuczną inteligencją. Informacja o tym
jest widoczna na stronie w dwóch miejscach: w stopce (na każdym ekranie) i w panelu zasad,
w sekcji „Jak powstała ta gra” — razem z zastrzeżeniem, że to nie jest narzędzie zaprojektowane
ani zweryfikowane przez licencjonowanego terapeutę.

## Do zrobienia przed komercyjną publikacją

- **Autor, kontakt i licencja.** Repozytorium nie ma pliku `LICENSE`, a strona nie mówi, czyja jest gra.
- **Jedna kanoniczna talia.** Aplikacja ma 150 kart w czterech kategoriach, a PDF do druku 90 kart
  w trzech sekcjach. Do rozstrzygnięcia, która wersja jest tą właściwą.
- **Generator arkuszy do druku** z tej samej listy kart, żeby wersja pudełkowa i strona
  nie rozjeżdżały się przy każdej zmianie.
- **Regulamin i polityka prywatności** jako osobne dokumenty, nie tylko zdanie w stopce —
  wymagane przy sprzedaży, nawet jeśli gra nie zbiera danych.
- **Sprawdzenie nazwy „Most Bliskości”** pod kątem wolności znaku towarowego przed sprzedażą pod tą nazwą.
- **Walidacja z realną parą** przed publicznym uruchomieniem płatnym — żadna redakcja treści
  nie zastąpi sprawdzenia, czy pytania i tempo faktycznie działają w żywej rozmowie.
