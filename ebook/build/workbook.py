# -*- coding: utf-8 -*-
"""Zeszyt ćwiczeń (A4, do druku) do e-booka 'Prokrastynacja w kobiecym zaciszu'."""
import os, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, ".."))
ASSETS = os.path.join(ROOT, "assets")
OUT = os.path.join(ROOT, "Zeszyt-cwiczen.html")

def svg(name):
    s = open(os.path.join(ASSETS, name), encoding="utf-8").read()
    return re.sub(r'\s(width|height)="[\d.]+"', "", s, count=2)

CB = '<span class="cb"></span>'

def lines(n, cls=""):
    return f'<div class="lines {cls}" style="height:{n*9}mm"></div>'

def page(tag, title, lead, body):
    return f'''<section class="pg">
  <div class="pg-tag">{tag}</div>
  <h2>{title}</h2>
  <p class="lead">{lead}</p>
  {body}
</section>'''

pages = []

# ── Okładka ────────────────────────────────────────────────
pages.append(f'''<section class="pg cover">
  <div class="cv-kicker">ZESZYT ĆWICZEŃ</div>
  <h1>Prokrastynacja<br><em>w kobiecym zaciszu</em></h1>
  <div class="cv-rule"></div>
  <p class="cv-sub">Wszystkie ćwiczenia z e-booka, z miejscem na Twoje odpowiedzi</p>
  <div class="cv-orn">{svg("ornament.svg")}</div>
  <div class="cv-note">
    <strong>Nie drukuj wszystkiego.</strong> Wydrukuj jedną stronę — tę, której potrzebujesz dziś.
    Każda strona działa samodzielnie i odsyła do rozdziału, w którym znajdziesz wyjaśnienie.
  </div>
  <p class="cv-author">[IMIĘ I NAZWISKO AUTORKI]</p>
</section>''')

# ── Spis ───────────────────────────────────────────────────
toc = [("Autotest: pięć wzorców odkładania", "R2.5"), ("Moje trzy odkładane zadania", "R1–2"),
       ("Eksperyment trzech dni", "R3"), ("Plan mikro-startu", "R4"), ("Trzy kroki defuzji", "R5"),
       ("Zdejmij to z głowy", "R6"), ("Mapa odpowiedzialności w domu", "R6.5"),
       ("Tracker 14 dni", "R7"), ("Moje miejsce i moje bariery", "R8"),
       ("Karta: Protokół Awaryjny", "R9"), ("Przygotowanie do wizyty u lekarza", "R10")]
rows = "".join(f'<tr><td class="n">{i+3}</td><td>{t}</td><td class="r">{r}</td></tr>' for i,(t,r) in enumerate(toc))
pages.append(page("JAK KORZYSTAĆ", "Twój zeszyt",
  "Ten zeszyt nie jest testem ani zadaniem domowym. To miejsce, w którym myśli z głowy lądują na papierze — bo tam przestają krążyć.",
  f'''<table class="toc"><thead><tr><th>Str.</th><th>Ćwiczenie</th><th>Rozdział</th></tr></thead><tbody>{rows}</tbody></table>
  <div class="note"><strong>Zasada jednej strony.</strong> Jeśli masz gorszy dzień, wybierz najkrótsze ćwiczenie albo żadne.
  Plan 14 dni przewiduje wracanie do wersji dwuminutowej — przerwa nie oznacza porażki.</div>'''))

