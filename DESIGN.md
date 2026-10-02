# KineVault design guide

Design reference for a companion app that should feel like part of KineVault.
Based on the working source on **30 September 2026**. Measurements assume a
16px root font size; preserve scalable text in implementation.

**Current** means implemented in this repository. **Companion guidance** means
a rule for extending the design where the website has no established pattern.
This guide describes the current working tree, including local changes.

## 1. Design identity

KineVault is an exercise encyclopedia centered on movement, anatomy, equipment,
and biomechanics. Its visual character is calm, precise, educational, and spacious.

- Use slate blue for actions, soft gray for the canvas, and white or dark slate panels.
- Let demonstrations and useful information dominate the screen.
- Establish hierarchy through typography, spacing, and borders before decoration.
- Keep advanced information accessible through progressive disclosure.
- Use real content and real counts. Make reviewed, private, and submitted content distinguishable.
- Avoid excessive gradients, neon accents, decorative charts, enormous dashboard tiles,
  fake statistics, and generic promotional SaaS layouts.

A companion may have different features. Preserve the palette, typography,
component treatment, content hierarchy, and interaction language.

## 2. Color tokens

Source of truth: [globals.css](src/app/globals.css).
Use semantic names in components; switch their values with the theme.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#f6f7f9` | `#12171d` | Page canvas |
| `foreground` | `#192026` | `#e5eaf0` | Main text |
| `card` | `#ffffff` | `#1a222b` | Cards, forms, toolbars |
| `card-foreground` | `#192026` | `#e5eaf0` | Text on cards |
| `popover` | `#ffffff` | `#1a222b` | Floating menus |
| `popover-foreground` | `#192026` | `#e5eaf0` | Menu text |
| `primary` | `#314e65` | `#94bdd7` | Main actions, links, selections |
| `primary-foreground` | `#ffffff` | `#10181f` | Text/icons on primary fill |
| `secondary` | `#e9edf1` | `#25313d` | Secondary action fill |
| `secondary-foreground` | `#314e65` | `#d7e6f2` | Secondary action text |
| `muted` | `#e9edf1` | `#25313d` | Media wells, subdued surfaces, tags |
| `muted-foreground` | `#52606d` | `#b0bdca` | Descriptions, labels, helper text |
| `accent` | `#e3ebf1` | `#253747` | Active annotations and subtle emphasis |
| `accent-foreground` | `#243f55` | `#d7e6f2` | Text on accent surfaces |
| `border` | `#ced6de` | `#3b4a59` | Dividers and outlines |
| `input` | `#ced6de` | `#3b4a59` | Input borders |
| `ring` | `#638ba6` | `#94bdd7` | Keyboard focus |
| `destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Destructive button and invalid states |

### Color application

- Main text uses `foreground`; descriptions use `muted-foreground`.
- Filled primary actions always pair `primary` with `primary-foreground`.
  Dark mode primary buttons have dark text on a pale blue fill.
- Standard borders are 1px. Avoid using a dark text color as a border.
- Common translucent surfaces: header `card/80`, feature card `card/80`,
  empty state `card/70`, canvas credit `card/90`, canvas instruction `card/95`.
- Editor selections also use `primary/10` with primary text; contextual panels
  use `primary/5` with an optional `primary/30` border.
- Opacity applies to the surface or token, not to the whole content group.
- Red muscle highlighting has anatomical meaning; do not turn it into a general brand accent.

### Feedback and review colors

Current feedback mixes semantic tokens with Tailwind red and amber utilities.

| Pattern | Current treatment |
| --- | --- |
| Inline error | `text-red-700 dark:text-red-300` |
| Form error panel | `bg-red-50 text-red-800`, sometimes `border-red-200` |
| Changed review row | `bg-amber-50 dark:bg-amber-950/30` |
| Changed-field label | `text-amber-800 dark:text-amber-200` plus the word “Different” |
| Notice/success message | Muted panel with primary text; often `role="status"` |
| Unread notification | Primary border and explicit “Unread” label |

**Companion guidance:** define theme-aware error and warning tokens from these
roles. Some current pale-red form alerts lack a dark override; treat that as an
implementation gap. There is no established green success palette or complete
color mapping for moderation statuses. Use written statuses; introduce additional
semantic colors only when needed, with both themes specified.

### Auxiliary tokens

These are configured by the UI scaffold; the current main screens do not establish
a chart system or a global sidebar built from these tokens. Preserve the values
when copying the full theme, but use the main palette for new product components.

| Token | Light | Dark |
| --- | --- | --- |
| `chart-1` | `oklch(0.87 0 0)` | Same |
| `chart-2` | `oklch(0.556 0 0)` | Same |
| `chart-3` | `oklch(0.439 0 0)` | Same |
| `chart-4` | `oklch(0.371 0 0)` | Same |
| `chart-5` | `oklch(0.269 0 0)` | Same |
| `sidebar` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| `sidebar-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `sidebar-primary` | `oklch(0.205 0 0)` | `oklch(0.488 0.243 264.376)` |
| `sidebar-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.985 0 0)` |
| `sidebar-accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| `sidebar-accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` |
| `sidebar-border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` |
| `sidebar-ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` |

## 3. Light, dark, and system appearance

Current behavior:

- Offer **System**, **Light**, and **Dark**. Default to System.
- Apply the theme to the root. Web uses the `.dark` class and matching `color-scheme`.
- Persist the explicit preference; the web cookie is `kv-theme`, valid for one year.
- System mode follows OS changes. Bootstrap appearance before first paint.
- A slim full-width appearance strip sits above page content: card background,
  bottom border, 24px horizontal / 8px vertical padding, 12px muted text.
- Its select uses a card fill, 8px radius, and 8px horizontal / 4px vertical padding.

**Companion guidance:** a native app can place Appearance in settings. Keep the
same three choices and persistence behavior. Theme all surfaces and controls;
switch semantic values rather than applying an inversion filter.

The 3D scene deliberately uses a fixed light studio background in both themes.
The surrounding controls follow the app theme.

## 4. Typography

Current font: **Geist**, loaded through `next/font/google`, Latin subset.
Headings and body share the same sans-serif family. There is no separate display font.

**Companion guidance:** bundle Geist when supported. Fallback to
`ui-sans-serif, system-ui, sans-serif`. Native platform fonts are a fallback when
Geist cannot be used; match weight, scale, and spacing as closely as possible.

| Role | Size / line height | Weight | Tracking |
| --- | --- | --- | --- |
| Wordmark | 20px / 28px | 700 | `-0.05em` |
| Home hero | 48px, 60px at `sm`, 72px at `xl`; line height `1.02` | 600 | `-0.065em` |
| Explore/detail/taxonomy title | 36px / 40px; 48px / 48px at `sm` | 600 | `-0.055em` |
| Library title | 36px / 40px | 600 | `-0.055em` |
| Auth title | 30px / 36px | 600 | `-0.05em` |
| Workshop title | 24px / 32px | 600 | Default |
| Panel title | 20px / 28px | 600 | Default |
| Card title | 18px / 28px | 600 | `-0.025em` (`tracking-tight`) |
| Intro paragraph | 18px / 32px | 400 | Default |
| Main body | 16px / 24px; instruction prose 28px line height | 400 | Default |
| UI label / button | 14px / 20px | 500–600 | Default |
| Card description | 14px / 24px | 400 | Default |
| Helper text | 12px / 16px or 20px | 400 | Default |
| Page eyebrow | 12px / 16px, uppercase | 700 | `0.18em`; home `0.2em` |
| Filter group heading | 12px / 16px, uppercase | 700 | `0.16em` |
| Card category | 12px / 16px, uppercase | 600 | `0.12em` |
| Detail taxonomy heading | 14px / 20px, uppercase | 600 | `0.1em` |

- Use sentence case for titles, labels, buttons, and descriptions.
- Reserve uppercase for short eyebrows, categories, and metadata group headings.
- Keep large titles tightly tracked; keep paragraph text normally tracked.
- Use tabular numerals for changing measurements, sensitivity, and timelines.
- Card descriptions truncate to two lines. Detail text and exercise names should wrap.
- Intro text generally stays within 512–768px; avoid edge-to-edge prose on wide screens.
- **Companion guidance:** start compact/mobile page titles around 28–36px and
  retain the hierarchy. Support text scaling without clipped controls or headings.

## 5. Spacing, dimensions, and shape

### Spacing

The underlying spacing step is 4px, with 2px intermediate values used for small controls.
Common values: **4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48, 64, 80px**.

| Relationship | Typical current spacing |
| --- | --- |
| Icon to label | 6–8px |
| Label to field | 8px |
| Eyebrow to title | 12px |
| Title to description | 12–20px |
| Compact control padding | 8–12px |
| Small contextual panel padding | 12–16px |
| Filter/card padding | 20px |
| Detail/form panel padding | 24px |
| Auth panel padding | 28px; 36px at `sm` |
| Grid/card gap | 16–20px |
| Form field grid gap | 20px |
| Content section separation | 24–40px |
| Filter sidebar to results | 32px |
| Detail column gap | 40px |
| Home hero column gap | 48px; 64px at `lg` |
| Page bottom padding | Usually 80px |

### Radius tokens — use these values, not Tailwind defaults

`globals.css` overrides Tailwind's named radius scale. Base `--radius` is
`0.625rem` (10px); the component classes resolve as follows:

| Token / class | Formula | At 16px root | Typical use |
| --- | --- | --- | --- |
| `radius-sm` / `rounded-sm` | Base × 0.6 | 6px | Small detail |
| `radius-md` / `rounded-md` | Base × 0.8 | 8px | Small selects |
| `radius-lg` / `rounded-lg` | Base | 10px | Toolbar buttons, notices |
| `radius-xl` / `rounded-xl` | Base × 1.4 | 14px | Fields, standalone actions |
| `radius-2xl` / `rounded-2xl` | Base × 1.8 | 18px | Cards, panels, media |
| `radius-3xl` / `rounded-3xl` | Base × 2.2 | 22px | Auth and large empty states |
| `radius-4xl` / `rounded-4xl` | Base × 2.6 | 26px | Available; no central pattern |
| `rounded-full` | Full pill | Pill/circle | Tags, family badge, home nav action |

Media clips to the parent radius. Avoid sharp inner images inside rounded cards.

### Depth

- Default panels are flat: fill + 1px border.
- Auth uses `shadow-sm`; floating equipment menu uses `shadow-lg`.
- Exercise-card hover adds `shadow-lg shadow-black/5` and a 2px upward translation.
- Private-card hover uses `shadow-md`.
- Use shadows to clarify hover or elevation, not on every nested panel.
- No established blur/glass treatment or background gradient is required.

## 6. Responsive layout and app shell

Current Tailwind viewport breakpoints: `sm` 640px, `md` 768px, `lg` 1024px,
`xl` 1280px, `2xl` 1536px. Main layout changes use `sm`, `lg`, and `xl`.

| Screen/container | Current maximum width | Gutters |
| --- | --- | --- |
| Home, Explore, detail, taxonomy, admin | 1280px (`max-w-7xl`) | Usually 24px; public pages 40px at `lg` |
| Account/library | 1024px (`max-w-5xl`) | 24px |
| Notices and simple error content | 768px (`max-w-3xl`) | 24px |
| Auth | 448px (`max-w-md`) | 24px page padding |
| New workshop | 1600px | 16px; 24px at `sm` |
| Existing workshop | 1700px | 16px; 24px at `sm` |

Maximum width includes container padding. Use centered containers and
`minmax(0, 1fr)` / `min-width: 0` where columns contain text, media, or controls.

### Navigation

- Public content header: wordmark left, contextual navigation right,
  card/80 fill, bottom border, 20px vertical padding.
- Home header: no enclosing panel; 28px vertical padding, logo tile + wordmark,
  “My library” link and outlined pill “Explore exercises”.
- Account header: wordmark left, sign-out right, bottom divider.
- Detail pages offer a back link with a 16px left-arrow icon.
- Admin header wraps its text navigation and labels the area “Review”.
- Headers are not globally sticky. Sticky behavior is used for filters and the workshop preview.
- The repository has no established persistent bottom navigation, app-wide sidebar,
  generic modal system, or tab bar.

**Companion guidance:** use a compact top bar with a clear title/back action.
If persistent native navigation is needed, use a small set of labeled destinations
from the companion's actual features. Reuse Lucide outline icons, primary active
color, muted inactive text, card surface, and a 1px divider. Respect safe areas.

## 7. Brand and icons

Current home mark is the **Lucide Orbit** icon, not a custom image logo:

- Tile: 40 × 40px, 14px radius, primary fill, primary-foreground icon.
- Orbit: 23px, stroke width 1.7.
- Gap to wordmark: 12px. Wordmark text: **KineVault**.
- Most interior pages use the wordmark alone.

Icon family: **Lucide** (`lucide-react` on web). Use consistent outlined icons.
Typical sizes: 14–18px in controls, 20–22px in feature panels, 30–42px in empty/media states.
Use the library's normal stroke unless a specific existing element overrides it.
The missing-poster Dumbbell icon is 42px with a thin 1.2 stroke.

Useful existing meanings: Search = search, SlidersHorizontal = filters,
Heart = favorite, Plus = add, ArrowLeft = back, ArrowRight = continue,
ArrowUpRight = explore, ShieldCheck = reviewed knowledge, Play/Pause = playback.

Decorative icons should be hidden from assistive technology. Icon-only controls
need an accessible name. Do not rely on tooltips to convey essential actions.
Use the companion's own name while keeping this visual treatment.

## 8. Buttons and action hierarchy

Current shared [Button](src/components/ui/button.tsx) and page-specific buttons
have two densities. Do not assume every current button uses the shared primitive.

| Kind | Surface/text | Shape and treatment |
| --- | --- | --- |
| Primary | Primary / primary-foreground | Filled; one clear main action per action group |
| Outline | Background + border / foreground | Muted hover; shared dark variant uses input/30 fill |
| Secondary | Secondary / secondary-foreground | Soft fill; subtle color-mix hover |
| Ghost | Transparent / inherited text | Muted hover; useful for low-priority tools |
| Destructive | Destructive/10 + destructive text | Destructive/20 hover; dark fill 20% / hover 30% |
| Text link | Primary | Underline on hover; 4px underline offset in primitive |

Shared primitive: 14px medium text, 10px radius, 32px default height,
10px horizontal padding, 6px icon gap, 16px default SVG.
Sizes: `xs` 24px, `sm` 28px, default 32px, `lg` 36px; square icon versions match.
`xs` text/icons are 12px; `sm` text is 12.8px with 14px icons.

Standalone page actions usually use 14px semibold text, 14px radius,
16–24px horizontal and 10–12px vertical padding. Use this roomier treatment for
form submission and major navigation.

States:

- Shared primary hover uses `primary/80`; some page buttons retain their fill.
- Shared buttons transition and move down 1px when pressed, except popup triggers.
- Disabled primitive: 50% opacity and no pointer events. Page form buttons often use 60%.
- Pending actions display a verb: “Saving…”, “Creating…”, or “Working…”.
- Toggles use `aria-pressed`; disclosure triggers use `aria-expanded`.
- Saved favorite fills the Heart and changes text to “Saved”.
- Selected camera view uses primary fill; selected editor tools often use primary/10.

**Companion guidance:** touch hit areas should be at least 44 × 44px even when the
visible compact button is smaller. Keep desktop density out of primary mobile actions.
Separate destructive actions spatially and state their consequence before confirmation.

## 9. Fields, selectors, and disclosures

- Labels above controls: 14px semibold, typically 8px gap.
- Main inputs/textareas: full width, 1px border, 14px radius,
  16px horizontal / 12px vertical padding; foreground text on a themed surface.
- Filter controls: background fill, 12px horizontal / 10px vertical padding, 14px text.
- Search field: leading 17px Search icon at 12px inset, 40px left padding;
  placeholder “Name or alias”.
- Input focus: primary border and 2px ring in addition to the global visible outline.
- Checkboxes/range controls use primary accent; checkbox + label has an 8px gap.
- Role selects beside taxonomy choices are compact, 112px wide, 12px text.
- Helpers sit under the field, use muted 12px text, and explain uncertainty or requirements.
- Use actual labels, not placeholder-only labeling. Required/optional fields must be understandable.
- Forms use 20px gaps in two-column groups; collapse to one column on narrower screens.
- Multi-choice taxonomy fields use bordered scroll areas, usually max-height 192px.
- Use native selects and `details`/`summary` where sufficient; custom UI is not required to match.
- Advanced classifications, timeline settings, and editor numeric controls start collapsed.
- Preserve entered values on validation failures. Keep error text near its relevant action/field.

## 10. Cards, tags, and structured data

### Exercise card

```text
┌──────────────────────────────┐
│ Demonstration poster (4:3)    │
├──────────────────────────────┤
│ FAMILY                       │
│ Exercise name                │
│ Short description, two lines │
└──────────────────────────────┘
```

- Entire card is one link: card fill, 1px border, 18px radius, clipped media.
- Media: 4:3 well, muted fill, `object-contain` to preserve full figure/equipment.
- Body: 20px padding; category → title → description gaps are 8px.
- Hover: 2px lift, restrained shadow, title turns primary.
- Grid: one column → two at `sm` → three at `xl`; 16px gaps.
- First three poster images load eagerly; remaining posters load lazily.
- Missing poster uses the thin Dumbbell glyph, not a broken image or invented demo.

### Panels and tags

- Information/form panels: card fill, 1px border, 18px radius, 24px padding.
- Tags: full pill, muted fill, primary text, 14px type,
  12px horizontal / 6px vertical padding; wrap with 8px gaps.
- Taxonomy links look like tags; non-link tags may look similar, but only real links navigate.
- Family badge is semibold; ordinary taxonomy tags are regular or medium.
- Biomechanics use a definition list: muted label above semibold primary value,
  4px label/value gap, two columns, 20px grid gaps.
- Unknown values read “Not classified” or “Unknown”; do not display raw enum strings.
- Instruction sections use a compact uppercase subheading and readable multiline prose.

## 11. Page composition recipes

### Home

Header → two-column hero at `lg` → explanatory copy left, motion study right.
Column proportions are **0.83 : 1.17**. Intro uses a primary eyebrow with an 8px dot,
large tight heading, muted 18px paragraph, two small feature panels, and a text CTA.
Stack the hero on smaller screens. Demonstration remains the main visual asset.

### Explore

```text
Appearance strip
Brand header                         My library
Eyebrow / title / short explanation
┌── 285px filters ──┐  ┌── result count / active count ───┐
│ Search            │  │ Exercise cards                  │
│ Anatomy           │  │ 1 / 2 / 3 columns by viewport   │
│ Movement          │  │                                 │
│ Equipment         │  │ Next page                       │
│ Biomechanics      │  └─────────────────────────────────┘
│ Other / sort      │
│ Apply filters     │
└───────────────────┘
```

- Content starts 48px below its header; intro has 40px bottom separation.
- Desktop grid: `285px minmax(0,1fr)`, 32px gap; filter panel sticks 24px from top.
- Filter panel: 18px radius, 20px padding, group dividers, uppercase group headings.
- Disclosure sections have 16px vertical padding; selected groups open by default.
  Joint actions start open; their list max-height is 256px versus 192px for other groups.
- Sort choices: Alphabetical, Newest, Most favorited. End with full-width Apply filters.
- Every selected value must match, including values inside the same group.
- Filters are applied explicitly; query parameters preserve and share the search.
- Show the actual current-page count, not an unqueried total. Current page size is 24.
- On mobile the sidebar becomes an **inline collapsible panel**, initially hidden,
  with full-width “Show filters” / “Hide filters” and active count. It is not a modal drawer.
- Clear all and Reset search return to unfiltered Explore; pagination preserves applied filters.

### Exercise detail

Desktop: back link → columns **1.15 : 0.85** with 40px gap.
Left: large demonstration, optional 3D inspector, instructions.
Right: eyebrow, exercise title, description, family, aliases, save/copy actions,
anatomy/equipment panel, biomechanics panel, and related exercise links.

Metadata stays grouped: primary muscles, secondary muscles, stabilizers, joints,
joint actions, equipment, attachments, movement patterns. Do not merge these categories.
Clickable muscles, joints, actions, equipment, and family link to exploration pages.
Relationship labels explain whether a movement is a parent, variation, easier, or harder.

Current mobile DOM order places media/instructions before the right-column title.
**Companion guidance:** put identity and back navigation before the demonstration
on a native detail screen, then actions and grouped information. Preserve the content hierarchy.

### Taxonomy and joint-action pages

Use the public width and title treatment, a short educational definition, and
exercise cards. Link to full Explore with the category already selected.
Joint-action pages add a 285px filter panel for equipment, muscles, resistance
profile, body position, and difficulty. Current joint-action filters stack inline
on small screens without Explore's hide/show wrapper.

### Account and private library

Use 1024px width and simple navigation. Show two medium panels for private exercises
and favorites, real counts, then saved exercise links. Private drafts use a two-column
grid from `sm`, textual cards, explicit “Private draft”, and “Open workshop”.
Use role-specific review navigation only where available.

### Authentication

Centered 448px container, wordmark above a 22px-radius bordered card with a subtle
shadow. Compact eyebrow, 30px heading, vertically stacked fields, full-width
primary submit action, and small account/password links below. Pending and error
feedback stay inside the form. No decorative illustration is required.

### Exercise creation and sharing

Current flow starts with the movement workshop. “Save & add details” opens metadata
after the private draft is created. Details group exercise basics, anatomy,
optional detailed classifications/instructions, and equipment/resistance.
Use “Save privately” for the metadata action.

Sharing gets its own panel: explain view access, display active-link state,
offer create/replace/revoke, then a copyable link after creation. Confirmation
for revocation explains loss of access. Private content does not become reviewed
public catalog content through sharing.

### Moderation and notifications

Review uses the same visual language with denser controls. Comparisons are
bordered panels with a muted table header, 16px cells, and 1px row dividers.
Changed rows use amber plus “Different”; comparison columns remain readable.
The current comparison table has a 540px minimum width in its own horizontal scroller.

Decisions use explicit labels: begin review, approve, request changes, reject,
merge, and retry failed render. Reasons and comments are visible in the decision form.
Notifications are compact bordered cards; unread items use a primary border and text label.
**Companion guidance:** on narrow screens, stack comparisons by field when practical.
Keep any table overflow inside its panel rather than making the page scroll sideways.

## 12. Demonstrations, anatomy, and 3D style

### Video gallery

- 4:3 container, 18px radius, muted well, full-size `object-contain` video.
- WebM first, MP4 fallback, poster while loading; preload metadata.
- Playback is muted, looping, inline, with controls. Autoplay is allowed when
  reduced motion is not requested; reduced motion pauses autoplay.
- Show Character / Camera angle selectors only when multiple choices exist.
- Keep the current presentation and angle readable, with source credit underneath.
- Movement notes list label, time interval, optional explanation and joint-action link.
  Active notes use accent fill; choosing a note seeks to its time.
- Show an explicit unavailable/failed state when media cannot load.
- Do not use GIF as the primary exercise demonstration format.

### Anatomy palette

These are fixed model/studio colors, separate from app theme tokens.

| Element | Current color |
| --- | --- |
| Studio background | `#f7f8f8` |
| Unselected muscles | `#8e9994` |
| Skeleton | `#ddd8cb` |
| Highlighted muscles | `#c33d36` |
| Dark equipment/plates/pads | `#263b3b` |
| Equipment metal | `#778b8b`, `#627479`, `#516768` |
| Cable details | `#43565a`, `#34484b`, `#879994` |
| Adjustable bench steel / hardware | `#d1d7d7` / `#718082` |
| Adjustable bench pad / rubber | `#202526` / `#101718` |
| Joint markers | `#2b9891`, 85% opacity |
| Selected joint marker | `#f59e0b`, 85% opacity |
| Editor grid major/minor | `#adbfc0` / `#dce5e5` |

