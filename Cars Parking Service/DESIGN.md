---
name: Cars Parking Service
description: Valet operations for Medellín, read like a metro map. Every car sits at a station on its line.
colors:
  rojo: "#d32f2f"
  rojo-700: "#b71c1c"
  rojo-100: "#f9d6d6"
  rojo-50: "#fdeeee"
  tinta: "#14161a"
  tinta-2: "#353a42"
  gris: "#5a6069"
  gris-2: "#858b94"
  linea: "#e4e7eb"
  linea-2: "#d2d7dd"
  suelo: "#f3f4f6"
  panel: "#ffffff"
  placa: "#ffd54f"
  placa-borde: "#1f2329"
  ok: "#157f3b"
  ok-50: "#e8f5ec"
  aviso: "#a8530b"
  aviso-50: "#fdf3e6"
  info: "#1e4fd8"
  info-50: "#eaf0fd"
typography:
  display:
    fontFamily: "Overpass, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Overpass, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 800
    lineHeight: 1.2
  body:
    fontFamily: "Overpass, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
  body-sm:
    fontFamily: "Overpass, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "Overpass, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    lineHeight: 1.4
    letterSpacing: "0.08em"
  plate:
    fontFamily: "Overpass, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0.12em"
    fontFeature: "\"tnum\" 1"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
  pill: "999px"
  plate: "6px"
spacing:
  xs: "6px"
  sm: "8px"
  gap: "10px"
  md: "12px"
  card: "14px"
  page: "16px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.rojo}"
    textColor: "{colors.panel}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.rojo-700}"
    textColor: "{colors.panel}"
  button-ink:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.panel}"
    rounded: "{rounded.md}"
    height: "44px"
    width: "44px"
  button-outline:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "50px"
  button-outline-hover:
    backgroundColor: "{colors.suelo}"
    textColor: "{colors.tinta}"
  input-field:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "48px"
  plate-search:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "54px"
  plate-token:
    backgroundColor: "{colors.placa}"
    textColor: "{colors.tinta}"
    typography: "{typography.plate}"
    rounded: "{rounded.plate}"
  car-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.lg}"
    padding: "12px 12px 12px 14px"
  chip-state:
    backgroundColor: "{colors.suelo}"
    textColor: "{colors.tinta-2}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px 3px"
  chip-solicitado:
    backgroundColor: "{colors.rojo}"
    textColor: "{colors.panel}"
    rounded: "{rounded.pill}"
  chip-parqueado:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.gris}"
    rounded: "{rounded.pill}"
  nav-item:
    textColor: "{colors.gris}"
    height: "64px"
  nav-item-active:
    textColor: "{colors.rojo-700}"
  sheet:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.xl}"
---

# Design System: Cars Parking Service

## Overview

**Creative North Star: "The Metro Line"**

Every car lives on a line. The app reads like Medellín Metro wayfinding: each vehicle sits at one station of a five-stop line (Recibido → Parqueado → Solicitado → Despachado → Pagado), and every screen answers one question first: where is this car on its line? The shell is signage. White panels sit on a cool pale-grey ground, the ink is near-black, hairlines separate things, and there is exactly one line colour, the institutional red.

The system is built for a valet on the street, one-handed, by day and at night, with several cars arriving at once. Density is moderate and thumb-first: 44px minimum targets, a fixed bottom bar, a sticky primary action, and every car card with the same anatomy so states compare at a glance. Rank comes from weight, not size. The type scale is short and nearly everything important is set at 800.

It rejects the category default: a side drawer, grids of coloured pill badges, and a hero-number dashboard. State is shown as a position on the line and a mark in a fixed cell, never as a field of colour.

**Key Characteristics:**
- One line colour (red) reserved for action, the current station, attention and selection.
- The yellow Colombian plate is every car's token, in exactly three sizes.
- Station dots: filled ink for passed, a red ring for current, hollow for ahead.
- Overpass throughout, with tabular numerals for plates, times and money.
- Flat white panels with a whisper of shadow; depth is reserved for things that float over the list.
- Quick ease-out motion, a press scale of 0.97, and reduced motion respected everywhere.

