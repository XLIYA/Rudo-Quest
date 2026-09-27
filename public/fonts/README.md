# Display font

`bitcount-mono-v1.woff2` is the monochrome **Bitcount** font from
[Google Fonts](https://github.com/google/fonts/tree/main/ofl/bitcount), licensed
under the accompanying `bitcount-OFL.txt` (SIL Open Font License).

The upstream TTF blob is `f042def787fa22b537273110fee68068bb6812c3`.
It was converted with fontTools to WOFF2, retaining the weight axis (100–900)
and all 396 mapped characters. The other axes are pinned to their defaults:
`ELXP=0`, `ELSH=0`, `slnt=0`, `CRSV=0.5`.

Unlike Bitcount Ink, this asset uses ordinary outline glyphs and contains no
COLR/CPAL tables. It does not require color-font support or CSS brightness
filters, so headings use the theme's text color directly.

The versioned filename deliberately differs from the old Ink assets: installed
PWAs use a cache-first strategy for fonts. Give future replacements a new URL
to avoid serving a previous binary from that cache.
