# -*- coding: utf-8 -*-
"""Wersja przeglądarkowa (Artifact) — ten sam skład, plus motyw ciemny."""
import os, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, ".."))
src = open(os.path.join(ROOT, "Prokrastynacja-w-Kobiecym-Zaciszu.html"), encoding="utf-8").read()

css = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
body = re.search(r'<body>(.*)</body>', src, re.S).group(1)

# tokeny motywu + nadpisania literałów kolorystycznych
theme = """
/* ══ motyw: jasny (bazowy) i ciemny ══ */
:root{
  --page:#FFFFFF; --shell:#EFE9E1; --plate:transparent; --plate-pad:0;
  --cal-badania:#F4F6F1; --cal-praktyka:#F7F2F5; --cal-cwiczenie:#FCF6E9;
  --cal-uwaga:#FBF1EC; --cal-alarm:#FBEDEC;
  --quote:#FBF8F4; --quote-warn:#FBF0EA; --zebra:#FBF7F2; --th:#553546;
  --gold-t:#A87A1E; --shadow:0 6px 30px rgba(36,30,43,.10);
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --ink:#E9E2ED; --muted:#A095AA; --rule:#3A3243; --page:#17141C; --shell:#0F0D13;
  --plum:#CFA0B6; --plumd:#E6D2DC; --terra:#E4906D; --sage:#A2B694; --gold:#E0B457;
  --cream:#221D29; --sand:#3A3243; --gold-t:#E0B457;
  --cal-badania:#1B2019; --cal-praktyka:#221B22; --cal-cwiczenie:#231E14;
  --cal-uwaga:#241a16; --cal-alarm:#26171a;
  --quote:#1D1924; --quote-warn:#251a17; --zebra:#1C1823; --th:#3B2E3A;
  --plate:#FAF6F0; --plate-pad:14px; --shadow:0 6px 30px rgba(0,0,0,.45);
}}
:root[data-theme="dark"]{
  --ink:#E9E2ED; --muted:#A095AA; --rule:#3A3243; --page:#17141C; --shell:#0F0D13;
  --plum:#CFA0B6; --plumd:#E6D2DC; --terra:#E4906D; --sage:#A2B694; --gold:#E0B457;
  --cream:#221D29; --sand:#3A3243; --gold-t:#E0B457;
  --cal-badania:#1B2019; --cal-praktyka:#221B22; --cal-cwiczenie:#231E14;
  --cal-uwaga:#241a16; --cal-alarm:#26171a;
  --quote:#1D1924; --quote-warn:#251a17; --zebra:#1C1823; --th:#3B2E3A;
  --plate:#FAF6F0; --plate-pad:14px; --shadow:0 6px 30px rgba(0,0,0,.45);
}
body{ background:var(--shell); color:var(--ink); }
.titlepage,.book{ background:var(--page); box-shadow:var(--shadow); }
.cal-badania{ background:var(--cal-badania) } .cal-praktyka{ background:var(--cal-praktyka) }
.cal-cwiczenie{ background:var(--cal-cwiczenie) } .cal-cwiczenie .cal-h{ color:var(--gold-t) }
.cal-uwaga{ background:var(--cal-uwaga) } .cal-alarm{ background:var(--cal-alarm) }
blockquote{ background:var(--quote); border-color:var(--rule) }
blockquote.warn{ background:var(--quote-warn) }
th{ background:var(--th) } tbody tr:nth-child(even) td{ background:var(--zebra) }
code{ background:var(--cream) }
/* ilustracje i okładka jako jasne plansze na ciemnym tle */
.fig{ background:var(--plate); padding:var(--plate-pad); border-radius:6px }
.cover{ box-shadow:var(--shadow) }
.orn svg path{ stroke:var(--plum) } .orn svg circle{ fill:var(--terra) }

/* pasek postępu czytania */
#prog{ position:fixed; inset:0 auto auto 0; height:3px; width:0;
  background:linear-gradient(90deg,var(--plum),var(--terra)); z-index:9; transition:width .12s linear }
@media (prefers-reduced-motion:reduce){ #prog{ transition:none } }
"""

js = """
(function(){
  var bar=document.getElementById('prog');
  function up(){ var h=document.documentElement.scrollHeight-window.innerHeight;
    bar.style.width = (h>0 ? Math.min(100, window.scrollY/h*100) : 0) + '%'; }
  addEventListener('scroll', up, {passive:true}); addEventListener('resize', up); up();
})();
"""

out = f'''<title>Prokrastynacja w kobiecym zaciszu</title>
<style>{css}
{theme}</style>
<div id="prog"></div>
{body}
<script>{js}</script>'''
open(os.path.join(ROOT, "build", "artifact.html"), "w", encoding="utf-8").write(out)
print("napisano build/artifact.html", len(out)//1024, "KB")
