# The Otherness of English — Online Reader

A lightweight, static website for reading *The Otherness of English: India's Auntie Tongue Syndrome* by Probal Dasgupta.

## ⚠️ Disclaimer

This text was converted from scanned PDF pages using OCR (Tesseract.js). While extensive post-processing was applied to improve accuracy, **the text may contain minor errors or inaccuracies**. It should not be treated as a definitive source. Please refer to the original printed book for authoritative text.

## Features

- **9 parts** of the book, fully searchable
- **Global search** (Ctrl/⌘+K) across all chapters with context snippets
- **Table of contents** sidebar for each part
- **Dark/light mode** with system preference detection
- **Fully static** — no server required, works on GitHub Pages
- **Responsive** — works on desktop, tablet, and mobile
- **Lightweight** — pure HTML/CSS/JS, no frameworks

## Design

- Monochromatic palette: `#ffffff`/`#000000` backgrounds
- Typography: Inter (body), JetBrains Mono (code/labels)
- Accent: `#0071e3` (soft blue)
- Max reading width: 680px

## Development

```bash
# Serve locally
npx serve .

# Or with any static file server
```

No build step required. All files are static.

## Structure

```
├── index.html          # Single page app
├── style.css           # All styles
├── app.js              # All logic
├── data/
│   ├── index.json      # Parts metadata
│   ├── search.json     # Flattened search index
│   ├── oepart1.json    # Part 1 content
│   ├── ...
│   └── oepart9.json    # Part 9 content
└── parse-texts.mjs     # Build script (converts .txt → .json)
```
