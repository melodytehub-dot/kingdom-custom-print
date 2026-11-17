# Page builder

The dashboard's **Page builder** tab builds standalone pages (land about-us,
campaigns, lookbooks) from sections, columns and blocks, then publishes each one
at its own address.

It is separate from **Homepage sections**, which edits the fixed homepage, and
from **Pages**, which is the older block list. All three keep working; a page
built in the new editor takes precedence if addresses ever collide, and the API
refuses to save an address another system already uses.

## What an owner can do

- Add sections, give them one to four columns, and add blocks: heading, text,
  image, button, questions and answers, spacer, divider.
- Add blocks by clicking the palette or dragging them into a column.
- Reorder and duplicate anything; undo and redo with the toolbar or
  `Ctrl`/`Cmd` + `Z` and `Ctrl`/`Cmd` + `Shift` + `Z`.
- Style each element: typography (size, weight, line height, letter spacing,
  alignment, colour), spacing (padding, margins, gaps), background, border and
  corner radius, maximum width, column width, vertical alignment, and image
  aspect ratio and fit.
- Override any of it per screen size. Desktop values are the base; tablet and
  mobile settings only replace the properties set on that screen.
- Save a draft, preview it privately, publish, hide, or delete the page.

## Architecture

| File | Role |
| --- | --- |
| `lib/builder/schema.ts` | The model and its validation. Sections, columns, widgets and styles; limits; strict parsing. |
| `lib/builder/styles.ts` | Compiles a layout into one stylesheet, including tablet and mobile rules. |
| `lib/builder/tree.ts` | Immutable insert, move, duplicate and remove operations used by the editor. |
| `lib/builder/store.ts` | Draft, publish, unpublish, delete; revision checks against concurrent sessions. |
| `components/builder/BuilderPageView.tsx` | The renderer shared by the published page, the editor canvas and the draft preview. |
| `components/admin/BuilderEditor.tsx` | The editor UI. |
| `app/api/admin/builder/route.ts` | Authenticated API. |
| `app/builder-preview/page.tsx` | Signed-in preview of the saved draft. |
| `app/[slug]/page.tsx` | Serves the published page before falling back to the older custom pages. |

Drafts and published snapshots live in `builder_pages` (`layout_json`,
`published_json`, `revision`). Publishing writes both in one statement, so a
visitor never sees a half-updated page. Every save and publish checks the
revision the editor loaded, so two admin sessions cannot overwrite each other.

## Responsive styles

Element rules are generated as CSS; nothing an owner types becomes raw CSS.
Breakpoints use **container queries** on `.builder-page`:

```css
@container kcp-page (max-width: 1024px) { /* tablet overrides */ }
@container kcp-page (max-width: 640px)  { /* mobile overrides */ }
```

On a published page the container is the viewport, so this behaves like a media
query. In the editor the same page is drawn at 1280, 820 or 390 px and scaled to
fit, so a desktop preview cannot be mistaken for a tablet one. Columns stack on
phones unless the owner sets a mobile width.

## Safety rules

- Text is plain text (newlines preserved); there is no HTML widget.
- Links must be internal (`/shop`), an anchor (`#faq`), `https://` or
  `mailto:`/`tel:`. `javascript:` and `http://` are rejected.
- Images must be an uploaded photo (`/api/product-media/<uuid>`) or a file under
  `/img/`.
- Colours must be six-digit hex; sizes are clamped to documented ranges.
- A page must have content before it can be published, and the address may not
  reuse a store route.
- Saving something the schema rejects fails loudly instead of silently dropping
  part of the layout.

If photos are ever stored somewhere new, add that source to
`referencedProductMedia()` in `lib/media-storage.ts` as well.

## Checks

```powershell
npm run qa-db                     # includes qa-builder-db
node scripts/qa-builder-db.mjs    # schema, tree, stylesheet, revisions
```

`qa-builder-db` covers rejected input (script links, bad colours, duplicate ids,
oversized styles), responsive style compilation, draft/revision conflicts,
publishing, unpublishing and deletion. It writes to a throwaway database.

## Applying the table

The table is additive and safe to create on a live database:

```powershell
npm run db:migrate        # local
npm run db:d1:schema      # production D1
```

## Not built yet

- Inline text editing inside the canvas (copy is edited in the right panel).
- Reusable saved templates, and editing the site header/footer.
- Global styles (body font, site-wide colours) as opposed to per-element styles.
- A separate mobile-only edit mode beyond the breakpoint override above.