## Colors

Signage black on white, one institutional red line, and a yellow plate. Everything else is grey and stays quiet.

### Primary
- **Línea Red** (rojo): the only line colour. Primary actions (Nuevo ingreso, Ingresar, Tomar vehículo), the current station ring, the solicitado state, the active nav dot, focus outlines, caret, checkbox accent and the field focus border.
- **Deep Línea Red** (rojo-700): hover and pressed state of red actions, the active nav label, the solicitado station name, destructive text (Salir) and error text.
- **Station Halo** (rojo-100) and **Faint Halo** (rojo-50): the soft rings around a red dot (current station, solicitado pulse), text selection, and the error-credentials banner. Never a card fill.

### Secondary
- **Plate Yellow** (placa) with **Plate Rim** (placa-borde): the Colombian plate token and the plate input on Nuevo ingreso. Used for nothing else.

### Tertiary (status, only where it means something)
- **Done Green** (ok, ok-50): finalizado and paid chips, a finished mini-line, success.
- **Notice Amber** (aviso, aviso-50): the pending-liquidación notice on the home screen.
- **Info Blue** (info, info-50): available for informational notices; rarely used.

### Neutral
- **Signage Ink** (tinta): all primary text, passed station dots, the ink action buttons (Cobrar, foto, parquear, despachar), the avatar, the liquidación total.
- **Ink 2** (tinta-2): labels, secondary icons, zone pill text.
- **Wayfinding Grey** (gris): secondary text (6.2:1 on white), inactive nav, table headers, parqueado chip.
- **Light Grey** (gris-2): icons, chevrons and large text only. Never body copy.
- **Hairline** (linea): card borders, row dividers, top bar and nav borders.
- **Field Rim** (linea-2): input borders, hollow station dots, the line track, outline buttons.
- **Ground** (suelo): the app background, hover fills, neutral chips.
- **Panel** (panel): cards, sheets, bars, inputs.

### Named Rules
**The One Line Rule.** Red marks action, the current station, attention (solicitado) and selection. It never paints a field, a section title or a decorative surface. If a red element does not move a car or mark where it is, it is the wrong colour.

**The Quiet Majority Rule.** Parqueado is the most common state, so it is the quietest: a white chip with a grey rim and grey text. Strength rises with the need to act; solicitado is solid red.

**The Token Colours Only Rule.** New views take colours from the tokens on `:root` in `cps.css`. They never declare their own hex values.

## Typography

**Display Font:** Overpass (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif)
**Body Font:** Overpass
**Label/Mono Font:** Overpass with tabular numerals

**Character:** One family descended from road signage, used across weights 400 to 900. It reads like a station sign: heavy, open and plain.

### Hierarchy
- **Display** (800, 28px, 1.1, -0.03em): page and greeting titles (Hola, Bea; Ingresos; Nuevo ingreso). It drops to 26px on phones for work pages.
- **Title** (800, 18px, 1.2): card titles such as "La línea de hoy" and the user name in the Más sheet.
- **Body** (600 to 700, 16px): buttons, list links and fields. Fields never go below 16px, so iOS does not zoom on focus.
- **Body small** (600 to 700, 14px): metadata, labels above fields, table cells on phones.
- **Label** (800, 12px, 0.03 to 0.08em, uppercase): state chips, table headers (11.5px, 0.06em), short field labels and modal section labels. These are functional labels attached to data, not decorative kickers.
- **Plate** (800, 0.12em tracking, tabular): the plate token in three sizes, 13px, 17px and 30px. The plate search input uses 18px at 0.14em.

### Named Rules
**The Weight Not Size Rule.** The live scale has five steps (12, 14, 16, 18, 28); a 22px token exists but is unused. Hierarchy comes from weight (600 against 800), not from new sizes.

**The Tabular Rule.** Plates, times, counts and money always use tabular numerals, so columns of figures line up.

## Layout