Anatomy material roughness is 0.8: matte, subdued, with red selection clearly visible.
Lighting combines white/gray-green hemisphere light, warm key `#fff4e7`, and
cool fill `#dce9f8`. Perspective field of view is 34°. Frame the whole exercise,
including equipment and limbs at movement extremes; avoid cropping the demonstration.

Viewer controls: Front, Three-quarter, Side, Back; searchable muscle/group
selection; optional “Show selected only”; count/status text. Camera choices wrap.
Selected anatomy must also be named in text so red is not its only indicator.
Shared 3D studies begin paused, have Play/Pause and a scrubber, and pause when scrubbing.
Current shared viewer canvas is 400px tall, 500px at `sm`; default canvas is 430px.

Z-Anatomy and BodyParts3D attribution appears on the canvas and in supporting text;
rendered media includes its own credit overlay. If reusing those assets, carry over
the attribution and source license files in [public/models/z-anatomy](public/models/z-anatomy/ATTRIBUTION.md).
The UI style itself does not require copying those models. Pose studies should be
described as illustrations, not measured joint angles or motion-capture recordings.

## 13. Workshop layout and interaction

The workshop is a tool surface, with compact typography and progressive disclosure.

```text
Back link / exercise name / one-line instruction
┌── wrapping toolbar: Add, pose, undo/redo, sensitivity, save ─┐
│ Large preview                    │ 280px controls          │
│ Camera + highlight controls      │ Scene objects           │
│ Optional animation/timeline       │ Selected object/joint   │
│                                  │ Optional advanced tools │
├── save/interaction status ────────┴── camera hint ──────────┤
└────────────────────────────────────────────────────────────┘
```

