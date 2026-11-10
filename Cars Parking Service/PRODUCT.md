# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile web installed as a PWA (`manifest.webmanifest`: standalone, portrait, es-CO). The admin also uses it on a computer.

## Users

- **Valet** (role 1): receives the customer's car at the restaurant door and dispatches it when the customer asks for it. They work on the street with the phone in one hand, by day and at night, often with several cars arriving at once. This is the user the redesign serves first (stated in the brief).
- **Banco** (role 2): registers each ingreso (plate, customer, WhatsApp, photos, video, signature) and charges the service (cash, QR, Nequi or transfer, with a security code). At the end of the shift they settle up (liquidación). They work from a fixed point in their zone.
- **Key** (role 4): keeps the keys in the parking lot; parks and dispatches from Vista Key.
- **Admin** (role 3): oversees every zone and can do everything (Estado Turnos, Dashboard, Liquidaciones, Despachos y cobros, configuration). They use a computer and a phone.

*Inferred (the interview was skipped at the user's request):*
- Bancos and Keys use their own phones too, and sometimes a tablet at the post.
- The phones are mostly mid-range Android.

## Product Purpose

The app runs a valet parking service in Medellín, Colombia, from the car's arrival to its delivery and payment. Each car goes through these steps: ingreso, then parqueado, then solicitado (the customer asks for it by WhatsApp link or at the counter), then despachado, then finalizado and paid. Each bank's shift then closes with its liquidación. Success means every car is registered in seconds, nobody loses track of a car, and the cash adds up at the end of the shift.

## Positioning

It is the internal operating tool of a specific valet company that works across 7 zonas (Provenza, Ocio, Palmas…). It uses Colombian plates (ABC123), Colombian payment methods, shift handover between banks, and liquidation per shift. It is not a generic parking product.

## Operating Context

- **Zonas, ubicaciones and parqueaderos.** The user picks a zona at login. Ubicaciones are the restaurants. Parqueaderos are the parking lots; normally one per zona.
- **Shifts.** A turno runs from 6 am to 6 am: Turno 1, Turno 2, Noche, Madrugada and Corrido. When a shift ends, its unpaid cars pass to the bank that takes the next shift.
- **Customer messages.** WhatsApp messages go to the customer; the customer requests the car from a public link (Payment views).
- **Photos and capture.** Photos of the car at ingreso and at parking, a video of the ingreso, a transfer receipt, a live plate scanner (Tesseract in the browser), and the customer's signature on screen.
- **Cash.** Cash is collected in pesos (COP, no decimals) and handed over at the liquidación.

## Capabilities and Constraints

- **Stack.** ASP.NET Core MVC (net10) with Razor, SQL Server stored procedures, and vanilla JS. Session-based auth with roles. Controllers, routes, SPs and business rules must stay intact; this is a visual and UX renewal only.
- **Encodings.** File encodings are mixed: most files are UTF-8 with a BOM and CRLF line endings. `ingreso.css` and `AuthController.cs` are Windows-1252 and must never be resaved as UTF-8.
- **Repository.** The repo is public, so no secrets go in any new file.
- **Terminology the UI must keep:** ingreso, placa, parqueado, solicitado, despachado, finalizado, cancelado, banco, valet, key, zona, ubicación/lugar, parqueadero, turno, liquidación, cobro, código de seguridad.

## Brand Commitments

- **Name:** Cars Parking Service. The logo is `wwwroot/img/Logo-CarsParkingService.png`, and the PWA icons are in `wwwroot/icons/`.
- **Colour:** institutional red is the accent and the action colour (the theme colour is `#b71c1c`, the primary is `#d32f2f`). White is the base, with neutral grays and darks for hierarchy. Do not flood large areas with red; use it for actions, states, indicators and selection.
- **Icons:** line icons, preferably Lucide.
- **Feel:** modern, readable, professional typography; subtle shadows, borders, radii and spacing; premium and minimalist, never a generic Bootstrap template.
- **The plate:** each vehicle's identity is its Colombian plate, drawn as a yellow plate (`.ingreso-placa`). The brief's references (a valet app with the plate drawn as an object, big time indicators, and a bottom nav with icon tiles) are inspiration, not something to copy.

## Evidence on Hand

- The real operating data lives in production SQL Server. Use the LocalDB test database (CPS_PRUEBA) for development screenshots.
- No testimonials, customer logos or metrics exist for public use, and none may be invented.

## Product Principles

1. Speed over decoration: a valet with three cars waiting must finish each action in the fewest taps.
2. The car's state must be readable at arm's length, outdoors.
3. One action per moment: the primary action is always visible and within reach of the thumb.
4. Nothing breaks: every existing feature, rule and role keeps working after the redesign.
5. Brand through precision: the red marks what matters, it does not paint the screen.

## Accessibility & Inclusion

*Inferred:* the app is used outdoors in direct sun and at night, one-handed and in a hurry. That calls for large touch targets (44px minimum), high contrast, state shown by more than colour alone, and respect for the reduced-motion setting.
