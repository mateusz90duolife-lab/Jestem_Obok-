# -*- coding: utf-8 -*-
"""Generator grafik SVG do e-booka 'Prokrastynacja w Kobiecym Zaciszu'."""
import math, random, os

OUT = os.path.join(os.path.dirname(__file__), "..", "assets")
os.makedirs(OUT, exist_ok=True)

INK    = "#241E2B"
PLUM   = "#7A4E63"
PLUMD  = "#553546"
TERRA  = "#C36A4B"
SAND   = "#EAD9C6"
CREAM  = "#FAF6F0"
SAGE   = "#7E8F73"
GOLD   = "#D9A441"
MUTED  = "#8B8091"

SERIF = "Bitstream Charter, DejaVu Serif, Georgia, serif"
SANS  = "DejaVu Sans, Liberation Sans, Helvetica, sans-serif"


def write(name, body):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(body)
    print("napisano", name)


def smooth_path(pts):
    """Zamienia listę punktów w gładką ścieżkę (Catmull-Rom -> Bezier)."""
    if len(pts) < 2:
        return ""
    d = "M %.2f %.2f" % pts[0]
    for i in range(len(pts) - 1):
        p0 = pts[i - 1] if i > 0 else pts[i]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < len(pts) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6.0, p1[1] + (p2[1] - p0[1]) / 6.0)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6.0, p2[1] - (p3[1] - p1[1]) / 6.0)
        d += " C %.2f %.2f, %.2f %.2f, %.2f %.2f" % (c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
    return d


def tangle(cx, cy, r, turns, seed, jitter=1.0):
    """Splątany kłębek — losowy spacer po okręgu o zmiennym promieniu."""
    rnd = random.Random(seed)
    pts = []
    steps = turns * 26
    for i in range(steps):
        t = i / steps
        ang = t * turns * 2 * math.pi
        rad = r * (0.30 + 0.70 * abs(math.sin(t * math.pi * 2.6 + seed)))
        rad *= 1 + rnd.uniform(-0.28, 0.28) * jitter
        pts.append((cx + math.cos(ang) * rad, cy + math.sin(ang) * rad * 0.82))
    return pts


# ─────────────────────────────────────────────────────────────
# OKŁADKA
# ─────────────────────────────────────────────────────────────
def cover():
    W, H = 1480, 2100
    rnd = random.Random(7)

    # kłębek, który rozplątuje się w jedną nić
    KX, KY = 450, 1330
    knot = tangle(KX, KY, 235, 9, 3.1)
    thread = []
    for i in range(140):
        t = i / 139.0
        x = KX + t * 610
        y = KY + math.sin(t * math.pi * 1.6) * 135 * (1 - t) - t * 105
        y += rnd.uniform(-1, 1) * 30 * (1 - t) ** 2
        thread.append((x, y))
    # spirala na końcu
    sx, sy = thread[-1]
    spiral = []
    for i in range(90):
        t = i / 89.0
        ang = t * 3.4 * 2 * math.pi
        rad = 118 * (1 - t) + 6
        spiral.append((sx + 118 - math.cos(ang) * rad, sy + math.sin(ang) * rad))

    dots = ""
    for i in range(26):
        x = rnd.uniform(120, 1360)
        y = rnd.uniform(150, 1900)
        r = rnd.uniform(1.6, 4.2)
        dots += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.1f}" fill="{PLUM}" opacity="0.16"/>'

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<defs>
  <linearGradient id="cbg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FDFBF8"/><stop offset="0.55" stop-color="{CREAM}"/><stop offset="1" stop-color="#F2E7DA"/>
  </linearGradient>
  <linearGradient id="arc" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="{PLUM}"/><stop offset="1" stop-color="{PLUMD}"/>
  </linearGradient>
  <linearGradient id="thr" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="{PLUM}"/><stop offset="0.6" stop-color="{TERRA}"/><stop offset="1" stop-color="{GOLD}"/>
  </linearGradient>
</defs>

<rect width="{W}" height="{H}" fill="url(#cbg)"/>
{dots}