- Shell: card fill, 18px radius, 1px border; toolbar padding 12px, 8px gaps.
- Tool buttons: 10px radius, 1px border, 12px semibold text, 8px icon gap,
  12px horizontal / 8px vertical padding; disabled opacity 40%.
- Compact editor fields: 10px radius, 8px padding, 14px regular text,
  background fill; numeric joint fields are 64px wide.
- Desktop: flexible preview + 280px control column; preview padding 12px;
  control column padding 16px and left divider.
- Preview is sticky at 12px on desktop, 0px on mobile; controls scroll independently.
- Canvas height: mobile `clamp(220px,35dvh,360px)`;
  desktop `clamp(260px,calc(100dvh - 460px),620px)`.
- Controls max-height: mobile `55dvh`; desktop `calc(100dvh - 240px)`.
- Mobile stacks preview above controls with a top divider.
- Preview instruction overlay uses card/95, 12px type, and ignores pointer events.
- Footer: minimum 40px height, top border, 12px muted text, live status and camera hint.
- Preview layer is `z-10`; floating equipment menu is `z-20`.

Make direct manipulation understandable: select an object, drag to move, use labeled
Move/Rotate/Up/Down controls, or choose a body joint. Provide sliders and numeric
alternatives for precision. Keep selected object and joint names visible.