The layout is mobile-first in a single column. Pages have 16px gutters on the grey ground. The home column is capped at 720px, the Nuevo ingreso form at 560px and work pages at 1200px. The rhythm runs in small 2px steps inside a 4/8 armature. The common steps are 6, 8, 10, 12, 14 and 16px: 10px between car cards, 12 to 14px inside them and 16 to 18px between home sections. The direction asked for a strict 4/8 grid. The build uses 10 and 14 throughout, and this record follows the build.

**The app frame.** A sticky 56px top bar (logo mark, zone pill and avatar, frosted white) sits over the content. A fixed 64px bottom bar holds icon and label items and sits above the safe area. Content pads its bottom so nothing hides under the bar. Primary actions that must stay in reach, such as Ingresar, stick above the bottom bar.

**Breakpoints.** Below 768px, the table rows of Ingresos and Vista Key become car cards on a grid (plate and actions on top, station and payment below), and the column headers disappear. From 768px the bottom bar becomes a 92px left rail, the Más item drops to the rail's foot and tables return as clean left-aligned tables with the mini-line above the state.

**Next one waiting.** The plate search sticks just under the top bar (top bar height plus 8px), so the next car is always one query away while scrolling.

## Elevation & Depth

The system is a flat hybrid. Panels sit on the grey ground with a hairline border and an almost invisible shadow. Real lift is kept for things that float over the list: the sticky search, sheets and modals, and red primary actions, which carry a soft red glow below them.

### Shadow Vocabulary
- **Rest** (`box-shadow: 0 1px 2px rgba(20,22,26,.06), 0 1px 1px rgba(20,22,26,.03)`): cards, car cards, outline buttons and icon buttons.
- **Float** (`box-shadow: 0 6px 20px -6px rgba(20,22,26,.14), 0 2px 4px rgba(20,22,26,.04)`): the sticky plate search, modals and toast notices.
- **Sheet** (`box-shadow: 0 -10px 40px -10px rgba(20,22,26,.22)`): the Más bottom sheet.
- **Focus ring** (`box-shadow: 0 0 0 3px rgba(211,47,47,.22)`): focused fields and the search, paired with a red border.
- **Red action glow** (for example `0 6px 14px -8px rgba(211,47,47,.7)`): soft and blurred under red primary actions only.

### Named Rules
**The Float Only When Floating Rule.** Only an element that actually sits above the scrolling list gets Float or Sheet depth. Everything in the flow stays at Rest.

## Shapes

Corners are gently rounded, with 12px for controls and 16px for cards. Sheets and modals use 22px on top. Pills (999px) are only for chips and the zone tag. Dots are circles. The plate keeps its own tight 6px corner with a 2px dark rim and an inner white bevel (3px rim and 9px corner when large, 1.5px rim and 5px corner when small). The logo mark is a red rounded square holding an ink "P", a signage pictogram.

The line is the recurring silhouette. A 3px grey track runs behind 29px station dots on home, and on each car row a mini-line of five 8px dots joined by 2px segments, with the current dot at 12px wearing a red ring.

## Components

### Buttons
Tactile, plain and thumb-sized.
- **Shape:** gently rounded (12px). Full-width form actions use 16px.
- **Primary (red):** red fill and white text, 700 to 800 weight, 50px tall (56px for Ingresar and login), with a soft red glow below.
- **Hover / Press:** hover deepens to Deep Línea Red. Press scales to 0.97 over 140ms ease-out (0.98 for the full-width actions, 0.94 for 44px icon buttons). The colour change runs over 180ms.
- **Ink:** a signage-ink fill for the actions that move a car to its next station (Cobrar, foto del parqueo, parquear, despachar). It goes pure black on hover.
- **Outline:** a white fill with a Field Rim border and ink text, at Rest shadow. Hover fills with Ground. Capture buttons on Nuevo ingreso use a 1px ink border, which leaves red for Ingresar alone.
- **Icon button:** 44 by 44px, 12px corners, a white or ink fill, and a Lucide icon at 19 to 20px.