<!-- dolny łuk -->
<path d="M 0 1720 C 380 1600, 1080 1830, 1480 1660 L 1480 2100 L 0 2100 Z" fill="url(#arc)"/>
<path d="M 0 1770 C 400 1660, 1060 1880, 1480 1712" fill="none" stroke="{GOLD}" stroke-width="3" opacity="0.55"/>

<!-- ramka -->
<rect x="70" y="70" width="{W-140}" height="{H-140}" fill="none" stroke="{PLUM}" stroke-width="2" opacity="0.30"/>

<!-- motyw: kłębek -> nić -> spirala -->
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path d="{smooth_path(knot)}" stroke="{PLUM}" stroke-width="3.6" opacity="0.80"/>
  <path d="{smooth_path(tangle(KX, KY, 192, 7, 8.4))}" stroke="{TERRA}" stroke-width="2.6" opacity="0.55"/>
  <path d="{smooth_path(thread)}" stroke="url(#thr)" stroke-width="5"/>
  <path d="{smooth_path(spiral)}" stroke="{GOLD}" stroke-width="4.4"/>
</g>
<circle cx="{spiral[-1][0]:.0f}" cy="{spiral[-1][1]:.0f}" r="13" fill="{TERRA}"/>

<!-- typografia -->
<text x="740" y="290" text-anchor="middle" font-family="{SANS}" font-size="34"
      letter-spacing="14" fill="{TERRA}">PORADNIK PRAKTYCZNY</text>
<line x1="560" y1="336" x2="920" y2="336" stroke="{TERRA}" stroke-width="2" opacity="0.6"/>

<text x="740" y="500" text-anchor="middle" font-family="{SERIF}" font-size="118"
      letter-spacing="6" fill="{INK}">PROKRASTYNACJA</text>
<text x="740" y="640" text-anchor="middle" font-family="{SERIF}" font-size="96"
      font-style="italic" fill="{PLUM}">w kobiecym zaciszu</text>

<line x1="640" y1="716" x2="840" y2="716" stroke="{PLUM}" stroke-width="2" opacity="0.45"/>
<text x="740" y="790" text-anchor="middle" font-family="{SANS}" font-size="36" fill="{MUTED}">Praktyczny poradnik dla przeciążonych kobiet,</text>
<text x="740" y="842" text-anchor="middle" font-family="{SANS}" font-size="36" fill="{MUTED}">które odkładają własne sprawy</text>
<text x="740" y="930" text-anchor="middle" font-family="{SANS}" font-size="27" letter-spacing="5" fill="{TERRA}">MENTAL LOAD · PERFEKCJONIZM · MIKRO-KROKI</text>

<text x="740" y="1885" text-anchor="middle" font-family="{SERIF}" font-size="62" letter-spacing="3" fill="{CREAM}">[IMIĘ I NAZWISKO AUTORKI]</text>
<text x="740" y="1960" text-anchor="middle" font-family="{SANS}" font-size="32" letter-spacing="9" fill="{SAND}" opacity="0.85">EDYCJA 2026</text>
</svg>'''


# ─────────────────────────────────────────────────────────────
# FIG 1 — pętla prokrastynacji
# ─────────────────────────────────────────────────────────────
def fig_loop():
    W, H = 1000, 720
    cx, cy, R = 500, 360, 245
    labels = [
        ("Przeciążenie", "za dużo zadań i decyzji"),
        ("Dyskomfort", "zadanie budzi opór"),
        ("Ucieczka", "coś prostszego, coś miłego"),
        ("Ulga", "krótka i prawdziwa"),
        ("Poczucie winy", "wieczorem wraca ze zdwojoną siłą"),
    ]
    n = len(labels)
    nodes = ""
    arcs = ""
    for i, (t, s) in enumerate(labels):
        a = -math.pi / 2 + i * 2 * math.pi / n
        x, y = cx + math.cos(a) * R, cy + math.sin(a) * R
        col = TERRA if i == 2 else PLUM
        nodes += f'''<circle cx="{x:.0f}" cy="{y:.0f}" r="52" fill="{CREAM}" stroke="{col}" stroke-width="3"/>
