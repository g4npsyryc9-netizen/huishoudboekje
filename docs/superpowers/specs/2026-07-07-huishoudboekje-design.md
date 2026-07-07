# Huishoudboekje — design

Datum: 2026-07-07
Status: goedgekeurd door Jelmer

## Doel

Een persoonlijke webapp om inkomsten en uitgaven bij te houden, vergelijkbaar met
Dyme of Buddy. Transacties worden handmatig ingevoerd of geïmporteerd via een
ING CSV-export (geen live PSD2-bankkoppeling). Alleen voor gebruik door Jelmer
zelf, online bereikbaar (ook vanaf telefoon).

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
- **CategoryRule** (categorisatieregel): `id`, `trefwoord`, `categoryId`.
  Wordt bij CSV-import toegepast: als de omschrijving van een geïmporteerde
  transactie het trefwoord bevat (hoofdletterongevoelig), krijgt de
  transactie automatisch die categorie. Regels worden beheerd op de
  categorieën-pagina.

Constraint: een `Category` of `Account` met gekoppelde transacties kan niet
verwijderd worden. De gebruiker krijgt een duidelijke melding en moet eerst de
gekoppelde transacties verplaatsen of verwijderen.

## CSV-import (ING)

- Op het scherm "Importeren" upload je een ING CSV-exportbestand en kies je
  de rekening waarvoor je importeert.
- De app herkent het ING-formaat (kolommen: datum, naam/omschrijving,
  rekeningnummer, tegenrekening, code, af/bij, bedrag, mutatiesoort,
  mededelingen) en zet elke rij om naar een concept-transactie.
- Elke concept-transactie wordt langs de `CategoryRule`-lijst gelegd; bij een
  match krijgt hij die categorie, anders de categorie "Onbekend".
- **Duplicaatdetectie**: een concept-transactie die al bestaat (zelfde
  rekening, datum, bedrag én omschrijving) wordt gemarkeerd als duplicaat en
  standaard niet opnieuw geïmporteerd. Zo kan een overlappende periode
  probleemloos opnieuw geëxporteerd en geüpload worden.
- **Voorbeeldscherm**: vóór definitief importeren zie je een tabel met alle
  regels uit het CSV-bestand, de herkende categorie, en welke rijen als
  duplicaat worden overgeslagen. Pas na bevestigen worden de transacties
  daadwerkelijk opgeslagen.

## Schermen

- **Login** — wachtwoordveld.
- **Dashboard** — totaalsaldo over alle rekeningen, inkomsten vs. uitgaven
  deze maand, uitgaven per categorie (taartdiagram), voortgang per budget
  (besteed/budget als balk), trend over de laatste 6 maanden (lijngrafiek).
- **Transacties** — lijst met filter op rekening/categorie/maand; toevoegen,
  bewerken, verwijderen.
- **Importeren** — ING CSV-bestand uploaden, voorbeeldscherm met herkende
  categorieën en duplicaten, bevestigen.
- **Terugkerende posten** — overzicht, toevoegen/bewerken/stoppen.
- **Rekeningen** — overzicht met actueel saldo; nieuwe rekening toevoegen.
- **Categorieën & budgetten** — beheer van categorieën, doorlopende
  maandbudget per categorie, en categorisatieregels voor CSV-import.

## Foutafhandeling & randgevallen

- Verwijderen van een categorie/rekening met gekoppelde transacties wordt
  geblokkeerd (zie constraint hierboven).
- Bedragen: altijd 2 decimalen, weergegeven in euro's; invoer wordt
  gevalideerd op een geldig positief getal (het teken inkomsten/uitgaven volgt
  uit het categorietype, niet uit een negatief bedrag).
- Sessie verloopt na inactiviteit; gebruiker moet dan opnieuw inloggen.
- Bij CSV-import met een onherkend formaat (geen ING-structuur) toont de app
  een duidelijke foutmelding in plaats van foutieve data te importeren.
- Rijen in het CSV-bestand die niet te parsen zijn (bijv. ontbrekend bedrag)
  worden op het voorbeeldscherm gemarkeerd als "overgeslagen: ongeldig" in
  plaats van de import te laten mislukken.

## Testen

Geen geautomatiseerde testsuite voor dit persoonlijke project. Elke
functionaliteit (rekening/categorie/transactie/budget/terugkerende post
aanmaken, dashboard-cijfers) wordt handmatig getest in de browser voordat het
als klaar wordt gemeld.

## Buiten scope (voor nu)

- Live bankkoppeling (PSD2).
- CSV-import voor andere banken dan ING.
- Meerdere gebruikers / delen met partner.
- Mobiele app (native) — wel responsive webdesign zodat het goed werkt op
  telefoon-browser.
