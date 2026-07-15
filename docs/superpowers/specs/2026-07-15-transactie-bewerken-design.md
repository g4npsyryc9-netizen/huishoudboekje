# Transactie bewerken + categorisatieregel onthouden — design

Datum: 2026-07-15
Status: goedgekeurd door Jelmer

## Doel

Na een CSV-import (of handmatige invoer) moet Jelmer een transactie volledig
kunnen corrigeren (datum, bedrag, omschrijving, rekening, categorie) — dit
bestond nog niet, alleen aanmaken en verwijderen. Daarnaast moet hij, als hij
de categorie van een geïmporteerde transactie corrigeert, er in één stap voor
kunnen kiezen dat toekomstige CSV-imports met dezelfde (of een zelf
ingekorte) omschrijving automatisch dezelfde categorie krijgen — zonder dat
hij daarvoor apart naar de categorieën-pagina hoeft.

## Architectuur

- **`updateTransaction`** — nieuwe Server Action in
  `src/app/transactions/actions.ts`, analoog aan `createTransaction` (zelfde
  validatie en Nederlandse foutmeldingen), maar met een `id` en
  `prisma.transaction.update` in plaats van `create`.
- **`TransactionRow`** — nieuw client component
  (`src/app/transactions/TransactionRow.tsx`) dat per transactie òf de
  normale weergave rendert, òf (na klikken op "Bewerken") een inline
  formulier met de huidige waarden vooringevuld. Lokale `useState` voor de
  open/dicht-status van het formulier — geen paginawissel.
- **`src/app/transactions/page.tsx`** wordt aangepast om per transactie
  `<TransactionRow transaction={...} accounts={...} categories={...} />` te
  renderen in plaats van de huidige inline `<li>`.

## "Onthoud dit voor toekomstige imports"

- Binnen het bewerkformulier: zodra de gekozen categorie afwijkt van de
  huidige categorie van de transactie, verschijnt een checkbox "Onthoud dit
  voor toekomstige imports".
- Vinkt de gebruiker die aan, dan verschijnt een tekstveld "Trefwoord",
  vooringevuld met de (huidige) omschrijving van de transactie, door de
  gebruiker vrij aan te passen (bijv. "ALBERT HEIJN 1234" inkorten tot
  "Albert Heijn").
- Bij opslaan (in dezelfde `updateTransaction`-actie, één formulier-submit):
  1. De transactie wordt bijgewerkt (datum/bedrag/omschrijving/rekening/categorie).
  2. Als het vinkje aan stond: zoek een bestaande `CategoryRule` met exact
     dat trefwoord (hoofdletterongevoelig). Bestaat die al, dan wordt het
     `categoryId` van die regel bijgewerkt naar de nieuw gekozen categorie
     (voorkomt dubbele/conflicterende regels voor hetzelfde trefwoord).
     Bestaat hij nog niet, dan wordt een nieuwe `CategoryRule` aangemaakt.
  3. Beide acties (transactie bijwerken + regel upserten) gebeuren in één
     `prisma.$transaction`, zodat ze samen slagen of samen falen.

## Data flow

Klik "Bewerken" → rij wordt formulier (client state) → gebruiker past velden
aan, vinkt eventueel "Onthoud dit" aan en past het trefwoord aan → submit
roept `updateTransaction` aan → `revalidatePath` op `/transactions`,
`/accounts`, `/dashboard` (zelfde paden als bij create/delete) → rij springt
terug naar weergavestand met de nieuwe waarden.

## Validatie & foutafhandeling

- Zelfde validatieregels als `createTransaction`: bedrag moet een positief
  getal zijn, omschrijving mag niet leeg zijn — zelfde Nederlandse
  foutmeldingen.
- Trefwoord mag niet leeg zijn als het vinkje aan staat (anders: "Trefwoord
  is verplicht", zelfde patroon als bij `createCategoryRule`).
- Fouten worden, zoals in de rest van de app, afgehandeld door een `Error`
  te gooien vanuit de Server Action — Next.js toont daarvoor de bestaande
  generieke foutpagina. Geen custom error-UI, consistent met de rest van de
  app.

## Testen

Geen nieuwe geautomatiseerde tests — dit is UI/CRUD-functionaliteit zonder
losstaande rekenlogica (past bij de projectconventie: alleen pure
`src/lib`-logica wordt met Vitest getest). Handmatig getest in de browser:
transactie bewerken zonder categoriewijziging, transactie bewerken mét
categoriewijziging + "Onthoud dit" aangevinkt (nieuwe regel), en nogmaals met
een trefwoord dat al bestaat (regel wordt bijgewerkt, niet gedupliceerd).

## Buiten scope

- Bulk-bewerken van meerdere transacties tegelijk.
- Automatisch trefwoord afleiden/inkorten (gebruiker typt het zelf).
- Regels laten samenvoegen/opschonen als er per ongeluk toch dubbele
  varianten ontstaan (bijv. "Albert Heijn" én "ALBERT HEIJN") — dat blijft
  handmatig beheer op de categorieën-pagina.