<text x="{x:.0f}" y="{y-2:.0f}" text-anchor="middle" font-family="{SANS}" font-size="30" font-weight="bold" fill="{col}">{i+1}</text>
<text x="{x:.0f}" y="{y+30:.0f}" text-anchor="middle" font-family="{SANS}" font-size="17" fill="{MUTED}">krok</text>'''
        ly = y - 78 if math.sin(a) < -0.2 else y + 92
        nodes += f'''<text x="{x:.0f}" y="{ly:.0f}" text-anchor="middle" font-family="{SANS}" font-size="27" font-weight="bold" fill="{INK}">{t}</text>
<text x="{x:.0f}" y="{ly+29:.0f}" text-anchor="middle" font-family="{SANS}" font-size="21" fill="{MUTED}">{s}</text>'''
        a2 = a + 2 * math.pi / n
        x1, y1 = cx + math.cos(a + 0.30) * (R - 4), cy + math.sin(a + 0.30) * (R - 4)
        x2, y2 = cx + math.cos(a2 - 0.30) * (R - 4), cy + math.sin(a2 - 0.30) * (R - 4)
        arcs += f'<path d="M {x1:.0f} {y1:.0f} A {R} {R} 0 0 1 {x2:.0f} {y2:.0f}" fill="none" stroke="{SAND}" stroke-width="7" marker-end="url(#ah)"/>'

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
<path d="M 0 0 L 10 5 L 0 10 z" fill="{SAND}"/></marker></defs>
{arcs}{nodes}
<text x="{cx}" y="{cy-16}" text-anchor="middle" font-family="{SERIF}" font-size="34" font-style="italic" fill="{PLUM}">pętla, która</text>
<text x="{cx}" y="{cy+26}" text-anchor="middle" font-family="{SERIF}" font-size="34" font-style="italic" fill="{PLUM}">sama się napędza</text>
<line x1="{cx-90}" y1="{cy+52}" x2="{cx+90}" y2="{cy+52}" stroke="{TERRA}" stroke-width="2"/>
<text x="{cx}" y="{cy+86}" text-anchor="middle" font-family="{SANS}" font-size="21" fill="{TERRA}">przerwać najłatwiej w kroku 3</text>
</svg>'''


