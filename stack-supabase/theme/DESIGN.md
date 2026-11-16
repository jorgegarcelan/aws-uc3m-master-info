# minimal — design rules

White stage, system fonts (SF Pro on macOS, Segoe UI on Windows), one blue accent. Quiet by default so content and data carry the slide. Good base for a brand: change the tokens at the top of `theme.css` and the section colors in `slaas.json`.

## Color

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0f1115` | titles, key text |
| `--muted` | `#4b5563` | body text |
| `--faint` | `#9ca3af` | labels, captions, axes |
| `--line` / `--line-2` | `#e5e7eb` / `#f1f2f4` | borders, table rules, empty bar tracks |
| `--surface` | `#f7f7f8` | cards |
| `--accent` | `#2563eb` | the one thing to look at: key number, highlighted series, links |
| `--good` `--bad` `--warn` `--info` | `#059669` `#dc2626` `#d97706` `#0891b2` | status and comparisons only |

Series order for charts (`h.C.series`): `#2563eb`, `#0d9488`, `#d97706`, `#e11d48`, `#7c3aed`, `#475569`. Highlight one series in accent and grey the rest when the point is a single comparison.

## Type

- Titles (`h-slide`, 56 px, 700): sentence case, the claim of the slide, at most two lines.
- Body (`body` 22 px / `body-lg` 26 px, `--muted`): short sentences, `<b>` for the two or three words that matter.
- Numbers (`num`, mono 700): big figures; one per slide is stronger than four.
- Labels (`label`, mono uppercase 15 px): axes, table heads, small tags. Never for sentences.

## Do / don't

- Do leave space: a slide with one chart and one sentence beats a slide with three charts.
- Do use `.card` for parallel items (3–4 max per row), `.callout` for the single takeaway.
- Don't use more than one accent color per slide outside charts.
- Don't center long text; center only titles, big numbers and closings.
- Section openers: big section number in the section color, a colored band on the left (set by the theme).