Current sensitivity defaults to 35%, is adjustable, and persists in the browser.
Undo/redo are available; incompatible controls disable during dragging or saving.
Held equipment explains why arm posing is paused and offers a release action.
Grip choices use plain language: Palm up, Neutral, Palm down.

Animation is optional. Show start/end/intermediate keyframes and readable seconds;
selected keyframe uses primary/10. Equipment animation has its own explicit toggle.
Keep numeric transforms, snapping, resizing, and detailed settings under Advanced settings.

**Companion guidance:** preserve a useful preview when the keyboard opens; account
for small screens and safe areas. A complex editor may need a dedicated screen.
Keep common interactions visible and advanced ones expandable.

## 14. Motion and interaction feedback

Current motion is restrained: button transitions, a 1px press displacement,
2px card hover lift, video loops, and user-controlled 3D playback.

- Global keyboard focus: **2px ring-colored outline, 3px offset**.
- Shared button focus additionally uses a 3px ring at 50% ring color.
- Reduced-motion CSS sets transition/animation duration to 0.01ms and disables
  smooth scrolling. Video respects reduced motion; 3D viewers start paused.
- Do not add automatic camera spins, bouncing panels, or decorative movement.
- **Companion guidance:** if custom transitions are needed, use brief 120–180ms
  ease-out feedback. This is a proposed timing range, not a custom current token.
