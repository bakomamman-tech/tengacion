# Lorietta Billy portfolio

Public route: `/Lorietta-Billys-Portfolio` (also accepts lowercase and a trailing slash).

The route mounts independently of the signed-in social app. Content lives in `frontend/src/features/lorietta/content.js`; layout and interactions are in `LoriettaPortfolio.jsx`; styling is scoped to `.lb-site` in `lorietta.css`. The existing backend serves the route with public indexing, a canonical URL and portrait social previews. The route is included in the static sitemap.

Contact: `billylorietta@gmail.com`, taken from the supplied resume. The enquiry form validates inputs and prepares an editable email draft. Visitors send using their email app, or copy the draft. The website does not submit or store enquiries, and never claims an email was delivered.

All six portfolio projects contain explicitly fictional demonstration data. CSV downloads include an illustrative-sample notice. Employment claims are grounded in the supplied brief and resume; the original resume and photos are not published.

## Photo assets

Built-in imagegen was used, preserving Lorietta's recognizable face, skin tone and pink glasses. Two edited portraits are served as compact JPEGs:
- `frontend/public/lorietta/portrait.jpg`
- `frontend/public/lorietta/about.jpg`

Full-resolution generated PNGs are retained locally in `output/lorietta/` (git-ignored). The source ZIP remains unchanged.

Portrait prompt: Edit the pink-shirt photo, preserving facial identity, complexion, face shape, age, glasses and earrings. Dress her in a tailored royal blue suit blazer with white inner blouse, retain the short black curled hairstyle, and remove the lanyard. Use a warm off-white studio background, natural skin texture and soft daylight. No text or logos.

About prompt: Edit the scarf/headset photo, preserving facial identity, hand-under-chin pose, red manicure and expression. Remove scarf, headset and lanyard; use the short black curled hairstyle and royal blue blazer with white inner blouse from the first edit. Warm ivory studio background, natural texture and accurate hand anatomy.

## Validation

Production frontend build; scoped ESLint; server SEO assertions for exact and lowercase routes; desktop (1440 px) and mobile (390 px) browser checks; project category filtering; native dialog open/Escape close; enquiry draft and mailto recipient; mobile menu open/close; no browser runtime exceptions. Browser screenshots are retained in `.tmp/lorietta-*.png`.