# ── Autotest ───────────────────────────────────────────────
sections = [
 ("A", "Perfekcyjna Pani Domu", ["Odkładam rozpoczęcie projektu, dopóki nie będę mieć czasu zrobić go perfekcyjnie.",
   "Poprawiam po domownikach, bo „zrobią to źle”.", "Trudno mi odpocząć, gdy w zlewie leżą naczynia.",
   "Wolę w ogóle nie ćwiczyć, niż zrobić „niepełny”, krótki trening."]),
 ("B", "Męczennica Mental Load", ["Czuję wyczerpanie na samą myśl o tym, co dziś na obiad.",
   "Moja głowa to lista zadań, o których nikt inny w domu nie pamięta.",
   "Odkładam sprawy urzędowe, bo „tylko ja muszę myśleć o wszystkim”.", "Płaczę lub wybucham złością z powodu drobnostki."]),
 ("C", "Uciekinierka w Troskę", ["Ignoruję własne sprawy, rzucając się do pomocy innym.",
   "Mój kalendarz jest pełen spraw innych ludzi, a na moje cele brakuje w nim miejsca.",
   "Czuję poczucie winy, gdy odmawiam, żeby zająć się sobą.", "Sprzątam szczególnie dokładnie wtedy, gdy mam ważną pracę."]),
 ("D", "Znieczulaczka Wieczorna", ["Celowo przedłużam wieczór przed ekranem, choć rano będę wykończona.",
   "Wieczór to jedyny moment, kiedy nikt niczego ode mnie nie chce.",
   "Mój dzień należał do innych, więc „odbieram” sobie czas kosztem snu.", "Odbija się to na mojej energii następnego dnia."]),
 ("E", "Zagubiona w Chaosie", ["Zaczynam kilka czynności naraz i nie kończę żadnej.",
   "Gubię dokumenty i klucze, zapominam o terminach mimo dobrych chęci.",
   "Czuję silny opór przed otwieraniem poczty lub logowaniem do banku.", "Organizacja przestrzeni wydaje mi się zadaniem ponad siły."]),
]
grid = ""
for letter, name, qs in sections:
    q = "".join(f'<tr><td class="q">{x}</td>' + "".join(f'<td class="sc">{v}</td>' for v in "0123") + '</tr>' for x in qs)
    grid += f'''<table class="quiz"><thead><tr><th class="qh"><span class="lt">{letter}</span> {name}</th>
      <th>0</th><th>1</th><th>2</th><th>3</th></tr></thead><tbody>{q}
      <tr class="sum"><td class="q">Suma sekcji {letter}</td><td colspan="4" class="box"></td></tr></tbody></table>'''
pages.append(page("ROZDZIAŁ 2.5 · AUTOTEST", "Pięć wzorców odkładania",
  "Zakreśl jedną liczbę przy każdym zdaniu: 0 — nigdy, 1 — czasami, 2 — często, 3 — bardzo często.",
  grid + '''<div class="warn"><strong>To nie jest test diagnostyczny.</strong> Autotest nie był walidowany, a progi są umowne.
  Sekcja z najwyższym wynikiem pokazuje tylko, od którego rozdziału warto zacząć. Wysoki wynik w sekcji E nie oznacza ADHD.</div>'''))

# ── R1–2: trzy odkładane zadania ───────────────────────────
mech = "".join(f'<div class="mk">{CB} {t}</div>' for t in ["A · lęk lub presja oceny", "B · robię to wieczorem, po wyczerpującym dniu",
                                                          "C · zawsze jest coś prostszego", "D · obwinianie siebie zwiększa odkładanie"])
blk = ""
for i in range(1, 4):
    blk += f'''<div class="card"><div class="card-h">Zadanie {i}</div>{lines(1)}
      <div class="lbl">Emocja lub wymówka, która mnie blokuje</div>{lines(2)}
      <div class="lbl">Który mechanizm pasuje najlepiej?</div><div class="mk-grid">{mech}</div></div>'''
pages.append(page("ROZDZIAŁ 1 i 2", "Moje trzy odkładane zadania",
  "Zapisz zadania, które odkładasz od dawna. Przy każdym nazwij szczerze, co Cię zatrzymuje — bez oceniania.",
  blk + '<p class="say">Powiedz na głos: <em>To nie jest kwestia charakteru. To reakcja na obciążenie i dyskomfort.</em></p>'))