### Chips
- **Style:** a pill with a 12px uppercase label at 800, padded 4px 10px 3px, carrying a word and never colour alone.
- **States:** solicitado is solid red with white text. Despachado is white with an ink rim. Parqueado and pending are white with a grey rim and grey text. Finalizado and paid are green on green-50. Cancelado is grey and struck through.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Panel on the Ground.
- **Shadow Strategy:** Rest (see Elevation & Depth).
- **Border:** a 1px Hairline. A card that needs attention (solicitado) takes a full 1.5px red border on every side, never a side stripe.
- **Internal Padding:** 12 to 16px.

### Inputs / Fields
- **Style:** 48px tall (52 to 54px on Nuevo ingreso and login), a 1px Field Rim, 12px corners, a white fill and 16px text.
- **Focus:** a red border plus the 3px Focus ring. The caret is red. Checkboxes and radios use a red accent.
- **Plate input:** yellow with a 2.5px dark rim, 24px at 800 with 0.16em tracking. Focus adds an ink halo, not red.
- **Error:** a Deep Línea Red border.

### Navigation
- **Bottom bar (phone):** five items (Inicio, Ingresos, Nuevo, Parqueadero, Más), each a 23px Lucide icon over an 11px label at 700, grey by default. The active item turns Deep Línea Red with a 6px red station dot and a halo above the icon, scaling in from 0.9 over 180ms ease-out. Nuevo is a raised 46px red rounded square in the centre.
- **Rail (≥768px):** the same items stacked in a 92px left rail, with 64px tall rounded items and Más at the bottom.
- **Más sheet:** a native dialog that rises from the bottom (22px top corners, a grab handle, the user block and 54px rows with a leading icon and trailing chevron). It enters over 320ms on the drawer curve and leaves over 200ms ease-out, and only fades under reduced motion.

### La línea (signature)
The home card "La línea de hoy" shows five stations with their counts on a grey track, and each station links to its filtered list. A station with cars gets an ink ring. The station needing attention (solicitado) is a solid red dot with a Station Halo and a red name. Below it, the solicitados row has a pulsing red dot (2s, which stops under reduced motion) and a red border. On every car row, the mini-line repeats the same grammar at small scale.

### The plate (signature)
A yellow rounded rectangle with a dark rim, an inner white bevel, 800 weight, wide tracking and tabular figures. It comes in exactly three sizes: small (13px), standard (17px, 19px inside phone car cards) and large (30px). The customer-facing Payment pages use the same token.

### Icons
Lucide line icons from a local sprite (`/img/iconos.svg`) at a 1.85 stroke, sized in em and coloured with `currentColor`. Legacy Font Awesome tags are swapped to the sprite at runtime.

## Do's and Don'ts

### Do:
- **Do** answer "where is this car on its line?" first, with the station dot, the mini-line or the state chip in a fixed cell.
- **Do** keep red for actions, the current station, solicitado and selection. Put car-moving secondary actions in signage ink.
- **Do** give every car card identical anatomy (plate and actions on top, line and payment below) at the same scale.
- **Do** use the plate token in one of its three sizes (13px, 17px or 30px) wherever a plate appears.
- **Do** set plates, times, counts and money in tabular numerals.
- **Do** keep touch targets at 44px or more, and fields at 16px text or more.
- **Do** animate with the ease-out curve (cubic-bezier(0.23, 1, 0.32, 1)), 140ms for press and 180ms for state. Sheets use the drawer curve (cubic-bezier(0.32, 0.72, 0, 1)) at 320ms. Pressed elements scale to 0.97, and every transform is dropped under reduced motion.
- **Do** use Lucide icons from the sprite, coloured with currentColor.

### Don't:
- **Don't** put coloured side stripes on cards or rows. Attention is a full border or the line's red station.
- **Don't** paint a field, panel or section header red, or use red to label things.
- **Don't** add hex colours in new views. Use the `cps.css` tokens.
- **Don't** add new type sizes to build hierarchy. Change the weight.
- **Don't** fall back to coloured pill-badge grids, a side drawer or a hero-number dashboard for operating screens.
- **Don't** give in-flow cards Float depth. Only what floats over the list lifts.
