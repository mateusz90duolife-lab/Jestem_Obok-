# -*- coding: utf-8 -*-
"""Skład e-booka: Markdown -> HTML (A5, gotowy do druku PDF)."""
import os, re, html, io

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
SRC = os.path.join(ROOT, "prokrastynacja-w-kobiecym-zaciszu.md")
ASSETS = os.path.join(ROOT, "assets")
OUT_HTML = os.path.join(ROOT, "Prokrastynacja-w-Kobiecym-Zaciszu.html")

def svg(name):
    with open(os.path.join(ASSETS, name), encoding="utf-8") as f:
        s = f.read()
    return re.sub(r'\s(width|height)="[\d.]+"', "", s, count=2)

# ── grafiki: (kotwica, tryb, plik, podpis) ──────────────────────────
FIGURES = [
    ("Jak to się łączy — pętla odkładania", "after",  "fig-01-petla.svg",
     "Rys. 1. Pętla odkładania. Każdy krok napędza następny."),
    ("Mapa — cztery mechanizmy i ich narzędzia", "after_replace_table", "fig-02-mechanizmy.svg",
     "Rys. 2. Cztery mechanizmy i rozdziały, w których znajdziesz narzędzie do każdego z nich."),
    ("Sekcja A: Perfekcyjna Pani Domu (presja obrazka)", "before", "fig-08-profile.svg",
     "Rys. 3. Pięć wzorców odkładania opisanych w tym rozdziale."),
    ("ROZDZIAŁ 3: MENTAL LOAD — MÓZG POD OBCIĄŻENIEM", "after", "fig-03-mental-load.svg",
     "Rys. 4. Cztery składowe pracy kognitywnej w gospodarstwie domowym (za: Daminger, 2019)."),
    ("Zasada 2 minut", "before", "fig-04-prog-wejscia.svg",
     "Rys. 5. To samo zadanie widziane jako całość i jako mikro-start."),
    ("Dni 1–3: przełamywanie oporu", "before", "fig-05-plan-14-dni.svg",
     "Rys. 6. Trzy fazy planu 14 dni."),
    ("Kiedy przestać szukać techniki, a zacząć szukać lekarza", "before", "fig-06-granica-medyczna.svg",
     "Rys. 7. Jedno pytanie, które porządkuje decyzję o wizycie."),
    ("NOTA O SILE DOWODÓW", "after", "fig-07-sila-dowodow.svg",
     "Rys. 8. Trzy poziomy udokumentowania twierdzeń z tej książki."),
]

CALLOUTS = [
    ("📚", "CO WIEMY Z BADAŃ", "badania"),
    ("🧭", "JAK MOŻESZ TO WYKORZYSTAĆ", "praktyka"),
    ("✍️", "ĆWICZENIE", "cwiczenie"),
    ("⚠️", None, "uwaga"),
    ("⛑", None, "alarm"),
]

ICONS = {
    "badania": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M9 7.5h6M9 11h4"/></svg>',
    "praktyka": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
    "cwiczenie": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5l4 4L8 20l-5 1 1-5z"/><path d="M14 6l4 4"/></svg>',
    "uwaga": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5L22 20H2z"/><path d="M12 10v4M12 17h.01"/></svg>',
    "alarm": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-8-4.6-8-10.2A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 8 3.8C20 16.4 12 21 12 21z"/></svg>',
}


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'&lt;a id="([^"]+)"&gt;&lt;/a&gt;', r'<a id="\1"></a>', t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<![\w*])\*([^*\n]+?)\*(?![\w*])', r'<em>\1</em>', t)
    t = re.sub(r'\[(\d+(?:,\s*\d+)*)\]', r'<span class="ref">[\1]</span>', t)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    return t


