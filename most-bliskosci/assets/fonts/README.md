# Fonts

`fonts.config.json` at the project root is the contract. It names the two families the
design system is specified against and the substitution profile currently in force.

## Specified (production) families — NOT present in this checkout

| Role    | Family             | Weights needed        | Expected files                                                       |
|---------|--------------------|-----------------------|----------------------------------------------------------------------|
| display | Cormorant Garamond | 500, 600, 400 italic  | `CormorantGaramond-Medium.ttf`, `-SemiBold.ttf`, `-Italic.ttf`        |
| ui      | Manrope            | 400, 500, 600         | `Manrope-Regular.ttf`, `Manrope-Medium.ttf`, `Manrope-SemiBold.ttf`   |

Drop those files into this directory and re-run `npm run build`. The pipeline detects
them automatically, switches font status to `EXACT`, and stops reporting substitution.

## Substitutes in force

Cormorant Garamond and Manrope could not be obtained in this environment: the egress
proxy denies `fonts.googleapis.com` and the npm registry, so neither the fonts nor a
font package could be downloaded. Rather than silently rendering with a default face,
the pipeline resolves an explicitly declared substitution profile and reports
`Fonts: SUBSTITUTED` in every artifact it produces.

| Role    | Substitute       | Files                                                    | Licence |
|---------|------------------|----------------------------------------------------------|---------|
| display | Instrument Serif | `InstrumentSerif-Regular.ttf`, `InstrumentSerif-Italic.ttf` | OFL 1.1 |
| ui      | Instrument Sans  | `InstrumentSans-Regular.ttf`, `-Bold.ttf`, `-Italic.ttf`    | OFL 1.1 |

Both carry complete Polish diacritic coverage and GPOS kerning, and they are a
designed pair, which keeps the deck internally coherent while substituted.

Weight mapping under substitution is lossy and is recorded in
`output/qa/report.json` under `fonts.substitutions`: Instrument Serif has no SemiBold,
so display 600 resolves to its Regular; Instrument Sans has no Medium/SemiBold, so
UI 500 resolves to Regular and UI 600 to Bold.