- Show completion near the initiating action; avoid silent save/copy operations.

## 15. Loading, empty, error, and confirmation states

| State | Design |
| --- | --- |
| Loading | Concise muted text in the relevant region: “Loading motion study…” / “Loading body…” |
| Saving | Disable the affected action, show “Saving…”, announce busy/status where appropriate |
| No search matches | Large dashed bordered panel; icon, short title, muted explanation, Reset search |
| Catalog awaiting demos | Same quiet empty panel; “Demonstrations are being prepared” |
| Empty private library | Dashed card, explanation, Create one action |
| Missing demonstration | Muted rounded panel with “Demonstration unavailable.” |
| Model load failure | Clear message and Retry model button |
| WebGL unavailable | Text fallback explaining the browser requirement |
| Request failure | Local alert with a useful next action; preserve context and input |
| Irreversible/revocation action | Confirm the specific consequence; current sharing uses browser confirmation |

Explore's main empty state has a 320px minimum height, 22px radius, centered
content, 30px icon, 20px heading, and 14px explanation with a roughly 384px max width.
Do not replace missing information with fabricated illustrations, counts, or classifications.

**Companion guidance:** there is no established skeleton, toast, dialog, or offline
component. If adding one, use the same surfaces, borders, type, and radius scale.
Skeletons should mirror content without shimmer under reduced motion. Offline states
should distinguish cached content from an action that has not been saved/sent.