# ── R3: eksperyment trzech dni ─────────────────────────────
r = "".join(f'''<tr><td class="day">Dzień {d}</td><td class="tall"></td><td class="yn">{CB} tak<br>{CB} nie</td><td class="tall"></td></tr>''' for d in (1,2,3))
pages.append(page("ROZDZIAŁ 3", "Eksperyment trzech dni",
  "Rano, zanim sięgniesz po telefon, zapisz jedną rzecz dla siebie — nie dla domu, nie dla rodziny. Wieczorem sprawdź, czy się wydarzyła.",
  f'''<table class="grid3"><thead><tr><th></th><th>Rano: jedna rzecz dla siebie</th><th>Udało się?</th>
  <th>O której skończyłam decydować za innych?</th></tr></thead><tbody>{r}</tbody></table>
  <div class="lbl big">Co zauważam po trzech dniach?</div>{lines(5)}
  <div class="note">Godzina z ostatniej kolumny to Twoja praktyczna granica. Planuj swoje sprawy przed nią, nie po.</div>'''))

# ── R4: mikro-start ────────────────────────────────────────
ms = ""
for i in range(1, 4):
    ms += f'''<div class="card plan"><div class="card-h">Plan {i}</div>
      <div class="fill">Jutro o <span class="blank s"></span>, zaraz po <span class="blank m"></span>,</div>
      <div class="fill">zrobię <span class="blank l"></span></div>
      <div class="fill small">Limit: <strong>2 minuty.</strong> Potem wolno mi przerwać. {CB} zrobione</div></div>'''
pages.append(page("ROZDZIAŁ 4", "Plan mikro-startu",
  "Najmniejszy możliwy pierwszy ruch plus konkretny moment, w którym go zrobisz. To połączenie ma najmocniejsze wsparcie w badaniach.",
  ms + '''<div class="ex"><div class="lbl">Przykłady mikro-startów</div>
  <ul><li>Otwórz stronę przychodni i zatrzymaj się. Nie rejestrujesz się.</li>
  <li>Otwórz trudnego maila i przeczytaj go jeszcze raz. Nie odpisujesz.</li>
  <li>Otwórz pusty dokument i wpisz tytuł.</li><li>Rozłóż matę i zrób jeden skłon.</li></ul></div>'''))

# ── R5: defuzja ────────────────────────────────────────────
df = ""
for i in range(1, 3):
    df += f'''<div class="card"><div class="card-h">Sytuacja {i}</div>
      <div class="lbl">1 · Nazwij myśl: „Zauważam, że mam myśl, że…”</div>{lines(2)}
      <div class="two"><div><div class="lbl">2 · Fakt</div>{lines(2)}</div><div><div class="lbl">Interpretacja</div>{lines(2)}</div></div>
      <div class="lbl">3 · Co się naprawdę stało?</div>{lines(2)}</div>'''
pages.append(page("ROZDZIAŁ 5", "Trzy kroki defuzji",
  "Gdy wewnętrzny krytyk włącza się na pełne obroty, oddziel to, co się wydarzyło, od tego, co Twój umysł z tego zrobił.",
  df + '<p class="say">Przykład: <em>Fakt — nie wykonałam dziś zadania. Interpretacja — jestem beznadziejna. Co się stało — byłam wyczerpana i wybrałam ulgę. To mechanizm, nie wyrok.</em></p>'))

# ── R6: zdejmij z głowy ────────────────────────────────────
r6 = "".join(f'<tr><td class="tall"></td><td class="opt">{CB} automatyzuję<br>{CB} oddaję<br>{CB} skreślam</td><td class="tall"></td><td></td></tr>' for _ in range(5))
pages.append(page("ROZDZIAŁ 6", "Zdejmij to z głowy",
  "Każda decyzja, którą podejmiesz raz i zamienisz w regułę, znika z codziennej listy. Zacznij od jednego zadania w ciągu 48 godzin.",
  f'''<table class="grid3"><thead><tr><th>Powtarzalne zadanie</th><th>Co robię</th><th>Jak konkretnie</th><th>Do kiedy</th></tr></thead>
  <tbody>{r6}</tbody></table>
  <div class="note">Podpowiedzi: stałe zlecenia na rachunki, stałe menu na dwa tygodnie, zakupy z dostawą,
  wspólny kalendarz z przypisaną osobą, sprzątanie raz w miesiącu przez firmę.</div>'''))