def render_lines(lines):
    """Renderuje listę linii (bez nagłówków) jako akapity/listy/tabele."""
    out, i = [], 0
    while i < len(lines):
        ln = lines[i]
        if not ln.strip():
            i += 1
            continue
        # tabela
        if ln.lstrip().startswith("|"):
            tbl = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                tbl.append(lines[i].strip())
                i += 1
            out.append(render_table(tbl))
            continue
        # lista numerowana / punktowana
        m_ol = re.match(r'^\s*(\d+)\.\s+(.*)$', ln)
        m_ul = re.match(r'^\s*[-•]\s+(.*)$', ln)
        if m_ol or m_ul:
            tag = "ol" if m_ol else "ul"
            items, first = [], True
            while i < len(lines):
                l2 = lines[i]
                mo = re.match(r'^\s*\d+\.\s+(.*)$', l2)
                mu = re.match(r'^\s*[-•]\s+(.*)$', l2)
                if mo and tag == "ol":
                    items.append([mo.group(1)])
                elif mu and tag == "ul":
                    items.append([mu.group(1)])
                elif l2.strip() and (l2.startswith("   ") or l2.startswith("\t")) and items:
                    items[-1].append(l2.strip())
                elif (mo or mu) and items:
                    break
                elif not l2.strip():
                    break
                else:
                    break
                i += 1
                first = False
            body = "".join("<li>%s</li>" % "<br>".join(inline(x) for x in it) for it in items)
            out.append(f"<{tag}>{body}</{tag}>")
            continue
        # akapit
        para = []
        while i < len(lines) and lines[i].strip() and not lines[i].lstrip().startswith("|") \
                and not re.match(r'^\s*(\d+\.|[-•])\s+', lines[i]):
            para.append(lines[i].strip())
            i += 1
        out.append("<p>%s</p>" % inline(" ".join(para)))
    return "".join(out)


def render_table(rows):
    cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in rows]
    if len(cells) > 1 and all(re.fullmatch(r':?-{2,}:?', c.strip() or "-") for c in cells[1]):
        head, body = cells[0], cells[2:]
    else:
        head, body = None, cells
    h = ""
    if head:
        h = "<thead><tr>%s</tr></thead>" % "".join(f"<th>{inline(c)}</th>" for c in head)
    b = "<tbody>%s</tbody>" % "".join(
        "<tr>%s</tr>" % "".join(f"<td>{inline(c)}</td>" for c in r) for r in body)
    return f'<div class="tw"><table>{h}{b}</table></div>'


def render_blockquote(lines):
    inner = [re.sub(r'^\s*>\s?', '', l) for l in lines]
    txt = "\n".join(inner)
    cls = "quote"
    if "⚠️" in txt or "NIE jest" in txt:
        cls = "quote warn"
    return f'<blockquote class="{cls}">{render_blocks(txt)}</blockquote>'


def callout_of(first_line):
    for emoji, label, cls in CALLOUTS:
        if first_line.startswith(emoji):
            rest = first_line[len(emoji):].strip()
            m = re.match(r'^\*\*(.+?)\*\*\s*(.*)$', rest)
            if m and len(m.group(1)) <= 42:
                return cls, m.group(1), m.group(2)
            return cls, None, rest
    return None, None, None


def render_blocks(text):
    blocks = re.split(r'\n\s*\n', text)
    out = []
    for blk in blocks:
        lines = blk.split("\n")
        while lines and not lines[0].strip():
            lines = lines[1:]
        while lines and not lines[-1].strip():
            lines = lines[:-1]
        if not lines:
            continue
        # samodzielne kotwice HTML nie mogą blokować nagłówka pod spodem
        while lines and re.fullmatch(r'\s*<a id="[^"]+"></a>\s*', lines[0]):
            out.append(lines[0].strip())
            lines = lines[1:]
        if not lines or not any(l.strip() for l in lines):
            continue
        s = lines[0].strip()
        if s.startswith(">"):
            out.append(render_blockquote(lines)); continue
        if re.fullmatch(r'-{3,}', s):
            out.append('<hr>'); continue
        m = re.match(r'^(#{1,6})\s+(.*)$', s)
        if m:
            lvl = len(m.group(1))
            htxt = m.group(2)
            hcls = ""
            for e, c in (("⚠️", "h-warn"), ("⛑", "h-alarm"), ("📚", "h-ref")):
                if htxt.startswith(e):
                    htxt, hcls = htxt[len(e):].strip(), ' class="%s"' % c
                    break
            out.append(f"<h{lvl}{hcls}>{inline(htxt)}</h{lvl}>")
            rest = lines[1:]
            if any(l.strip() for l in rest):
                out.append(render_lines(rest))
            continue
        cls, label, rest = callout_of(s)
        if cls:
            body_lines = ([rest] if rest else []) + lines[1:]
            lab = f'<div class="cal-h"><span class="cal-i">{ICONS[cls]}</span>{html.escape(label)}</div>' if label else ""
            inner = render_lines(body_lines)
            if not label:
                inner = f'<div class="cal-h nolabel"><span class="cal-i">{ICONS[cls]}</span></div>' + inner
            out.append(f'<div class="cal cal-{cls}">{lab}{inner}</div>')
            continue
        out.append(render_lines(lines))
    return "".join(out)