## 16. Accessibility and small details

Current foundations include semantic forms, fieldsets, labels, focus-visible
outlines, a skip-to-content link, expanded/pressed states, live status text,
reduced-motion support, and responsive layouts.

**Companion guidance / acceptance targets:**

- Aim for WCAG AA text contrast: 4.5:1 normal text and 3:1 large text;
  assess meaningful controls and focus indicators against adjacent surfaces.
- Do not claim compliance from the palette alone. Test actual text, opacity,
  imagery, field states, and both themes.
- Preserve a visible keyboard focus indicator and a logical reading/tab order.
- Expand small touch targets to at least 44px. Hover must not be needed to discover an action.
- Pair status colors with text, icons, or explicit selection state.
- Use heading levels in order, one main page title, and named navigation regions.
- Use alerts for failures and polite status announcements for saves, copies, counts,
  and selected anatomy. Avoid announcing every playback frame.
- If adding a modal/sheet, label it, manage focus, support dismissal, and restore focus.
- Wrap long names and tags. Let secondary descriptions truncate only where intentional.
- Keep page-wide horizontal scrolling absent; scope necessary table scrolling locally.
- Respect text scaling, keyboard visibility, device safe areas, and reduced motion.
- Current language is English and LTR; no RTL design is established. If localizing,
  use logical spacing and mirror directional navigation icons appropriately.