# ── R6.5: mapa odpowiedzialności ───────────────────────────
areas = ["Obiady (które dni?)", "Zakupy spożywcze", "Wizyty lekarskie dzieci", "Rachunki i opłaty", "Pranie",
         "Szkoła / przedszkole", "Urodziny i prezenty", "Naprawy i usterki", ""]
r65 = "".join(f'<tr><td class="area">{a}</td><td></td><td class="wide"></td><td class="yn">{CB}</td></tr>' for a in areas)
pages.append(page("ROZDZIAŁ 6.5", "Mapa odpowiedzialności w domu",
  "Nie dzielcie zadań. Dzielcie całe obszary — od zauważenia, że trzeba, po sprawdzenie, że się wydarzyło.",
  f'''<table class="grid3 map"><thead><tr><th>Obszar</th><th>Kto odpowiada od A do Z</th><th>Co obejmuje „od A do Z”</th><th>Plan awaryjny?</th></tr></thead>
  <tbody>{r65}</tbody></table>
  <div class="two"><div><div class="lbl">Data pierwszego check-inu</div>{lines(1)}</div><div><div class="lbl">Kolejny check-in (za 2 tygodnie)</div>{lines(1)}</div></div>
  <div class="lbl big">Moje słowa na początek rozmowy</div>{lines(3)}
  <div class="note">„Plan awaryjny” zaznacz przy sprawach, w których potknięcie byłoby groźne — np. zdrowie dziecka.
  Tam ustalcie z góry, kto i kiedy sprawdza.</div>'''))

# ── R7: tracker 14 dni ─────────────────────────────────────
tr = ""
for d in range(1, 15):
    ph, goal = ("p1", "2 min") if d <= 3 else (("p2", "10–15 min") if d <= 7 else ("p3", "25 min"))
    tr += f'<tr class="{ph}"><td class="day">{d}</td><td class="goal">{goal}</td><td class="cbx">{CB}</td><td></td><td class="wide"></td></tr>'
pages.append(page("ROZDZIAŁ 7", "Tracker 14 dni",
  'Moje zadanie dla siebie: <span class="blank l"></span>',
  f'''<table class="grid3 track"><thead><tr><th>Dzień</th><th>Cel</th><th>Zrobione</th><th>Ile minut</th><th>Krótka notatka</th></tr></thead>
  <tbody>{tr}</tbody></table>
  <div class="legend"><span class="sw p1"></span> przełamywanie oporu <span class="sw p2"></span> stabilizacja <span class="sw p3"></span> nowa normalność</div>
  <div class="note">Trudny dzień? Wróć do wersji dwuminutowej i postaw znaczek. Nie zaczynasz od zera.</div>'''))

# ── R8: miejsce i bariery ──────────────────────────────────
pages.append(page("ROZDZIAŁ 8", "Moje miejsce i moje bariery",
  "Łatwiej nie ulegać pokusie, której nie masz w zasięgu ręki, niż z nią walczyć.",
  f'''<div class="card"><div class="card-h">Moje miejsce</div>
    <div class="lbl">Gdzie jest (choćby jedno krzesło)?</div>{lines(1)}
    <div class="lbl">Co na nim stawiam, żeby było moje?</div>{lines(1)}
    <div class="lbl">Umowa z domownikami: kiedy tam siedzę…</div>{lines(2)}</div>
  <div class="card"><div class="card-h">Bariera cyfrowa</div>
    <div class="lbl">Trzy profile, po których czuję się gorzej — odcinam na 2 tygodnie</div>
    <div class="fill">1. <span class="blank l"></span></div><div class="fill">2. <span class="blank l"></span></div><div class="fill">3. <span class="blank l"></span></div>
    <div class="lbl">Po dwóch tygodniach zauważam:</div>{lines(2)}</div>
  <div class="card"><div class="card-h">Bariera wieczorna</div>
    <div class="lbl">Od dziś ładuję telefon w:</div>{lines(1)}
    <div class="lbl">Na szafce nocnej zamiast telefonu kładę:</div>{lines(1)}</div>'''))