# ─────────────────────────────────────────────────────────────
# FIG 2 — cztery mechanizmy i narzędzia
# ─────────────────────────────────────────────────────────────
def fig_mech():
    W, H = 1000, 640
    cards = [
        ("Reakcja stresowa", "Uciekasz od tego,\nco dla Ciebie ważne", "Rozdział 4\nmikro-start", TERRA),
        ("Osłabione funkcje\nwykonawcze", "Wieczorem\n„nie da się zacząć”", "Rozdział 6 i 7\nautomatyzacja, plan", PLUM),
        ("Przewaga nagrody\nnatychmiastowej", "Drobnica zjada\ncały dzień", "Rozdział 8\nprojektowanie otoczenia", SAGE),
        ("Wstyd\ni samokrytyka", "Im gorzej o sobie\nmyślisz, tym mniej robisz", "Rozdział 5\ndefuzja, samowspółczucie", GOLD),
    ]
    out = ""
    for i, (title, sym, tool, col) in enumerate(cards):
        x = 40 + (i % 2) * 480
        y = 40 + (i // 2) * 300
        out += f'<rect x="{x}" y="{y}" width="440" height="260" rx="16" fill="{CREAM}" stroke="{col}" stroke-width="2.5"/>'
        out += f'<rect x="{x}" y="{y}" width="440" height="7" rx="3.5" fill="{col}"/>'
        for j, line in enumerate(title.split("\n")):
            out += f'<text x="{x+28}" y="{y+62+j*34}" font-family="{SANS}" font-size="30" font-weight="bold" fill="{INK}">{line}</text>'
        off = 62 + len(title.split("\n")) * 34
        for j, line in enumerate(sym.split("\n")):
            out += f'<text x="{x+28}" y="{y+off+j*28}" font-family="{SANS}" font-size="22" fill="{MUTED}">{line}</text>'
        out += f'<line x1="{x+28}" y1="{y+186}" x2="{x+412}" y2="{y+186}" stroke="{SAND}" stroke-width="2"/>'
        for j, line in enumerate(tool.split("\n")):
            w = "bold" if j == 0 else "normal"
            out += f'<text x="{x+28}" y="{y+216+j*26}" font-family="{SANS}" font-size="22" font-weight="{w}" fill="{col}">{line}</text>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{out}</svg>'


# ─────────────────────────────────────────────────────────────
# FIG 3 — cztery składowe Mental Load
# ─────────────────────────────────────────────────────────────
def fig_mental_load():
    W, H = 1000, 560
    rows = [
        ("Przewidywanie", "wychwycenie, że coś będzie potrzebne", 82),
        ("Identyfikowanie", "znalezienie możliwych rozwiązań", 58),
        ("Decydowanie", "wybór jednego z nich", 52),
        ("Monitorowanie", "sprawdzenie, czy się wydarzyło", 84),
    ]
    out = f'''<text x="40" y="52" font-family="{SANS}" font-size="27" font-weight="bold" fill="{INK}">Cztery składowe pracy kognitywnej w domu</text>
<text x="40" y="86" font-family="{SANS}" font-size="21" fill="{MUTED}">Udział osoby, która „pamięta za wszystkich” — obraz typowy, nie pomiar w Twoim domu</text>'''
    y0 = 140
    for i, (name, desc, pct) in enumerate(rows):
        y = y0 + i * 96
        out += f'<text x="40" y="{y-6}" font-family="{SANS}" font-size="26" font-weight="bold" fill="{INK}">{name}</text>'
        out += f'<text x="40" y="{y+22}" font-family="{SANS}" font-size="20" fill="{MUTED}">{desc}</text>'
        bx, bw = 520, 400
        out += f'<rect x="{bx}" y="{y-30}" width="{bw}" height="44" rx="8" fill="{SAND}"/>'
        out += f'<rect x="{bx}" y="{y-30}" width="{bw*pct/100:.0f}" height="44" rx="8" fill="{PLUM if pct<70 else TERRA}"/>'
        out += f'<text x="{bx+bw*pct/100-14:.0f}" y="{y+2}" text-anchor="end" font-family="{SANS}" font-size="24" font-weight="bold" fill="{CREAM}">{pct}%</text>'
    out += f'''<line x1="40" y1="{y0+4*96-30}" x2="960" y2="{y0+4*96-30}" stroke="{SAND}" stroke-width="2"/>
<text x="40" y="{y0+4*96+12}" font-family="{SANS}" font-size="22" fill="{TERRA}" font-weight="bold">Wykonanie zadania to nie to samo, co odpowiedzialność za to, że ktoś o nim pomyślał.</text>'''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{out}</svg>'


# ─────────────────────────────────────────────────────────────
# FIG 4 — próg wejścia
# ─────────────────────────────────────────────────────────────
def fig_threshold():
    W, H = 1000, 520
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<text x="40" y="52" font-family="{SANS}" font-size="27" font-weight="bold" fill="{INK}">Nie boisz się pracy. Boisz się progu.</text>

<rect x="60" y="150" width="360" height="290" rx="14" fill="{CREAM}" stroke="{SAND}" stroke-width="2"/>
<text x="240" y="196" text-anchor="middle" font-family="{SANS}" font-size="24" font-weight="bold" fill="{MUTED}">ZADANIE W GŁOWIE</text>
<rect x="150" y="226" width="180" height="180" rx="8" fill="{PLUM}" opacity="0.9"/>
<text x="240" y="308" text-anchor="middle" font-family="{SANS}" font-size="26" fill="{CREAM}">„zacząć ćwiczyć”</text>
<text x="240" y="344" text-anchor="middle" font-family="{SANS}" font-size="22" fill="{SAND}">45 minut, strój, plan,</text>
<text x="240" y="372" text-anchor="middle" font-family="{SANS}" font-size="22" fill="{SAND}">porządek w pokoju</text>

<path d="M 450 295 L 545 295" stroke="{TERRA}" stroke-width="5" marker-end="url(#a2)"/>
<defs><marker id="a2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="{TERRA}"/></marker></defs>

<rect x="580" y="150" width="360" height="290" rx="14" fill="{CREAM}" stroke="{TERRA}" stroke-width="2.5"/>
<text x="760" y="196" text-anchor="middle" font-family="{SANS}" font-size="24" font-weight="bold" fill="{TERRA}">MIKRO-START</text>
<rect x="722" y="360" width="76" height="46" rx="6" fill="{TERRA}"/>
<text x="760" y="392" text-anchor="middle" font-family="{SANS}" font-size="24" fill="{CREAM}">2 min</text>
<text x="760" y="262" text-anchor="middle" font-family="{SANS}" font-size="26" fill="{INK}">„rozłożę matę</text>
<text x="760" y="296" text-anchor="middle" font-family="{SANS}" font-size="26" fill="{INK}">i zrobię jeden skłon”</text>
<text x="760" y="332" text-anchor="middle" font-family="{SANS}" font-size="21" fill="{MUTED}">po dwóch minutach wolno przerwać</text>

<line x1="60" y1="472" x2="940" y2="472" stroke="{SAND}" stroke-width="2"/>
<text x="500" y="504" text-anchor="middle" font-family="{SANS}" font-size="22" fill="{PLUM}">Twoja jedyna robota to pojawić się na progu. Reszta to inercja, nie dyscyplina.</text>
</svg>'''


# ─────────────────────────────────────────────────────────────
# FIG 5 — plan 14 dni
# ─────────────────────────────────────────────────────────────
def fig_plan():
    W, H = 1000, 520
    phases = [
        ("DNI 1–3", "Przełamywanie oporu", "2 minuty", 90, TERRA),
        ("DNI 4–7", "Stabilizacja", "10–15 minut", 175, PLUM),
        ("DNI 8–14", "Nowa normalność", "25 minut", 260, SAGE),
    ]
    out = f'<text x="40" y="52" font-family="{SANS}" font-size="27" font-weight="bold" fill="{INK}">Plan 14 dni — rosnąca dawka, nie rosnąca presja</text>'
    base = 400
    for i, (d, name, t, h, col) in enumerate(phases):
        x = 90 + i * 290
        out += f'<rect x="{x}" y="{base-h}" width="220" height="{h}" rx="12" fill="{col}" opacity="0.92"/>'
        out += f'<text x="{x+110}" y="{base-h+46}" text-anchor="middle" font-family="{SANS}" font-size="30" font-weight="bold" fill="{CREAM}">{t}</text>'
        out += f'<text x="{x+110}" y="{base-h-46}" text-anchor="middle" font-family="{SANS}" font-size="25" font-weight="bold" fill="{col}">{d}</text>'
        out += f'<text x="{x+110}" y="{base-h-16}" text-anchor="middle" font-family="{SANS}" font-size="21" fill="{MUTED}">{name}</text>'
    out += f'<line x1="60" y1="{base}" x2="940" y2="{base}" stroke="{INK}" stroke-width="3"/>'
    out += f'<text x="500" y="{base+52}" text-anchor="middle" font-family="{SANS}" font-size="22" fill="{MUTED}">Trudny dzień? Wracasz do wersji dwuminutowej. Nie zaczynasz od zera.</text>'
    out += f'<text x="500" y="{base+92}" text-anchor="middle" font-family="{SANS}" font-size="21" font-style="italic" fill="{TERRA}">14 dni to okres próbny na zebranie danych o sobie, nie termin utrwalenia nawyku.</text>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{out}</svg>'


# ─────────────────────────────────────────────────────────────
# FIG 6 — granica medyczna
# ─────────────────────────────────────────────────────────────
def fig_border():
    W, H = 1000, 600
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<text x="500" y="52" text-anchor="middle" font-family="{SANS}" font-size="27" font-weight="bold" fill="{INK}">Kiedy narzędzie, a kiedy lekarz</text>

<rect x="330" y="92" width="340" height="86" rx="14" fill="{CREAM}" stroke="{PLUM}" stroke-width="2.5"/>
<text x="500" y="128" text-anchor="middle" font-family="{SANS}" font-size="23" fill="{INK}">Odkładasz zadania</text>
<text x="500" y="158" text-anchor="middle" font-family="{SANS}" font-size="23" fill="{INK}">i to Ci przeszkadza</text>

<path d="M 500 178 L 500 226" stroke="{SAND}" stroke-width="5" marker-end="url(#a3)"/>
<defs><marker id="a3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="{SAND}"/></marker></defs>

<rect x="270" y="226" width="460" height="80" rx="14" fill="{SAND}"/>
<text x="500" y="262" text-anchor="middle" font-family="{SANS}" font-size="22" font-weight="bold" fill="{INK}">Czy trudności ustępują, gdy obciążenie spada?</text>
<text x="500" y="290" text-anchor="middle" font-family="{SANS}" font-size="20" fill="{PLUMD}">urlop, wolny weekend, spokojniejszy okres</text>

<path d="M 380 306 L 250 372" stroke="{SAGE}" stroke-width="5" marker-end="url(#a4)"/>
<path d="M 620 306 L 750 372" stroke="{TERRA}" stroke-width="5" marker-end="url(#a5)"/>
<defs>
<marker id="a4" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="{SAGE}"/></marker>
<marker id="a5" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="{TERRA}"/></marker>
</defs>

<rect x="50" y="380" width="400" height="170" rx="14" fill="{CREAM}" stroke="{SAGE}" stroke-width="2.5"/>
<rect x="50" y="380" width="400" height="7" rx="3.5" fill="{SAGE}"/>
<text x="80" y="428" font-family="{SANS}" font-size="26" font-weight="bold" fill="{SAGE}">TAK — ustępują</text>
<text x="80" y="464" font-family="{SANS}" font-size="21" fill="{INK}">To najpewniej przeciążenie.</text>
<text x="80" y="494" font-family="{SANS}" font-size="21" fill="{MUTED}">Pracuj narzędziami z rozdziałów</text>
<text x="80" y="522" font-family="{SANS}" font-size="21" fill="{MUTED}">4–9. Zacznij od redystrybucji.</text>

<rect x="550" y="380" width="400" height="170" rx="14" fill="{CREAM}" stroke="{TERRA}" stroke-width="2.5"/>
<rect x="550" y="380" width="400" height="7" rx="3.5" fill="{TERRA}"/>
<text x="580" y="428" font-family="{SANS}" font-size="26" font-weight="bold" fill="{TERRA}">NIE — trwają mimo wszystko</text>
<text x="580" y="464" font-family="{SANS}" font-size="21" fill="{INK}">Umów wizytę u lekarza.</text>
<text x="580" y="494" font-family="{SANS}" font-size="21" fill="{MUTED}">Opisz: co, od kiedy, jak często,</text>
<text x="580" y="522" font-family="{SANS}" font-size="21" fill="{MUTED}">z jakim wpływem na życie.</text>
</svg>'''


# ─────────────────────────────────────────────────────────────
# FIG 7 — siła dowodów
# ─────────────────────────────────────────────────────────────
def fig_evidence():
    W, H = 1000, 560
    tiers = [
        ("MOCNE WSPARCIE", SAGE, 3, ["prokrastynacja jako regulacja nastroju", "nierówny podział pracy kognitywnej w domu",
                                     "intencje wdrożeniowe „jeśli X, to Y”", "samowspółczucie a stres", "stres i sen a funkcje wykonawcze"]),
        ("UMIARKOWANE", GOLD, 2, ["wypalenie rodzicielskie jako konstrukt", "odkładanie snu", "efekt „pal licho”"]),
        ("PRAKTYKA AUTORKI", TERRA, 1, ["body doubling, Pomodoro, plan 14 dni", "autotest i pięć profili", "skrypty rozmów, progi „30 procent”"]),
    ]
    out = f'<text x="40" y="50" font-family="{SANS}" font-size="27" font-weight="bold" fill="{INK}">Na czym stoi ta książka</text>'
    y = 100
    for name, col, dots, items in tiers:
        out += f'<rect x="40" y="{y}" width="920" height="{48+len(items)*30}" rx="12" fill="{CREAM}" stroke="{col}" stroke-width="2"/>'
        out += f'<rect x="40" y="{y}" width="7" height="{48+len(items)*30}" rx="3.5" fill="{col}"/>'
        out += f'<text x="72" y="{y+34}" font-family="{SANS}" font-size="24" font-weight="bold" fill="{col}">{name}</text>'
        for d in range(3):
            fill = col if d < dots else SAND
            out += f'<circle cx="{900-d*30}" cy="{y+27}" r="9" fill="{fill}"/>'
        for i, it in enumerate(items):
            out += f'<circle cx="{84}" cy="{y+58+i*30-6}" r="3.5" fill="{col}"/>'
            out += f'<text x="102" y="{y+58+i*30}" font-family="{SANS}" font-size="21" fill="{INK}">{it}</text>'
        y += 48 + len(items) * 30 + 22
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{out}</svg>'


# ─────────────────────────────────────────────────────────────
# FIG 8 — pięć profili
# ─────────────────────────────────────────────────────────────
def fig_profiles():
    W, H = 1000, 400
    profs = [
        ("A", "Perfekcyjna\nPani Domu", PLUM),
        ("B", "Męczennica\nMental Load", TERRA),
        ("C", "Uciekinierka\nw Troskę", SAGE),
        ("D", "Znieczulaczka\nWieczorna", PLUMD),
        ("E", "Zagubiona\nw Chaosie", GOLD),
    ]
    out = f'<text x="500" y="46" text-anchor="middle" font-family="{SANS}" font-size="26" font-weight="bold" fill="{INK}">Pięć wzorców odkładania — autorska typologia, nie klasyfikacja diagnostyczna</text>'
    for i, (letter, name, col) in enumerate(profs):
        cx = 118 + i * 191
        out += f'<circle cx="{cx}" cy="180" r="66" fill="{CREAM}" stroke="{col}" stroke-width="3"/>'
        out += f'<circle cx="{cx}" cy="180" r="52" fill="{col}" opacity="0.12"/>'
        out += f'<text x="{cx}" y="200" text-anchor="middle" font-family="{SERIF}" font-size="56" font-weight="bold" fill="{col}">{letter}</text>'
        for j, line in enumerate(name.split("\n")):
            out += f'<text x="{cx}" y="{288+j*28}" text-anchor="middle" font-family="{SANS}" font-size="22" fill="{INK}">{line}</text>'
    out += f'<text x="500" y="372" text-anchor="middle" font-family="{SANS}" font-size="21" font-style="italic" fill="{MUTED}">Kilka wysokich wyników naraz to norma — te wzorce się nakładają.</text>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{out}</svg>'


# ─────────────────────────────────────────────────────────────
# Ornament
# ─────────────────────────────────────────────────────────────
def ornament():
    pts = [(20 + i * 26, 30 + math.sin(i * 0.9) * 13) for i in range(11)]
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 60" width="320" height="60">
<path d="{smooth_path(pts)}" fill="none" stroke="{PLUM}" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
<circle cx="{pts[-1][0]:.0f}" cy="{pts[-1][1]:.0f}" r="6" fill="{TERRA}"/>
<circle cx="20" cy="{pts[0][1]:.0f}" r="3" fill="{PLUM}" opacity="0.6"/>
</svg>'''


if __name__ == "__main__":
    write("okladka.svg", cover())
    write("fig-01-petla.svg", fig_loop())
    write("fig-02-mechanizmy.svg", fig_mech())
    write("fig-03-mental-load.svg", fig_mental_load())
    write("fig-04-prog-wejscia.svg", fig_threshold())
    write("fig-05-plan-14-dni.svg", fig_plan())
    write("fig-06-granica-medyczna.svg", fig_border())
    write("fig-07-sila-dowodow.svg", fig_evidence())
    write("fig-08-profile.svg", fig_profiles())
    write("ornament.svg", ornament())