- Dates and numbers should be readable and localized; do not expose database enum syntax.

## 17. Copy and information rules

- Use short, concrete verbs: Explore, Apply filters, Save privately, Copy link,
  Inspect motion in 3D, Save & add details.
- Explain the purpose of a control beside it, especially grip, uncertainty,
  resistance profile, publication, and access permissions.
- Keep muscles, joints, joint actions, movement patterns, families, and equipment
  distinct in labels and UI groups.
- “Reviewed” describes catalog approval. “Private draft” describes owner content.
  A share link grants viewing, and a submission enters review; neither implies publication.
- “Unknown” is valid information. Do not imply that classification is certain by default.
- Avoid medical or rehabilitation claims. Demonstrations and explanations are educational.
- Explain failures in user terms. Keep storage buckets, schema keys, render-worker
  internals, and other implementation details out of ordinary user flows.

## 18. Companion implementation handoff

For a matching app, implement in this order:

1. Copy the semantic palette into light/dark theme objects and add System preference.
2. Install/bundle Geist and the Lucide icon family for the chosen platform.
3. Define spacing and the overridden radius scale from this guide.
4. Build primitives: text, panel, button, field, tag, divider, disclosure, feedback.
5. Build exercise cards and a 4:3 demonstration component.
6. Build page shells for browsing, detail, forms, and account screens.
7. Adapt navigation and hit targets to the platform while preserving visual hierarchy.
8. Verify real screens in both themes, with long content, empty data, failures, and large text.