# ── R9: karta awaryjna ─────────────────────────────────────
card = '''<div class="emerg"><div class="em-h">PROTOKÓŁ AWARYJNY</div><ol>
  <li><strong>Zatrzymaj efekt „pal licho”.</strong> Dziś był ciężki dzień. Jutro zaczynam od nowa.</li>
  <li><strong>Kwarantanna winy.</strong> Odpuść, zamów jedzenie, weź prysznic, idź spać.</li>
  <li><strong>Rano: jedno zadanie.</strong> Co absolutnie musi się dziś wydarzyć? Nie lista.</li>
  <li><strong>Kiedy opadnie kurz:</strong> co mnie tak przeciążyło? Bez wyroku, z ciekawością.</li></ol>
  <div class="em-f">Jeśli takie dni zdarzają się coraz częściej — porozmawiaj ze specjalistą. Rozdział 10.</div></div>'''
pages.append(page("ROZDZIAŁ 9", "Karta: Protokół Awaryjny",
  "Wytnij i powieś tam, gdzie zobaczysz ją w najgorszy wieczór: na lodówce, w łazience, w portfelu.",
  card + '<div class="cut">✂ · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·</div>' + card))

# ── R10: wizyta ────────────────────────────────────────────
pages.append(page("ROZDZIAŁ 10", "Przygotowanie do wizyty u lekarza",
  "Weź tę kartkę ze sobą. Najważniejsza informacja dla lekarza to wpływ objawów na Twoje codzienne funkcjonowanie.",
  f'''<div class="two"><div><div class="lbl">Co się dzieje (objawy)</div>{lines(3)}</div><div><div class="lbl">Od kiedy · jak często</div>{lines(3)}</div></div>
  <div class="two"><div><div class="lbl">Co nasila, co łagodzi</div>{lines(2)}</div><div><div class="lbl">Objawy fizyczne (nawet „niezwiązane”)</div>{lines(2)}</div></div>
  <div class="lbl">Jak to wpływa na moje życie — konkretnie</div>{lines(3)}
  <div class="lbl">Moje pytania</div>
  <div class="fill">{CB} Czy warto sprawdzić, czy za tym stoi przyczyna medyczna?</div>
  <div class="fill">{CB} Jeśli teraz nie robimy badań — po czym poznam, że powinnam wrócić?</div>
  <div class="fill">{CB} <span class="blank l"></span></div>
  <div class="help"><div class="help-h">Gdy jest naprawdę źle — dzwoń</div>
    <div class="help-g"><div><b>112</b> zagrożenie życia</div><div><b>800 70 2222</b> Centrum Wsparcia, całodobowo</div>
    <div><b>116 123</b> Kryzysowy Telefon Zaufania</div><div><b>116 111</b> dla dzieci i młodzieży</div></div></div>'''))

CSS = open(os.path.join(HERE, "workbook.css"), encoding="utf-8").read()
html = f'''<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8">
<title>Zeszyt ćwiczeń — Prokrastynacja w kobiecym zaciszu</title><style>{CSS}</style></head>
<body>{"".join(pages)}</body></html>'''
open(OUT, "w", encoding="utf-8").write(html)
print("napisano", os.path.basename(OUT), f"({len(pages)} stron)")
