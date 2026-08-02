# Francesca Naymarie Musa-Akande — Personal Website

A standalone, responsive editorial website built from the supplied MAFF media archive and published within Tengacion.

Production URL: `https://tengacion.com/francesca-naymarie/`

## Preview locally

Serve `frontend/public` from the repository root with any static file server.

For example:

```powershell
python -m http.server 4173 --directory frontend/public
```

Then visit `http://localhost:4173/francesca-naymarie/`.

## Structure

- `index.html` — semantic page structure and editorial content
- `styles.css` — responsive visual system and motion
- `script.js` — navigation, scroll reveals, gallery filtering, and lightbox
- `assets/images` — curated source photographs from the supplied archive
- `assets/video` — supplied KIFC and MAFF videos

No build step or third-party runtime dependency is required.