Suggested portable names, mapped to current values:

```ts
// Companion guidance: names for a portable design-token layer.
const geometry = {
  spacingUnit: 4,
  radius: { sm: 6, md: 8, lg: 10, xl: 14, panel: 18, largePanel: 22 },
  borderWidth: 1,
  focus: { width: 2, offset: 3 },
  mediaAspectRatio: 4 / 3,
  contentMaxWidth: 1280,
  accountMaxWidth: 1024,
  filterWidth: 285,
  workshopControlsWidth: 280,
};
```

These names are proposed; the palette table contains the exact current color values.
Native dimension units should preserve the same proportions, not literal device pixels.
Do not depend on Next.js, Supabase, or Tailwind to reproduce the visual design.

### Quick visual acceptance checklist

- [ ] Slate blue primary actions; correct light and dark foreground pairings.
- [ ] Geist or a deliberately matched fallback; restrained uppercase labels.
- [ ] Correct 14px field / 18px panel radius, rather than default Tailwind radii.
- [ ] Flat bordered panels with selective shadows and consistent spacing.
- [ ] Large, contained demonstrations; figure and equipment remain in frame.
- [ ] Clear page title, one main action per action group, grouped metadata.
- [ ] Responsive cards and filters; no accidental page overflow.
- [ ] Explicit private/reviewed/unknown states; accurate counts and working feedback.
- [ ] Keyboard focus, adequate touch areas, readable scaled text, reduced motion.
- [ ] Credits accompany any reused anatomy/media assets.

For side-by-side review, use Home, Explore, a populated exercise detail, authentication,
and the workshop. Check mobile around **390 × 844** (the existing appearance-test
viewport), desktop around 1440px, and widths immediately around layout breakpoints.

## 19. Source map and maintenance

| Design area | Reference |
| --- | --- |
| Colors, radius, base focus/reduced motion | [globals.css](src/app/globals.css) |
| Font and initial theme | [layout.tsx](src/app/layout.tsx) |
| Appearance strip and persistence | [theme-control.tsx](src/components/theme-control.tsx) |
| Shared button variants and sizes | [button.tsx](src/components/ui/button.tsx) |
| Brand and hero | [Home](src/app/page.tsx) |
| Search layout and filters | [Explore](src/app/exercises/page.tsx), [FilterSection](src/components/catalog/filter-section.tsx), [MobileFilters](src/components/catalog/mobile-filters.tsx) |
| Card layout | [ExerciseCards](src/components/catalog/exercise-cards.tsx) |
| Detail structure and tags | [Exercise detail](src/app/exercises/[slug]/page.tsx) |
| Video, selectors, and timed notes | [MediaGallery](src/components/catalog/media-gallery.tsx) |
| Taxonomy layouts | [TaxonomyLanding](src/components/catalog/taxonomy-landing.tsx), [Joint action](src/app/joint-actions/[slug]/page.tsx) |
| Authentication | [AuthForm](src/components/auth/auth-form.tsx) |
| Private form and advanced fields | [PrivateExerciseForm](src/components/private-exercises/private-exercise-form.tsx), [AdvancedPrivateFields](src/components/private-exercises/advanced-fields.tsx) |
| Share controls | [SharePanel](src/components/private-exercises/share-panel.tsx) |
| 3D viewer and playback | [MotionCanvas](src/components/character/motion-canvas.tsx), [SharedMotion](src/components/character/shared-motion.tsx) |
| Anatomy colors and highlighting | [anatomy.ts](src/lib/motion/anatomy.ts), [AnatomyControls](src/components/character/anatomy-controls.tsx) |
| Workshop structure and direct manipulation | [MotionWorkshop](src/components/character/motion-workshop.tsx), [StudioControls](src/components/character/studio-controls.tsx) |
| Review comparisons and actions | [ReviewComparison](src/components/moderation/review-comparison.tsx), [ReviewDecisions](src/components/moderation/review-decisions.tsx) |
| UI scaffold configuration | [components.json](components.json) — Radix Nova, neutral base, CSS variables, Lucide |
| Existing theme/mobile verification | [appearance.spec.ts](tests/e2e/appearance.spec.ts) |
| Product intent | [SPEC.md](SPEC.md), DESIGN and FILTER UI sections |

When shared tokens or major components change, update this guide in the same change.
For exact current implementation, source files take precedence over an outdated guide.
Keep companion additions explicitly labeled until adopted as shared product rules.
