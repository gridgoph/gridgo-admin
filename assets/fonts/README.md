# Fonts

| Family | Cuts here | Used for | Status |
|---|---|---|---|
| Satoshi | Regular, Medium, Bold, Black | All UI | Installed |
| Poppins | ExtraBold | Brand display | Not licensed yet |
| Instrument Serif | Regular | Rare decorative text | Not licensed yet |

Satoshi is licensed under the Fontshare Free EULA (`Satoshi-LICENSE.txt`,
Indian Type Foundry). It grants commercial use in mobile apps at no cost, and
it forbids redistributing the font files themselves. Shipping them inside the
app binary is fine; if this repository ever becomes public, check that clause
before pushing the `.otf` files.

Italics and the Light cut are not bundled — nothing in the type scale asks for
them. Only the variable font ships as TTF, and React Native cannot reliably
select a weight from a variable font, so the static OTF cuts are used instead.

`--font-brand` points at Satoshi-Black until Poppins ExtraBold is licensed.
Instrument Serif has no stand-in.

## Adding a family

1. Copy the files into this folder.
2. Register each cut in `constants/fonts.ts` under the name you want to use.
3. Add a matching `--font-*` entry in `global.css`.

All three steps or none. Registering a file nothing references loads a font
for no reason; naming a family in CSS before its file is registered renders
blank text on Android.
