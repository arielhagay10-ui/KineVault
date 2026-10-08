# Kine app branding

The launcher icon uses a large close-up of the blue Kine mascot, with its cream
antenna tips, navy eyes, and smile. The supplied Duolingo icon guided the face
framing. The iOS splash reuses the exact supplied waving mascot, with a wordmark
set in Comfortaa 700. The app loads Comfortaa at 400/500/600
and uses Font Awesome 6 for UI icons. Launcher/splash branding is separate from
the nameless compact in-app top bar, whose right profile-picture slot is a
placeholder. The eleven in-app WebP poses stay in `../mascot/2d/`; their mappings
and responsive size limits are recorded in the [mascot guide](../mascot/README.md).

## Assets

| File | Use |
| --- | --- |
| `icon.png` | Opaque 1024px iOS icon and Android legacy icon; OS applies corners |
| `adaptive-foreground.png` | Transparent 1024px Android foreground with mask-safe inset |
| `adaptive-monochrome.png` | Android themed icon; eyes and smile are transparent cutouts |
| `favicon.png` | 48px web favicon |
| `splash-light.png` | Transparent 720px square iOS launch lockup with navy wordmark |
| `splash-dark.png` | Same layout with cream wordmark for dark mode |
| `splash-android.png` | Transparent 720px head mark for Android's square launch container |

[app.json](../../app.json) configures these assets. Splash backgrounds match the
app's existing light `#f6f7f9` and dark `#12171d` backgrounds. The Android adaptive background is
cream `#f8f2e3`. The head is exported within a 580px bounding box; its visible
pixels fit inside the 626px safe circle of a 1024px adaptive layer.
All three splash exports are square to match Expo's native image view.
The Android splash uses a separate head mark
to avoid clipping the tall wordmark inside the platform's launch icon container.

## Source and regeneration

The two PNGs in `source/` were generated with the built-in `image_gen` tool.
Exact prompts and reference roles are recorded in `prompts.json`. The waving
mascot comes from `../mascot/2d/source/kine-welcome.png`, which is byte-identical
to the user's uploaded `kine-welcome.png`.

To resize and export these source images, install ImageMagick and use the
project's installed Comfortaa 700 font. Run from `Application/` after `npm ci`:

```sh
node scripts/export-branding.mjs
```

The script only writes this directory's exported PNGs. It does not regenerate
artwork, call an API, or change mascot poses. Source PNGs are not referenced by
the app config or imported by application code.

Open `../../design/branding.html` through a local HTTP server for a visual review
of the actual exported assets at launcher sizes and in splash layouts.

## Native verification

Icon and native splash changes require a new native binary. Expo Go cannot show
the final native splash: verify the launch screen in an installed release build.
The [startup code](../../src/app/_layout.tsx) holds the splash until theme and
profile loading finish and font loading either succeeds or reports an error.
The root loads Comfortaa and Font Awesome 6 before rendering the normal app.
The splash artwork does not change daily layouts, the calendar, or logging
placeholders; those are documented in [DESIGN.md](../../DESIGN.md).

References: [Expo SDK 57 splash screen](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/)
and [Expo icons and splash guide](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).