def main():
    md = open(SRC, encoding="utf-8").read()

    # ── strona tytułowa = wszystko przed pierwszym '---'
    head, rest = md.split("\n---\n", 1)

    # ── wstrzyknięcie grafik
    for anchor, mode, fname, caption in FIGURES:
        fig = f'<figure class="fig">{svg(fname)}<figcaption>{caption}</figcaption></figure>'
        token = f"\n\n@@FIG:{fname}@@\n\n"
        pat = re.compile(r'^(#{2,4}\s+.*' + re.escape(anchor) + r'.*)$', re.M)
        m = pat.search(rest)
        if not m:
            print("  ! nie znaleziono kotwicy:", anchor); continue
        if mode == "before":
            rest = rest[:m.start()] + token.strip() + "\n\n" + rest[m.start():]
        else:
            rest = rest[:m.end()] + token + rest[m.end():]
            if mode == "after_replace_table":
                tbl = re.compile(r'\n\|.*(?:\n\|.*)+\n')
                mt = tbl.search(rest, m.end())
                if mt:
                    rest = rest[:mt.start()] + "\n" + rest[mt.end():]
        globals().setdefault("_figs", {})[fname] = fig

    body = render_blocks(rest)
    for fname, fig in globals().get("_figs", {}).items():
        body = body.replace(f"<p>@@FIG:{fname}@@</p>", fig)

    # ── ornament pod tytułami rozdziałów
    orn = svg("ornament.svg")
    body = re.sub(r'(<h2>.*?</h2>)', r'\1<div class="orn">' + orn + '</div>', body)

    # ── strona tytułowa
    hl = [l for l in head.split("\n") if l.strip()]
    title_page = f'''<section class="titlepage">
  <div class="tp-kicker">PORADNIK PRAKTYCZNY</div>
  <h1 class="tp-title">Prokrastynacja<br><em>w kobiecym zaciszu</em></h1>
  <div class="tp-rule"></div>
  <p class="tp-sub">Praktyczny poradnik dla przeciążonych kobiet,<br>które odkładają własne sprawy</p>
  <p class="tp-note">Edycja 2026 — wersja poprawiona merytorycznie</p>
  <p class="tp-lead">To nie jest e-book o tym, jak lepiej sprzątać dom czy perfekcyjnie
     organizować czas rodzinie. To praktyczny przewodnik dla kobiet, których układ nerwowy
     tonie w niewidzialnych obowiązkach.</p>
  <div class="tp-orn">{orn}</div>
  <p class="tp-author">[IMIĘ I NAZWISKO AUTORKI]</p>
</section>'''

    css = open(os.path.join(HERE, "style.css"), encoding="utf-8").read()
    doc = f'''<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prokrastynacja w Kobiecym Zaciszu</title>
<style>{css}</style></head>
<body>
<section class="cover">{svg("okladka.svg")}</section>
{title_page}
<main class="book">{body}</main>
</body></html>'''
    open(OUT_HTML, "w", encoding="utf-8").write(doc)
    print("napisano", os.path.relpath(OUT_HTML, ROOT), f"({len(doc)//1024} KB)")


if __name__ == "__main__":
    main()
