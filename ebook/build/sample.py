# -*- coding: utf-8 -*-
"""Darmowy fragment (lead magnet): początek książki do końca Rozdziału 1 + strona z zaproszeniem."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, ".."))
md = open(os.path.join(ROOT, "prokrastynacja-w-kobiecym-zaciszu.md"), encoding="utf-8").read()
cut = md.index('<a id="rozdzial-2"></a>')
cta = '''
---

## TO BYŁ DOPIERO POCZĄTEK

Właśnie przeczytałaś Wstęp i Rozdział 1. Wiesz już, że odkładanie zadań rzadko jest kwestią charakteru — i że pętla stresu, ucieczki i wstydu ma kilka miejsc, w których da się ją przerwać.

W pełnej wersji książki znajdziesz:

- **Autotest i pięć wzorców odkładania** — żeby wiedzieć, od którego rozdziału zacząć.
- **Mental Load** — co mówią badania o niewidzialnej pracy w domu i dlaczego kolejny planer tego nie naprawi.
- **Mikro-start i plan 14 dni** — małe kroki oparte na najlepiej udokumentowanym narzędziu zmiany zachowania.
- **Skrypt rozmowy z partnerem** — jak przekazać całą odpowiedzialność, a nie tylko pojedyncze zadania.
- **Protokół awaryjny** — co zrobić w dniu, w którym wszystko się wali.
- **Granicę medyczną** — kiedy techniki to za mało i jak przygotować się do wizyty u lekarza.
- **Zeszyt ćwiczeń do wydruku** — 13 stron z miejscem na Twoje odpowiedzi.

Każde twierdzenie w książce jest oznaczone: wiesz, co wynika z badań, a co jest praktyczną rekomendacją. Bibliografia zawiera 31 źródeł — wszystkie artykuły naukowe z numerami DOI.

🧭 **PEŁNA WERSJA**
[ADRES STRONY SPRZEDAŻOWEJ]
'''
tmp = os.path.join(HERE, "_fragment.md")
open(tmp, "w", encoding="utf-8").write(md[:cut] + cta)
out = os.path.join(ROOT, "Darmowy-fragment.html")
subprocess.run([sys.executable, os.path.join(HERE, "build.py"), tmp, out], check=True)
os.remove(tmp)
