---
version: 1
slug: "views-shared-layout-cshtml"
primary_target: "Views/Shared/_Layout.cshtml"
related_targets: ["Views/Shared/_LayoutKey.cshtml","Views/Home/Index.cshtml","Views/Home/Tabla_Vehiculos.cshtml","Views/Home/Ingreso_Vehiculos.cshtml","Views/Home/VistaKey.cshtml"]
---

## Scope

The app shell (layouts, bottom navigation, Más sheet) and every operating screen inside it. Mode: Operate. Mobile first: phones in portrait, then tablet and desktop.

## Audience and task

Valets, bancos, keys and the admin of a valet parking company in Medellín. The job is to register, find, move and charge cars fast, outdoors, one-handed, with several cars arriving at once.

## Constraints

- Keep every controller, route, role rule and feature.
- Keep the brand red as the accent only, on a white base.
- Use Lucide line icons.
- The user asked to skip the interview. The surface facts come from the brief, the references and the codebase.

## Direction contract

THESIS: Every car lives on a line. The shell reads like a transit network map. Each vehicle sits at a station on one line: Recibido → Parqueado → Solicitado → Despachado → Pagado. The UI always answers "where is this car on its line?". This refuses the category default: a side drawer, card grids with coloured pill badges, and the hero-number dashboard.

OWN-WORLD: Medellín Metro wayfinding.
- Grounds: white panels on a cool pale-grey ground. Signage black (#14161A) ink and hairline greys.
- One line colour, institutional red (#D32F2F, deep #B71C1C). It marks the current station, primary actions and selection, and never paints a field.
- Station dots: filled for passed stations, a ring for the current one, hollow for stations still ahead.
- The Colombian yellow plate is the car's token.
- Type: Overpass, a typeface descended from road signage, with tabular numerals for plates, times and money.

STORY: The visitor opens the app and sees today's line for their zone: how many cars sit at each station. They tap a station to see those cars. Each car card shows its plate, its line, and the one action that moves it to the next station.

FIRST VIEWPORT (home, phone):
- A compact top bar holds the logo mark, the zone and the avatar.
- Below it, a greeting with the role.
- "La línea de hoy" is the signature: a horizontal line with five stations and their counts. The station needing attention (Solicitado) carries the red ring.
- Then two primary actions sized for the thumb, "Nuevo ingreso" and "Buscar placa", and the requested cars.
- A fixed bottom navigation bar sits over the safe area: icon plus label, with a red station dot as the active indicator. The Nuevo action sits in the bar for bancos and admin.

FORM: Medellín Metro wayfinding signage, position 3 of 7 on the ordered list (claim ticket, Colombian plate, metro wayfinding, key board, pavement markings, concierge card, host book). seed:be75be2b43da49fd.

Raises kept from the declined challengers:
- Fixed-scale plates (botanical folio): every car card keeps identical anatomy and scale, so states compare at a glance.
- Rank by weight, not size (timetable): a short type scale; state is a mark in a fixed cell.
- Specimen sizes (bitmap specimen): the plate token comes in exactly three sizes.
- Grid armature (Crouwel): a strict 4/8px spacing grid.
- Tabular numerals (datamatics): all numbers are set with tabular figures.
- Next one waiting (vertical feed): after an action, the next pending car is already in view.

Signature interaction: the station dot of the active nav item and the car's current station share one motion. A 180ms ease-out scale-in from 0.9, with opacity only under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Which admin screens, if any, should keep a desktop-first density.
- Whether bancos really use tablets. The assumption is yes, so the layout adapts from 768px.
