# UI/UX PRO — composer & dictionary

Two small static tools for sketching landing pages.

## Live

- LP: https://longdrift.github.io/uipro-demo/index.html
- Composer: https://longdrift.github.io/uipro-demo/composer/
- Dictionary: https://longdrift.github.io/uipro-demo/dictionary/

## Stack

Pure static HTML + inline CSS + small JS. No build step. Three Google Fonts (Fraunces / Inter / JetBrains Mono).

## Pages

- **`index.html`** — index hub linking to the two tools.
- **`composer/`** — pick 5 slots (product type, UI style, palette, LP pattern, typography) to preview a landing page. Previews pass through a calm palette transform.
- **`dictionary/`** — browsable visual reference for the slots used by the composer.

## Aesthetic

Muted cream / warm charcoal palette. Fraunces italic for display, Inter for body, JetBrains Mono for labels. Shared across pages.

## Running locally

```bash
python -m http.server 8765
# then open http://localhost:8765/
```
