# Huishoudboekje — design

Datum: 2026-07-07
Status: goedgekeurd door Jelmer

## Doel

Een persoonlijke webapp om inkomsten en uitgaven bij te houden, vergelijkbaar met
Dyme of Buddy, maar met handmatige invoer (geen bankkoppeling). Alleen voor
gebruik door Jelmer zelf, online bereikbaar (ook vanaf telefoon).

## Architectuur

- **Next.js** (App Router, TypeScript) — één webapp voor zowel de UI als de
  data-API (via route handlers / server actions).
- **Vercel** — hosting, gratis tier.
- **Neon Postgres** — gratis serverless Postgres-database.
- **Prisma** — ORM voor het datamodel en type-veilige database-toegang.
- **Recharts** — grafieken op het dashboard.
- **Auth**: geen registratie/multi-user systeem. Eén wachtwoord (gehasht,
  opgeslagen als environment variable), sessie via een cookie die na
  inactiviteit verloopt. Bij een verlopen/ontbrekende sessie wordt de
  gebruiker naar het loginscherm gestuurd.

## Datamodel

- **Account** (rekening/potje): `id`, `naam`, `type` (bank/spaar/contant),
  `startsaldo`. Actueel saldo = startsaldo + som van gekoppelde transacties.
- **Category** (categorie): `id`, `naam`, `type` (inkomsten/uitgaven), `kleur`.
- **Transaction**: `id`, `bedrag`, `datum`, `omschrijving`, `accountId`,
  `categoryId`.
- **RecurringRule** (terugkerende post): `id`, `omschrijving`, `bedrag`,
  `categoryId`, `accountId`, `dagVanDeMaand`, `startdatum`,
  `einddatum` (optioneel), `laatsteGegenereerdOp`.
  - Bij het openen van de app wordt gecontroleerd of er terugkerende posten
    "verschenen" moeten zijn sinds `laatsteGegenereerdOp` tot vandaag; voor elke
    gemiste maand wordt automatisch een bijbehorende `Transaction` aangemaakt.
    Geen aparte cron-job nodig.
- **Budget**: `id`, `categoryId`, `bedrag`. Doorlopend: één bedrag per
  categorie dat blijft gelden totdat de gebruiker het aanpast (geen
  maand-voor-maand invoer).

Constraint: een `Category` of `Account` met gekoppelde transacties kan niet
verwijderd worden. De gebruiker krijgt een duidelijke melding en moet eerst de
gekoppelde transacties verplaatsen of verwijderen.

## Schermen

- **Login** — wachtwoordveld.
- **Dashboard** — totaalsaldo over alle rekeningen, inkomsten vs. uitgaven
  deze maand, uitgaven per categorie (taartdiagram), voortgang per budget
  (besteed/budget als balk), trend over de laatste 6 maanden (lijngrafiek).
- **Transacties** — lijst met filter op rekening/categorie/maand; toevoegen,
  bewerken, verwijderen.
- **Terugkerende posten** — overzicht, toevoegen/bewerken/stoppen.
- **Rekeningen** — overzicht met actueel saldo; nieuwe rekening toevoegen.
- **Categorieën & budgetten** — beheer van categorieën en het doorlopende
  maandbudget per categorie.

## Foutafhandeling & randgevallen

- Verwijderen van een categorie/rekening met gekoppelde transacties wordt
  geblokkeerd (zie constraint hierboven).
- Bedragen: altijd 2 decimalen, weergegeven in euro's; invoer wordt
  gevalideerd op een geldig positief getal (het teken inkomsten/uitgaven volgt
  uit het categorietype, niet uit een negatief bedrag).
- Sessie verloopt na inactiviteit; gebruiker moet dan opnieuw inloggen.

## Testen

Geen geautomatiseerde testsuite voor dit persoonlijke project. Elke
functionaliteit (rekening/categorie/transactie/budget/terugkerende post
aanmaken, dashboard-cijfers) wordt handmatig getest in de browser voordat het
als klaar wordt gemeld.

## Buiten scope (voor nu)

- Automatische bankkoppeling (CSV-import of PSD2).
- Meerdere gebruikers / delen met partner.
- Mobiele app (native) — wel responsive webdesign zodat het goed werkt op
  telefoon-browser.
