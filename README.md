# Huishoudboekje

Persoonlijke webapp om inkomsten en uitgaven bij te houden. Zie
`docs/superpowers/specs/2026-07-07-huishoudboekje-design.md` voor het
ontwerp.

## Lokaal draaien

1. `npm install`
2. Kopieer `.env.example` naar `.env` en vul `DATABASE_URL` (Neon),
   `APP_PASSWORD_HASH` en `SESSION_SECRET` in.
3. `npx prisma migrate dev` (past migraties toe en seedt de standaardcategorieën)
4. `npm run dev`

## Tests

`npm test` draait de Vitest-unittests voor de business-logica in `src/lib`
(geld, terugkerende posten, CSV-import). De UI wordt handmatig getest in de
browser.

## Wachtwoord wijzigen

Genereer een nieuwe hash en zet die als `APP_PASSWORD_HASH` in `.env` en in
de Vercel-omgevingsvariabelen:

```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash(process.argv[1], 12).then(h => console.log(h))" "NIEUW-WACHTWOORD"
```

## CSV-import

Ondersteunt alleen het ING-exportformaat. Categorisatieregels beheer je op
de pagina "Categorieën".
