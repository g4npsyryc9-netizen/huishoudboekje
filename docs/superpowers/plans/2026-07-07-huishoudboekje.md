# Huishoudboekje Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal income/expense tracking webapp (Next.js + Postgres, hosted on Vercel) with manual entry, ING CSV import, recurring items, per-category budgets, and a dashboard with charts.

**Architecture:** Single Next.js 15 (App Router, TypeScript) app. Server Components read data directly via Prisma; mutations go through Next.js Server Actions (no separate REST layer). Auth is a single shared password, session held in a signed JWT cookie verified in middleware (edge-safe, no Prisma there). Data lives in Neon Postgres via Prisma. Charts via Recharts. Pure business logic (money math, recurring-rule generation, CSV parsing, category matching, duplicate detection) lives in isolated `src/lib` modules with Vitest unit tests; CRUD UI is verified by hand in the browser per the spec.

**Tech Stack:** Next.js 15 (App Router, TypeScript, src dir), Tailwind CSS, Prisma + Neon Postgres, bcryptjs, jose (JWT), papaparse (CSV), Recharts, Vitest, Zod (form validation).

**Note (added after Task 2):** Prisma is pinned to v6.19.3, not the latest v7 — Prisma 7 requires driver-adapter-based `PrismaClient` construction, which breaks the plain `new PrismaClient()` pattern this plan's tasks use in `src/lib/prisma.ts` and `prisma/seed.ts`. Any later task touching Prisma client construction or `prisma/schema.prisma` should keep this pin in mind rather than upgrading unprompted.

## Global Constraints

- Single user only — password stored as a bcrypt hash in `APP_PASSWORD_HASH` env var, no signup/registration flow.
- Manual entry + ING CSV import only for v1 — no live bank koppeling (PSD2), no other bank formats.
- Budgetten zijn doorlopend: één bedrag per categorie, geldig tot de gebruiker het aanpast (geen maand-voor-maand invoer).
- Een `Category` of `Account` met gekoppelde transacties mag niet verwijderd worden — geef een duidelijke foutmelding i.p.v. de delete toe te staan.
- Geen geautomatiseerde testsuite voor de UI-schermen (handmatig getest in de browser); wel Vitest unit tests voor de losstaande business-logica (`src/lib/money.ts`, `src/lib/recurring.ts`, `src/lib/csv/*`) omdat daar de duurste bugs zitten.
- Alle UI-teksten in het Nederlands.
- Bedragen: altijd 2 decimalen, weergave als `€ 25,50`; invoer als positief getal, het teken volgt uit het categorietype (inkomsten/uitgaven).
- CSV-import ondersteunt alleen het ING-exportformaat.

---

## File Structure

```
huishoudboekje/
  prisma/
    schema.prisma
    seed.ts
  src/
    middleware.ts
    lib/
      prisma.ts
      auth.ts
      session.ts
      money.ts
      constants.ts
      recurring.ts
      csv/
        ing-parser.ts
        category-match.ts
        duplicate-detect.ts
    components/
      NavBar.tsx
      DeleteButton.tsx
    app/
      layout.tsx
      globals.css
      login/page.tsx
      api/auth/login/route.ts
      logout/route.ts
      dashboard/page.tsx
      accounts/page.tsx
      accounts/actions.ts
      categories/page.tsx
      categories/actions.ts
      transactions/page.tsx
      transactions/actions.ts
      recurring/page.tsx
      recurring/actions.ts
      import/page.tsx
      import/actions.ts
  tests/
    money.test.ts
    recurring.test.ts
    ing-parser.test.ts
    category-match.test.ts
    duplicate-detect.test.ts
  .env.example
  README.md
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `.gitignore`, `.env.example`

**Interfaces:**
- Produces: a runnable Next.js dev server (`npm run dev`) with Tailwind working, on top of the existing git repo at `/Users/jelmer/Documents/Claude/Projects/Huishoudboekje`.

- [ ] **Step 1: Scaffold the app**

Run from the project root (`/Users/jelmer/Documents/Claude/Projects/Huishoudboekje`, which already has a git repo and `docs/`):

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```

If it complains the directory isn't empty (because of `docs/`), rerun with `--force`... actually `create-next-app` refuses non-empty dirs even with existing docs. Instead scaffold into a temp dir and merge:

```bash
npx create-next-app@latest /tmp/hhb-scaffold --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
rsync -a --exclude='.git' /tmp/hhb-scaffold/ "/Users/jelmer/Documents/Claude/Projects/Huishoudboekje/"
rm -rf /tmp/hhb-scaffold
```

- [ ] **Step 2: Replace the default home page**

Edit `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 3: Verify the dev server runs**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000`, visiting it redirects toward `/dashboard` (which will 404 until Task 6/12 — that's expected at this point). Stop the server with Ctrl+C.

- [ ] **Step 4: Add env example and gitignore entries**

Create `.env.example`:

```
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
APP_PASSWORD_HASH="bcrypt-hash-generated-in-task-5"
SESSION_SECRET="a-long-random-string"
```

Confirm `.gitignore` (created by create-next-app) already contains `.env*.local` and `node_modules`. Add a line for `.env` itself if missing:

```bash
grep -qxF '.env' .gitignore || echo '.env' >> .gitignore
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind"
```

---

### Task 2: Prisma schema, Neon connection, migrations, seed

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/prisma.ts`, `src/lib/constants.ts`
- Modify: `package.json` (add `prisma`, `@prisma/client`, seed config)

**Interfaces:**
- Produces: `prisma` singleton export from `src/lib/prisma.ts` (`import { prisma } from "@/lib/prisma"`), model types `Account`, `Category`, `Transaction`, `RecurringRule`, `Budget`, `CategoryRule` (all generated by Prisma), and constants `FALLBACK_INCOME_CATEGORY_ID`, `FALLBACK_EXPENSE_CATEGORY_ID` from `src/lib/constants.ts`.

- [ ] **Step 1: Install Prisma**

```bash
npm install @prisma/client
npm install -D prisma tsx
```

- [ ] **Step 2: Write the schema**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CategoryType {
  INCOME
  EXPENSE
}

enum AccountType {
  BANK
  SAVINGS
  CASH
}

model Account {
  id             String          @id @default(cuid())
  name           String
  type           AccountType
  startBalance   Decimal         @db.Decimal(10, 2)
  createdAt      DateTime        @default(now())
  transactions   Transaction[]
  recurringRules RecurringRule[]
}

model Category {
  id             String          @id @default(cuid())
  name           String
  type           CategoryType
  color          String
  createdAt      DateTime        @default(now())
  transactions   Transaction[]
  recurringRules RecurringRule[]
  budget         Budget?
  rules          CategoryRule[]
}

model Transaction {
  id          String   @id @default(cuid())
  amount      Decimal  @db.Decimal(10, 2)
  date        DateTime
  description String
  accountId   String
  account     Account  @relation(fields: [accountId], references: [id])
  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id])
  createdAt   DateTime @default(now())

  @@index([accountId])
  @@index([categoryId])
  @@index([date])
}

model RecurringRule {
  id              String    @id @default(cuid())
  description     String
  amount          Decimal   @db.Decimal(10, 2)
  categoryId      String
  category        Category  @relation(fields: [categoryId], references: [id])
  accountId       String
  account         Account   @relation(fields: [accountId], references: [id])
  dayOfMonth      Int
  startDate       DateTime
  endDate         DateTime?
  lastGeneratedOn DateTime?
  createdAt       DateTime  @default(now())
}

model Budget {
  id         String   @id @default(cuid())
  categoryId String   @unique
  category   Category @relation(fields: [categoryId], references: [id])
  amount     Decimal  @db.Decimal(10, 2)
}

model CategoryRule {
  id         String   @id @default(cuid())
  keyword    String
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id])
}
```

- [ ] **Step 2b: Add constants for the fallback categories**

Create `src/lib/constants.ts`:

```ts
export const FALLBACK_INCOME_CATEGORY_ID = "cat_onbekend_inkomsten";
export const FALLBACK_EXPENSE_CATEGORY_ID = "cat_onbekend_uitgaven";
```

- [ ] **Step 3: Create the Prisma client singleton**

Create `src/lib/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 4: Write the seed script**

Create `prisma/seed.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import {
  FALLBACK_INCOME_CATEGORY_ID,
  FALLBACK_EXPENSE_CATEGORY_ID,
} from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  await prisma.category.upsert({
    where: { id: FALLBACK_INCOME_CATEGORY_ID },
    update: {},
    create: {
      id: FALLBACK_INCOME_CATEGORY_ID,
      name: "Onbekend (inkomsten)",
      type: "INCOME",
      color: "#9CA3AF",
    },
  });

  await prisma.category.upsert({
    where: { id: FALLBACK_EXPENSE_CATEGORY_ID },
    update: {},
    create: {
      id: FALLBACK_EXPENSE_CATEGORY_ID,
      name: "Onbekend (uitgaven)",
      type: "EXPENSE",
      color: "#9CA3AF",
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

Add seed config to `package.json` (merge into existing JSON, don't replace the file):

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 5: Set up a local `.env` for development**

Jelmer needs a Neon project first. Tell him: "Maak een gratis account op https://neon.tech, maak een nieuw project 'huishoudboekje' aan, en kopieer de 'Pooled connection' connection string." Then:

```bash
cp .env.example .env
```

Edit `.env` and paste the Neon pooled connection string as `DATABASE_URL`. Leave `APP_PASSWORD_HASH` and `SESSION_SECRET` blank for now — Task 5 fills those in.

- [ ] **Step 6: Run the first migration and seed**

```bash
npx prisma migrate dev --name init
```

Expected: creates `prisma/migrations/<timestamp>_init/`, applies it to the Neon database, and runs the seed automatically (prints the two upserted categories, no errors).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema, Neon setup, and seed data"
```

---

### Task 3: Deploy skeleton to Vercel

**Files:** none (infrastructure/config task)

**Interfaces:**
- Produces: a live Vercel deployment URL, and `DATABASE_URL` configured as a Vercel env var (later tasks add `APP_PASSWORD_HASH`/`SESSION_SECRET` to the same place).

- [ ] **Step 1: Push the repo to GitHub**

Jelmer needs a GitHub repo to connect to Vercel. Ask him to create an empty repo (e.g. `huishoudboekje`) on https://github.com/new, then:

```bash
git remote add origin <the-repo-url-jelmer-gives-you>
git push -u origin main
```

- [ ] **Step 2: Create the Vercel project**

Tell Jelmer: "Maak een gratis account op https://vercel.com (inloggen met GitHub kan), klik 'Add New Project', en kies de `huishoudboekje` repo." Vercel auto-detects Next.js — accept the defaults.

- [ ] **Step 3: Add environment variables in Vercel**

In the Vercel project settings → Environment Variables, add `DATABASE_URL` with the same Neon pooled connection string from `.env`. Leave `APP_PASSWORD_HASH`/`SESSION_SECRET` for Task 6.

- [ ] **Step 4: Trigger and verify the first deploy**

Vercel deploys automatically on push. Confirm the deployment succeeds in the Vercel dashboard (green checkmark) and that visiting the deployment URL doesn't show a build error (a 404 on `/dashboard` is expected and fine at this point).

- [ ] **Step 5: Commit**

Nothing to commit for this task (pure infra step) — skip.

---

### Task 4: Money utilities (formatting + signed amounts)

**Files:**
- Create: `src/lib/money.ts`, `tests/money.test.ts`
- Modify: `package.json` (add `vitest`)

**Interfaces:**
- Produces: `formatEuro(amount: number): string` and `signedAmount(amount: number, categoryType: "INCOME" | "EXPENSE"): number`, both imported later as `import { formatEuro, signedAmount } from "@/lib/money"`.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

Add to `package.json` scripts:

```json
"test": "vitest run"
```

- [ ] **Step 2: Write the failing tests**

Create `tests/money.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatEuro, signedAmount } from "@/lib/money";

describe("formatEuro", () => {
  it("formats a whole number with two decimals and a comma", () => {
    expect(formatEuro(25)).toBe("€ 25,00");
  });

  it("formats a number with cents, rounding to two decimals", () => {
    expect(formatEuro(1234.5)).toBe("€ 1.234,50");
  });

  it("formats zero", () => {
    expect(formatEuro(0)).toBe("€ 0,00");
  });
});

describe("signedAmount", () => {
  it("keeps expense amounts positive as stored but returns them negative", () => {
    expect(signedAmount(25.5, "EXPENSE")).toBe(-25.5);
  });

  it("returns income amounts positive", () => {
    expect(signedAmount(100, "INCOME")).toBe(100);
  });
});
```

- [ ] **Step 3: Add a `@/*` alias to Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { environment: "node" },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/money'`.

- [ ] **Step 5: Implement**

Create `src/lib/money.ts`:

```ts
export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function signedAmount(
  amount: number,
  categoryType: "INCOME" | "EXPENSE",
): number {
  return categoryType === "EXPENSE" ? -Math.abs(amount) : Math.abs(amount);
}
```

Note: `Intl.NumberFormat("nl-NL", ...)` renders as `€ 25,00` (non-breaking space after €) — the test above uses a plain space; if the test fails only on the space character, replace the literal space in the test with ` ` to match.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add money formatting and signed-amount utilities"
```

---

### Task 5: Auth utilities (password hash/verify) + generate the real password hash

**Files:**
- Create: `src/lib/auth.ts`, `tests/auth.test.ts`

**Interfaces:**
- Produces: `hashPassword(password: string): Promise<string>` and `verifyPassword(password: string, hash: string): Promise<boolean>`.

- [ ] **Step 1: Install bcryptjs**

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Write the failing test**

Create `tests/auth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth";

describe("password hashing", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(
      true,
    );
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/auth'`.

- [ ] **Step 4: Implement**

Create `src/lib/auth.ts`:

```ts
import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Generate Jelmer's real password hash and session secret**

Run a one-off script to hash the password Jelmer wants to use:

```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash(process.argv[1], 12).then(h => console.log(h))" "KIES-HIER-EEN-WACHTWOORD"
```

Copy the printed hash into `.env` as `APP_PASSWORD_HASH`. Generate a random session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy that into `.env` as `SESSION_SECRET`. Add both to the Vercel project's environment variables too (same names/values).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add password hashing utilities"
```

(The `.env` file itself is gitignored and never committed.)

---

### Task 6: Session cookie (JWT) + login/logout + middleware + nav shell

**Files:**
- Create: `src/lib/session.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/api/auth/login/route.ts`, `src/app/logout/route.ts`, `src/components/NavBar.tsx`, `tests/session.test.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `verifyPassword` from `src/lib/auth.ts` (Task 5).
- Produces: `createSessionCookie(): Promise<string>` and `verifySessionCookie(token: string): Promise<boolean>` from `src/lib/session.ts`, importable from edge middleware (no Prisma import in this file).

- [ ] **Step 1: Install jose**

```bash
npm install jose
```

- [ ] **Step 2: Write the failing test**

Create `tests/session.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createSessionCookie, verifySessionCookie } from "@/lib/session";

describe("session cookie", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret-value-not-for-production";
  });

  it("creates a token that verifies as valid", async () => {
    const token = await createSessionCookie();
    expect(await verifySessionCookie(token)).toBe(true);
  });

  it("rejects a garbage token", async () => {
    expect(await verifySessionCookie("not-a-real-token")).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/session'`.

- [ ] **Step 4: Implement the session module**

Create `src/lib/session.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 dagen inactiviteit

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET ontbreekt");
  return new TextEncoder().encode(secret);
}

export async function createSessionCookie(): Promise<string> {
  return new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(
      Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    )
    .sign(getSecretKey());
}

export async function verifySessionCookie(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Login page**

Create `src/app/login/page.tsx`:

```tsx
export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        action="/api/auth/login"
        method="POST"
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow"
      >
        <h1 className="text-xl font-semibold text-gray-900">Huishoudboekje</h1>
        {searchParams.error && (
          <p className="text-sm text-red-600">Onjuist wachtwoord.</p>
        )}
        <input
          type="password"
          name="password"
          placeholder="Wachtwoord"
          required
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        <button
          type="submit"
          className="w-full rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
        >
          Inloggen
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 7: Login API route**

Create `src/app/api/auth/login/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import {
  createSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const hash = process.env.APP_PASSWORD_HASH ?? "";

  const valid = hash ? await verifyPassword(password, hash) : false;

  if (!valid) {
    return NextResponse.redirect(new URL("/login?error=1", request.url));
  }

  const token = await createSessionCookie();
  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}
```

- [ ] **Step 8: Logout route**

Create `src/app/logout/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
```

- [ ] **Step 9: Middleware protecting all routes except login/api/auth**

Create `src/middleware.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  verifySessionCookie,
} from "@/lib/session";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = token ? await verifySessionCookie(token) : false;

  if (!valid) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Sliding session: refresh the cookie's expiry on every authenticated request.
  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE_NAME, token!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!login|api/auth/login|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

- [ ] **Step 10: Nav shell and root layout**

Create `src/components/NavBar.tsx`:

```tsx
import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transacties" },
  { href: "/import", label: "Importeren" },
  { href: "/recurring", label: "Terugkerend" },
  { href: "/accounts", label: "Rekeningen" },
  { href: "/categories", label: "Categorieën" },
];

export default function NavBar() {
  return (
    <nav className="border-b bg-white px-4 py-3">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-gray-700 hover:text-blue-600"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <a href="/logout" className="text-sm text-gray-500 hover:text-red-600">
          Uitloggen
        </a>
      </div>
    </nav>
  );
}
```

Modify `src/app/layout.tsx` to render the nav (keep the existing font/metadata setup from create-next-app, just wrap the body content):

```tsx
import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Huishoudboekje",
  description: "Persoonlijk huishoudboekje",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body className="bg-gray-50 text-gray-900">
        <NavBar />
        <main className="mx-auto max-w-4xl p-4">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 11: Manual verification**

Run: `npm run dev`
Visit `http://localhost:3000` — expect a redirect to `/login`. Enter the wrong password — expect "Onjuist wachtwoord." Enter the correct password (the plaintext you hashed in Task 5) — expect a redirect to `/dashboard` (404 is fine, page doesn't exist yet — but no redirect loop back to `/login`). Visit `/logout` — expect redirect to `/login`, and reloading `/dashboard` now redirects to `/login` again.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add password-protected session auth and nav shell"
```

---

### Task 7: Accounts CRUD

**Files:**
- Create: `src/app/accounts/page.tsx`, `src/app/accounts/actions.ts`, `src/components/DeleteButton.tsx`

**Interfaces:**
- Consumes: `prisma` (Task 2), `formatEuro` (Task 4).
- Produces: `createAccount`, `updateAccount`, `deleteAccount` server actions in `src/app/accounts/actions.ts`, reused pattern for later CRUD pages.

- [ ] **Step 1: Reusable delete confirmation button**

Create `src/components/DeleteButton.tsx`:

```tsx
"use client";

export default function DeleteButton({
  action,
  confirmMessage,
}: {
  action: (formData: FormData) => void;
  confirmMessage: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <button type="submit" className="text-sm text-red-600 hover:underline">
        Verwijderen
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Server actions**

Create `src/app/accounts/actions.ts`:

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createAccount(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "BANK") as
    | "BANK"
    | "SAVINGS"
    | "CASH";
  const startBalance = Number(formData.get("startBalance") ?? 0);

  if (!name) throw new Error("Naam is verplicht");
  if (Number.isNaN(startBalance)) throw new Error("Ongeldig startsaldo");

  await prisma.account.create({ data: { name, type, startBalance } });
  revalidatePath("/accounts");
}

export async function deleteAccount(formData: FormData) {
  const id = String(formData.get("id"));
  const count = await prisma.transaction.count({ where: { accountId: id } });
  if (count > 0) {
    throw new Error(
      `Kan rekening niet verwijderen: er zijn nog ${count} gekoppelde transacties.`,
    );
  }
  await prisma.account.delete({ where: { id } });
  revalidatePath("/accounts");
}
```

- [ ] **Step 3: Page**

Create `src/app/accounts/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { formatEuro, signedAmount } from "@/lib/money";
import { createAccount, deleteAccount } from "./actions";
import DeleteButton from "@/components/DeleteButton";

const typeLabels: Record<string, string> = {
  BANK: "Bank",
  SAVINGS: "Spaar",
  CASH: "Contant",
};

export default async function AccountsPage() {
  const accounts = await prisma.account.findMany({
    include: { transactions: { include: { category: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Rekeningen</h1>

      <ul className="divide-y rounded border bg-white">
        {accounts.map((account) => {
          const balance =
            Number(account.startBalance) +
            account.transactions.reduce(
              (sum, t) =>
                sum + signedAmount(Number(t.amount), t.category.type),
              0,
            );
          return (
            <li
              key={account.id}
              className="flex items-center justify-between p-3"
            >
              <div>
                <p className="font-medium">{account.name}</p>
                <p className="text-sm text-gray-500">
                  {typeLabels[account.type]} · {formatEuro(balance)}
                </p>
              </div>
              <DeleteButton
                action={deleteAccount}
                confirmMessage={`Rekening "${account.name}" verwijderen?`}
              />
              <input type="hidden" name="id" value={account.id} form={`del-${account.id}`} />
            </li>
          );
        })}
        {accounts.length === 0 && (
          <li className="p-3 text-sm text-gray-500">Nog geen rekeningen.</li>
        )}
      </ul>

      <form
        action={createAccount}
        className="space-y-3 rounded border bg-white p-4"
      >
        <h2 className="font-medium">Nieuwe rekening</h2>
        <input
          name="name"
          placeholder="Naam (bijv. Betaalrekening)"
          required
          className="w-full rounded border px-3 py-2"
        />
        <select name="type" className="w-full rounded border px-3 py-2">
          <option value="BANK">Bank</option>
          <option value="SAVINGS">Spaar</option>
          <option value="CASH">Contant</option>
        </select>
        <input
          name="startBalance"
          type="number"
          step="0.01"
          defaultValue="0"
          placeholder="Startsaldo"
          className="w-full rounded border px-3 py-2"
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
        >
          Toevoegen
        </button>
      </form>
    </div>
  );
}
```

Note: the `DeleteButton`'s `action` prop is a Server Action bound directly to its own `<form>`, so it already submits `id` via a hidden field inside that same form — remove the stray `form={...}` hidden input from Step 3 above and instead pass `id` through `DeleteButton` by wrapping it:

```tsx
<form action={deleteAccount}>
  <input type="hidden" name="id" value={account.id} />
  <DeleteButtonInner confirmMessage={`Rekening "${account.name}" verwijderen?`} />
</form>
```

To keep `DeleteButton` simple and reusable, change its implementation instead: accept `id` as a prop and construct the hidden field internally.

- [ ] **Step 3b: Fix DeleteButton to take an id prop**

Replace `src/components/DeleteButton.tsx` with:

```tsx
"use client";

export default function DeleteButton({
  action,
  id,
  confirmMessage,
}: {
  action: (formData: FormData) => void;
  id: string;
  confirmMessage: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-sm text-red-600 hover:underline">
        Verwijderen
      </button>
    </form>
  );
}
```

And in `src/app/accounts/page.tsx`, replace the `<DeleteButton .../>` usage and remove the stray hidden input:

```tsx
<DeleteButton
  action={deleteAccount}
  id={account.id}
  confirmMessage={`Rekening "${account.name}" verwijderen?`}
/>
```

(Delete the leftover `<input type="hidden" ... form={...} />` line entirely.)

- [ ] **Step 4: Manual verification**

Run `npm run dev`, log in, go to `/accounts`. Add a "Betaalrekening" (Bank, startsaldo 1000) — expect it to appear in the list with balance `€ 1.000,00`. Try deleting it — expect it to succeed (no transactions yet). Add it back for use in later tasks.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add accounts CRUD"
```

---

### Task 8: Categories + Budgets CRUD

**Files:**
- Create: `src/app/categories/page.tsx`, `src/app/categories/actions.ts`

**Interfaces:**
- Consumes: `prisma`, `formatEuro`, `DeleteButton` (id-based, from Task 7).
- Produces: `createCategory`, `deleteCategory`, `setBudget` server actions.

- [ ] **Step 1: Server actions**

Create `src/app/categories/actions.ts`:

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "EXPENSE") as
    | "INCOME"
    | "EXPENSE";
  const color = String(formData.get("color") ?? "#3B82F6");

  if (!name) throw new Error("Naam is verplicht");

  await prisma.category.create({ data: { name, type, color } });
  revalidatePath("/categories");
}

export async function deleteCategory(formData: FormData) {
  const id = String(formData.get("id"));
  const count = await prisma.transaction.count({ where: { categoryId: id } });
  if (count > 0) {
    throw new Error(
      `Kan categorie niet verwijderen: er zijn nog ${count} gekoppelde transacties.`,
    );
  }
  await prisma.category.delete({ where: { id } });
  revalidatePath("/categories");
}

export async function setBudget(formData: FormData) {
  const categoryId = String(formData.get("categoryId"));
  const amountRaw = formData.get("amount");
  const amount =
    amountRaw === null || amountRaw === "" ? null : Number(amountRaw);

  if (amount === null) {
    await prisma.budget.deleteMany({ where: { categoryId } });
  } else {
    if (Number.isNaN(amount) || amount < 0)
      throw new Error("Ongeldig budgetbedrag");
    await prisma.budget.upsert({
      where: { categoryId },
      update: { amount },
      create: { categoryId, amount },
    });
  }
  revalidatePath("/categories");
}
```

- [ ] **Step 2: Page**

Create `src/app/categories/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { formatEuro } from "@/lib/money";
import { createCategory, deleteCategory, setBudget } from "./actions";
import DeleteButton from "@/components/DeleteButton";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    include: { budget: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Categorieën &amp; budgetten</h1>

      <ul className="divide-y rounded border bg-white">
        {categories.map((category) => (
          <li key={category.id} className="flex items-center gap-3 p-3">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <div className="flex-1">
              <p className="font-medium">{category.name}</p>
              <p className="text-sm text-gray-500">
                {category.type === "INCOME" ? "Inkomsten" : "Uitgaven"}
              </p>
            </div>
            <form action={setBudget} className="flex items-center gap-2">
              <input type="hidden" name="categoryId" value={category.id} />
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Budget/mnd"
                defaultValue={
                  category.budget ? Number(category.budget.amount) : ""
                }
                className="w-28 rounded border px-2 py-1 text-sm"
              />
              <button
                type="submit"
                className="text-sm text-blue-600 hover:underline"
              >
                Opslaan
              </button>
            </form>
            <DeleteButton
              action={deleteCategory}
              id={category.id}
              confirmMessage={`Categorie "${category.name}" verwijderen?`}
            />
          </li>
        ))}
      </ul>

      <form
        action={createCategory}
        className="space-y-3 rounded border bg-white p-4"
      >
        <h2 className="font-medium">Nieuwe categorie</h2>
        <input
          name="name"
          placeholder="Naam (bijv. Boodschappen)"
          required
          className="w-full rounded border px-3 py-2"
        />
        <select name="type" className="w-full rounded border px-3 py-2">
          <option value="EXPENSE">Uitgaven</option>
          <option value="INCOME">Inkomsten</option>
        </select>
        <input name="color" type="color" defaultValue="#3B82F6" />
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
        >
          Toevoegen
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`, go to `/categories`. Add "Boodschappen" (Uitgaven). Set its budget to 300 — expect the field to save and show 300 on reload. Add "Salaris" (Inkomsten). Try deleting a category with no transactions — expect success.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add categories and budgets CRUD"
```

---

### Task 9: Transactions CRUD

**Files:**
- Create: `src/app/transactions/page.tsx`, `src/app/transactions/actions.ts`

**Interfaces:**
- Consumes: `prisma`, `formatEuro`, `signedAmount`, `DeleteButton`.
- Produces: `createTransaction`, `deleteTransaction` server actions.

- [ ] **Step 1: Server actions**

Create `src/app/transactions/actions.ts`:

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createTransaction(formData: FormData) {
  const amount = Number(formData.get("amount"));
  const date = new Date(String(formData.get("date")));
  const description = String(formData.get("description") ?? "").trim();
  const accountId = String(formData.get("accountId"));
  const categoryId = String(formData.get("categoryId"));

  if (Number.isNaN(amount) || amount <= 0)
    throw new Error("Bedrag moet een positief getal zijn");
  if (!description) throw new Error("Omschrijving is verplicht");

  await prisma.transaction.create({
    data: { amount, date, description, accountId, categoryId },
  });
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function deleteTransaction(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.transaction.delete({ where: { id } });
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}
```

- [ ] **Step 2: Page with filters**

Create `src/app/transactions/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { formatEuro, signedAmount } from "@/lib/money";
import { createTransaction, deleteTransaction } from "./actions";
import DeleteButton from "@/components/DeleteButton";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { accountId?: string; categoryId?: string; month?: string };
}) {
  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const where: Record<string, unknown> = {};
  if (searchParams.accountId) where.accountId = searchParams.accountId;
  if (searchParams.categoryId) where.categoryId = searchParams.categoryId;
  if (searchParams.month) {
    const [y, m] = searchParams.month.split("-").map(Number);
    where.date = {
      gte: new Date(y, m - 1, 1),
      lt: new Date(y, m, 1),
    };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: { account: true, category: true },
    orderBy: { date: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Transacties</h1>

      <form className="flex flex-wrap gap-2 rounded border bg-white p-3">
        <select name="accountId" defaultValue={searchParams.accountId ?? ""} className="rounded border px-2 py-1 text-sm">
          <option value="">Alle rekeningen</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select name="categoryId" defaultValue={searchParams.categoryId ?? ""} className="rounded border px-2 py-1 text-sm">
          <option value="">Alle categorieën</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input
          type="month"
          name="month"
          defaultValue={searchParams.month ?? ""}
          className="rounded border px-2 py-1 text-sm"
        />
        <button type="submit" className="rounded bg-gray-200 px-3 py-1 text-sm">
          Filteren
        </button>
      </form>

      <ul className="divide-y rounded border bg-white">
        {transactions.map((t) => (
          <li key={t.id} className="flex items-center justify-between p-3">
            <div>
              <p className="font-medium">{t.description}</p>
              <p className="text-sm text-gray-500">
                {t.date.toLocaleDateString("nl-NL")} · {t.account.name} ·{" "}
                {t.category.name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={
                  t.category.type === "INCOME"
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {formatEuro(signedAmount(Number(t.amount), t.category.type))}
              </span>
              <DeleteButton
                action={deleteTransaction}
                id={t.id}
                confirmMessage="Transactie verwijderen?"
              />
            </div>
          </li>
        ))}
        {transactions.length === 0 && (
          <li className="p-3 text-sm text-gray-500">Geen transacties gevonden.</li>
        )}
      </ul>

      <form
        action={createTransaction}
        className="grid grid-cols-2 gap-3 rounded border bg-white p-4"
      >
        <h2 className="col-span-2 font-medium">Nieuwe transactie</h2>
        <input name="date" type="date" required className="rounded border px-3 py-2" />
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="Bedrag"
          required
          className="rounded border px-3 py-2"
        />
        <input
          name="description"
          placeholder="Omschrijving"
          required
          className="col-span-2 rounded border px-3 py-2"
        />
        <select name="accountId" required className="rounded border px-3 py-2">
          <option value="">Kies rekening</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select name="categoryId" required className="rounded border px-3 py-2">
          <option value="">Kies categorie</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          type="submit"
          className="col-span-2 rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
        >
          Toevoegen
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`, go to `/transactions`. Add a transaction (bijv. €25,50, "Albert Heijn", Betaalrekening, Boodschappen). Confirm it appears with a red amount. Filter by category "Boodschappen" — expect only that transaction to show. Delete it.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add transactions CRUD with filters"
```

---

### Task 10: Recurring-rule generation logic (pure, unit tested)

**Files:**
- Create: `src/lib/recurring.ts`, `tests/recurring.test.ts`

**Interfaces:**
- Produces: `generateDueDates(rule, today): Date[]` — pure function, no I/O — consumed by Task 11's `syncRecurringTransactions`.

- [ ] **Step 1: Write the failing tests**

Create `tests/recurring.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateDueDates } from "@/lib/recurring";

describe("generateDueDates", () => {
  it("generates one date for the current month if never generated and day has passed", () => {
    const dates = generateDueDates(
      {
        dayOfMonth: 1,
        startDate: new Date(2026, 0, 1), // 1 jan 2026
        endDate: null,
        lastGeneratedOn: null,
      },
      new Date(2026, 0, 15), // 15 jan 2026
    );
    expect(dates).toEqual([new Date(2026, 0, 1)]);
  });

  it("does not generate a date for a day that hasn't passed yet this month", () => {
    const dates = generateDueDates(
      {
        dayOfMonth: 28,
        startDate: new Date(2026, 0, 1),
        endDate: null,
        lastGeneratedOn: null,
      },
      new Date(2026, 0, 15),
    );
    expect(dates).toEqual([]);
  });

  it("backfills multiple missed months", () => {
    const dates = generateDueDates(
      {
        dayOfMonth: 1,
        startDate: new Date(2026, 0, 1),
        endDate: null,
        lastGeneratedOn: null,
      },
      new Date(2026, 2, 15), // 15 mrt 2026, 3 maanden gemist
    );
    expect(dates).toEqual([
      new Date(2026, 0, 1),
      new Date(2026, 1, 1),
      new Date(2026, 2, 1),
    ]);
  });

  it("only generates months after lastGeneratedOn", () => {
    const dates = generateDueDates(
      {
        dayOfMonth: 1,
        startDate: new Date(2026, 0, 1),
        endDate: null,
        lastGeneratedOn: new Date(2026, 1, 1), // feb al gegenereerd
      },
      new Date(2026, 2, 15),
    );
    expect(dates).toEqual([new Date(2026, 2, 1)]);
  });

  it("stops generating after endDate", () => {
    const dates = generateDueDates(
      {
        dayOfMonth: 1,
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 1, 15), // eindigt half feb
        lastGeneratedOn: null,
      },
      new Date(2026, 2, 15),
    );
    expect(dates).toEqual([new Date(2026, 0, 1), new Date(2026, 1, 1)]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/recurring'`.

- [ ] **Step 3: Implement**

Create `src/lib/recurring.ts`:

```ts
export interface RecurringRuleLike {
  dayOfMonth: number;
  startDate: Date;
  endDate: Date | null;
  lastGeneratedOn: Date | null;
}

/**
 * Returns the list of due dates (one per month, on dayOfMonth) between
 * the later of startDate/lastGeneratedOn+1month and today (inclusive),
 * excluding any month whose due date is after endDate or in the future.
 */
export function generateDueDates(
  rule: RecurringRuleLike,
  today: Date,
): Date[] {
  const dates: Date[] = [];

  let cursorYear: number;
  let cursorMonth: number;

  if (rule.lastGeneratedOn) {
    cursorYear = rule.lastGeneratedOn.getFullYear();
    cursorMonth = rule.lastGeneratedOn.getMonth() + 1; // start the month after
  } else {
    cursorYear = rule.startDate.getFullYear();
    cursorMonth = rule.startDate.getMonth();
  }

  while (true) {
    const due = new Date(cursorYear, cursorMonth, rule.dayOfMonth);

    if (due > today) break;
    if (rule.endDate && due > rule.endDate) break;
    if (due >= rule.startDate) dates.push(due);

    cursorMonth += 1;
    if (cursorMonth > 11) {
      cursorMonth = 0;
      cursorYear += 1;
    }
  }

  return dates;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add recurring-rule due-date generation logic"
```

---

### Task 11: Recurring rules CRUD + wire generation into app load

**Files:**
- Create: `src/app/recurring/page.tsx`, `src/app/recurring/actions.ts`
- Modify: `src/lib/recurring.ts` (add `syncRecurringTransactions`), `src/app/dashboard/page.tsx` (created in Task 12 — note the dependency below)

**Interfaces:**
- Consumes: `generateDueDates` (Task 10), `prisma`.
- Produces: `syncRecurringTransactions(): Promise<void>`, called at the top of the dashboard's data loader (Task 12 must call this — documented here since Task 12 depends on it).

- [ ] **Step 1: Add the sync function to `src/lib/recurring.ts`**

Append to `src/lib/recurring.ts`:

```ts
import { prisma } from "@/lib/prisma";

export async function syncRecurringTransactions(): Promise<void> {
  const rules = await prisma.recurringRule.findMany();
  const today = new Date();

  for (const rule of rules) {
    const dueDates = generateDueDates(
      {
        dayOfMonth: rule.dayOfMonth,
        startDate: rule.startDate,
        endDate: rule.endDate,
        lastGeneratedOn: rule.lastGeneratedOn,
      },
      today,
    );
    if (dueDates.length === 0) continue;

    await prisma.$transaction([
      ...dueDates.map((date) =>
        prisma.transaction.create({
          data: {
            amount: rule.amount,
            date,
            description: rule.description,
            accountId: rule.accountId,
            categoryId: rule.categoryId,
          },
        }),
      ),
      prisma.recurringRule.update({
        where: { id: rule.id },
        data: { lastGeneratedOn: dueDates[dueDates.length - 1] },
      }),
    ]);
  }
}
```

- [ ] **Step 2: Server actions for CRUD**

Create `src/app/recurring/actions.ts`:

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createRecurringRule(formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const categoryId = String(formData.get("categoryId"));
  const accountId = String(formData.get("accountId"));
  const dayOfMonth = Number(formData.get("dayOfMonth"));
  const startDate = new Date(String(formData.get("startDate")));
  const endDateRaw = String(formData.get("endDate") ?? "");
  const endDate = endDateRaw ? new Date(endDateRaw) : null;

  if (!description) throw new Error("Omschrijving is verplicht");
  if (Number.isNaN(amount) || amount <= 0)
    throw new Error("Bedrag moet een positief getal zijn");
  if (dayOfMonth < 1 || dayOfMonth > 28)
    throw new Error("Dag van de maand moet tussen 1 en 28 liggen");

  await prisma.recurringRule.create({
    data: {
      description,
      amount,
      categoryId,
      accountId,
      dayOfMonth,
      startDate,
      endDate,
    },
  });
  revalidatePath("/recurring");
}

export async function deleteRecurringRule(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.recurringRule.delete({ where: { id } });
  revalidatePath("/recurring");
}
```

Note: `dayOfMonth` is capped at 28 to keep the pure `generateDueDates` logic simple and avoid month-length edge cases (Feb 30 doesn't exist) — this is a deliberate scope limit, not a bug.

- [ ] **Step 3: Page**

Create `src/app/recurring/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { formatEuro } from "@/lib/money";
import { createRecurringRule, deleteRecurringRule } from "./actions";
import DeleteButton from "@/components/DeleteButton";

export default async function RecurringPage() {
  const [rules, accounts, categories] = await Promise.all([
    prisma.recurringRule.findMany({
      include: { account: true, category: true },
      orderBy: { dayOfMonth: "asc" },
    }),
    prisma.account.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Terugkerende posten</h1>

      <ul className="divide-y rounded border bg-white">
        {rules.map((rule) => (
          <li key={rule.id} className="flex items-center justify-between p-3">
            <div>
              <p className="font-medium">{rule.description}</p>
              <p className="text-sm text-gray-500">
                Dag {rule.dayOfMonth} · {rule.account.name} · {rule.category.name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span>{formatEuro(Number(rule.amount))}</span>
              <DeleteButton
                action={deleteRecurringRule}
                id={rule.id}
                confirmMessage={`Terugkerende post "${rule.description}" stoppen?`}
              />
            </div>
          </li>
        ))}
        {rules.length === 0 && (
          <li className="p-3 text-sm text-gray-500">Nog geen terugkerende posten.</li>
        )}
      </ul>

      <form
        action={createRecurringRule}
        className="grid grid-cols-2 gap-3 rounded border bg-white p-4"
      >
        <h2 className="col-span-2 font-medium">Nieuwe terugkerende post</h2>
        <input
          name="description"
          placeholder="Omschrijving (bijv. Huur)"
          required
          className="col-span-2 rounded border px-3 py-2"
        />
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="Bedrag"
          required
          className="rounded border px-3 py-2"
        />
        <input
          name="dayOfMonth"
          type="number"
          min="1"
          max="28"
          placeholder="Dag van de maand"
          required
          className="rounded border px-3 py-2"
        />
        <select name="accountId" required className="rounded border px-3 py-2">
          <option value="">Kies rekening</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select name="categoryId" required className="rounded border px-3 py-2">
          <option value="">Kies categorie</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="text-sm text-gray-600">
          Startdatum
          <input name="startDate" type="date" required className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="text-sm text-gray-600">
          Einddatum (optioneel)
          <input name="endDate" type="date" className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <button
          type="submit"
          className="col-span-2 rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
        >
          Toevoegen
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Manual verification (deferred)**

Full verification of the auto-generation (`syncRecurringTransactions` being called on app load) happens in Task 12, once the dashboard page exists and calls it. For now: run `npm run dev`, go to `/recurring`, add a rule with `startDate` a few days in the past and `dayOfMonth` before today — confirm it saves and appears in the list.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add recurring rules CRUD and generation sync"
```

---

### Task 12: Dashboard with aggregations and charts

**Files:**
- Create: `src/app/dashboard/page.tsx`, `src/app/dashboard/BudgetBar.tsx`, `src/app/dashboard/Charts.tsx`

**Interfaces:**
- Consumes: `prisma`, `formatEuro`, `signedAmount`, `syncRecurringTransactions` (Task 11).
- Produces: the `/dashboard` route, the app's landing page after login.

- [ ] **Step 1: Install Recharts**

```bash
npm install recharts
```

- [ ] **Step 2: Client component for charts**

Create `src/app/dashboard/Charts.tsx`:

```tsx
"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export function CategoryPieChart({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  if (data.length === 0)
    return <p className="text-sm text-gray-500">Nog geen uitgaven deze maand.</p>;
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => `€ ${value.toFixed(2)}`} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TrendLineChart({
  data,
}: {
  data: { month: string; inkomsten: number; uitgaven: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(value: number) => `€ ${value.toFixed(2)}`} />
        <Line type="monotone" dataKey="inkomsten" stroke="#16A34A" />
        <Line type="monotone" dataKey="uitgaven" stroke="#DC2626" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Budget progress bar component**

Create `src/app/dashboard/BudgetBar.tsx`:

```tsx
import { formatEuro } from "@/lib/money";

export default function BudgetBar({
  name,
  spent,
  budget,
  color,
}: {
  name: string;
  spent: number;
  budget: number;
  color: string;
}) {
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const over = spent > budget;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{name}</span>
        <span className={over ? "text-red-600" : "text-gray-600"}>
          {formatEuro(spent)} / {formatEuro(budget)}
        </span>
      </div>
      <div className="mt-1 h-2 w-full rounded bg-gray-200">
        <div
          className="h-2 rounded"
          style={{ width: `${pct}%`, backgroundColor: over ? "#DC2626" : color }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Dashboard page (server component, does the aggregation)**

Create `src/app/dashboard/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { formatEuro, signedAmount } from "@/lib/money";
import { syncRecurringTransactions } from "@/lib/recurring";
import { CategoryPieChart, TrendLineChart } from "./Charts";
import BudgetBar from "./BudgetBar";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function DashboardPage() {
  await syncRecurringTransactions();

  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [accounts, thisMonthTx, trendTx, budgets] = await Promise.all([
    prisma.account.findMany({
      include: { transactions: { include: { category: true } } },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: monthStart, lt: nextMonthStart } },
      include: { category: true },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: sixMonthsAgo, lt: nextMonthStart } },
      include: { category: true },
    }),
    prisma.budget.findMany({ include: { category: true } }),
  ]);

  const totalBalance = accounts.reduce((sum, account) => {
    const accountTotal = account.transactions.reduce(
      (s, t) => s + signedAmount(Number(t.amount), t.category.type),
      0,
    );
    return sum + Number(account.startBalance) + accountTotal;
  }, 0);

  const income = thisMonthTx
    .filter((t) => t.category.type === "INCOME")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = thisMonthTx
    .filter((t) => t.category.type === "EXPENSE")
    .reduce((s, t) => s + Number(t.amount), 0);

  const expenseByCategory = new Map<
    string,
    { name: string; value: number; color: string }
  >();
  for (const t of thisMonthTx) {
    if (t.category.type !== "EXPENSE") continue;
    const existing = expenseByCategory.get(t.categoryId);
    if (existing) {
      existing.value += Number(t.amount);
    } else {
      expenseByCategory.set(t.categoryId, {
        name: t.category.name,
        value: Number(t.amount),
        color: t.category.color,
      });
    }
  }

  const trendByMonth = new Map<
    string,
    { month: string; inkomsten: number; uitgaven: number }
  >();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key = d.toLocaleDateString("nl-NL", { month: "short", year: "2-digit" });
    trendByMonth.set(key, { month: key, inkomsten: 0, uitgaven: 0 });
  }
  for (const t of trendTx) {
    const key = t.date.toLocaleDateString("nl-NL", {
      month: "short",
      year: "2-digit",
    });
    const bucket = trendByMonth.get(key);
    if (!bucket) continue;
    if (t.category.type === "INCOME") bucket.inkomsten += Number(t.amount);
    else bucket.uitgaven += Number(t.amount);
  }

  const spentByCategory = new Map<string, number>();
  for (const t of thisMonthTx) {
    if (t.category.type !== "EXPENSE") continue;
    spentByCategory.set(
      t.categoryId,
      (spentByCategory.get(t.categoryId) ?? 0) + Number(t.amount),
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded border bg-white p-4">
          <p className="text-sm text-gray-500">Totaalsaldo</p>
          <p className="text-2xl font-semibold">{formatEuro(totalBalance)}</p>
        </div>
        <div className="rounded border bg-white p-4">
          <p className="text-sm text-gray-500">Inkomsten deze maand</p>
          <p className="text-2xl font-semibold text-green-600">
            {formatEuro(income)}
          </p>
        </div>
        <div className="rounded border bg-white p-4">
          <p className="text-sm text-gray-500">Uitgaven deze maand</p>
          <p className="text-2xl font-semibold text-red-600">
            {formatEuro(expense)}
          </p>
        </div>
      </div>

      <div className="rounded border bg-white p-4">
        <h2 className="mb-2 font-medium">Uitgaven per categorie</h2>
        <CategoryPieChart data={[...expenseByCategory.values()]} />
      </div>

      <div className="rounded border bg-white p-4">
        <h2 className="mb-2 font-medium">Trend (6 maanden)</h2>
        <TrendLineChart data={[...trendByMonth.values()]} />
      </div>

      <div className="space-y-3 rounded border bg-white p-4">
        <h2 className="font-medium">Budgetten</h2>
        {budgets.map((b) => (
          <BudgetBar
            key={b.id}
            name={b.category.name}
            spent={spentByCategory.get(b.categoryId) ?? 0}
            budget={Number(b.amount)}
            color={b.category.color}
          />
        ))}
        {budgets.length === 0 && (
          <p className="text-sm text-gray-500">Nog geen budgetten ingesteld.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Manual verification**

Run `npm run dev`, log in — expect landing on `/dashboard` with the totals, pie chart, trend chart, and budget bars all rendering without errors (empty states are fine if there's little data yet). Go back to `/recurring`, add a rule dated a few days in the past, then revisit `/dashboard` — expect the rule to have generated a transaction automatically (check `/transactions` to confirm it appeared), and expect it to NOT generate a duplicate on a second dashboard visit.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add dashboard with balances, charts, and budget progress"
```

---

### Task 13: CSV parsing, category matching, duplicate detection (pure, unit tested)

**Files:**
- Create: `src/lib/csv/ing-parser.ts`, `src/lib/csv/category-match.ts`, `src/lib/csv/duplicate-detect.ts`, `tests/ing-parser.test.ts`, `tests/category-match.test.ts`, `tests/duplicate-detect.test.ts`

**Interfaces:**
- Produces:
  - `parseIngCsv(fileContent: string): ParsedRow[]` where `ParsedRow = { date: Date; description: string; amount: number; direction: "IN" | "AF" }`
  - `matchCategory(description: string, rules: { keyword: string; categoryId: string }[], direction: "IN" | "AF"): string | null`
  - `markDuplicates<T extends { date: Date; description: string; amount: number }>(rows: T[], existing: { date: Date; description: string; amount: number }[]): (T & { isDuplicate: boolean })[]`
- Consumed by Task 14's import preview/confirm actions.

- [ ] **Step 1: Install papaparse**

```bash
npm install papaparse
npm install -D @types/papaparse
```

- [ ] **Step 2: Write the failing CSV-parser test**

Create `tests/ing-parser.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseIngCsv } from "@/lib/csv/ing-parser";

const sampleCsv =
  '"Datum","Naam / Omschrijving","Rekening","Tegenrekening","Code","Af Bij","Bedrag (EUR)","Mutatiesoort","Mededelingen"\n' +
  '"20260115","ALBERT HEIJN 1234","NL01INGB0001234567","NL02ABNA0009876543","BA","Af","25,50","Betaalautomaat","Pasvolgnr: 001"\n' +
  '"20260201","WERKGEVER BV","NL01INGB0001234567","NL03RABO0001112223","OV","Bij","2500,00","Overschrijving","Salaris januari"\n';

const sampleCsvWithInvalidRow =
  '"Datum","Naam / Omschrijving","Rekening","Tegenrekening","Code","Af Bij","Bedrag (EUR)","Mutatiesoort","Mededelingen"\n' +
  '"20260115","ALBERT HEIJN 1234","NL01INGB0001234567","NL02ABNA0009876543","BA","Af","25,50","Betaalautomaat","Pasvolgnr: 001"\n' +
  '"20260116","KAPOTTE RIJ","NL01INGB0001234567","NL02ABNA0009876543","BA","Af","","Betaalautomaat","geen bedrag"\n';

describe("parseIngCsv", () => {
  it("parses ING rows into structured transactions", () => {
    const rows = parseIngCsv(sampleCsv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      date: new Date(2026, 0, 15),
      description: "ALBERT HEIJN 1234",
      amount: 25.5,
      direction: "AF",
      valid: true,
    });
    expect(rows[1]).toEqual({
      date: new Date(2026, 1, 1),
      description: "WERKGEVER BV",
      amount: 2500,
      direction: "IN",
      valid: true,
    });
  });

  it("throws a clear error for an unrecognized format", () => {
    expect(() => parseIngCsv("kolom1,kolom2\nwaarde1,waarde2\n")).toThrow(
      /ING/,
    );
  });

  it("marks a row with an unparseable amount as invalid instead of crashing", () => {
    const rows = parseIngCsv(sampleCsvWithInvalidRow);
    expect(rows).toHaveLength(2);
    expect(rows[0].valid).toBe(true);
    expect(rows[1].valid).toBe(false);
    expect(rows[1].description).toBe("KAPOTTE RIJ");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/csv/ing-parser'`.

- [ ] **Step 4: Implement the ING parser**

Create `src/lib/csv/ing-parser.ts`:

```ts
import Papa from "papaparse";

export interface ParsedRow {
  date: Date;
  description: string;
  amount: number;
  direction: "IN" | "AF";
  /** false if the amount or date on this row could not be parsed */
  valid: boolean;
}

const REQUIRED_COLUMNS = [
  "Datum",
  "Naam / Omschrijving",
  "Af Bij",
  "Bedrag (EUR)",
];

export function parseIngCsv(fileContent: string): ParsedRow[] {
  const result = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: true,
  });

  const columns = result.meta.fields ?? [];
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length > 0) {
    throw new Error(
      `Onherkend CSV-formaat: dit lijkt geen ING-export te zijn (ontbrekende kolommen: ${missing.join(", ")}).`,
    );
  }

  return result.data.map((row) => {
    const dateStr = row["Datum"] ?? ""; // YYYYMMDD
    const year = Number(dateStr.slice(0, 4));
    const month = Number(dateStr.slice(4, 6)) - 1;
    const day = Number(dateStr.slice(6, 8));
    const date = new Date(year, month, day);

    const amountStr = (row["Bedrag (EUR)"] ?? "").replace(",", ".");
    const amount = Number(amountStr);
    const direction = row["Af Bij"] === "Bij" ? "IN" : "AF";

    const valid =
      amountStr !== "" && !Number.isNaN(amount) && !Number.isNaN(date.getTime());

    return {
      date,
      description: row["Naam / Omschrijving"] ?? "",
      amount,
      direction,
      valid,
    };
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Write the failing category-match test**

Create `tests/category-match.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { matchCategory } from "@/lib/csv/category-match";
import {
  FALLBACK_INCOME_CATEGORY_ID,
  FALLBACK_EXPENSE_CATEGORY_ID,
} from "@/lib/constants";

const rules = [
  { keyword: "Albert Heijn", categoryId: "cat_boodschappen" },
  { keyword: "werkgever", categoryId: "cat_salaris" },
];

describe("matchCategory", () => {
  it("matches case-insensitively on a keyword contained in the description", () => {
    expect(
      matchCategory("ALBERT HEIJN 1234", rules, "AF"),
    ).toBe("cat_boodschappen");
  });

  it("matches a different keyword case-insensitively", () => {
    expect(matchCategory("WERKGEVER BV", rules, "IN")).toBe("cat_salaris");
  });

  it("falls back to the expense fallback category for AF with no match", () => {
    expect(matchCategory("ONBEKENDE WINKEL", rules, "AF")).toBe(
      FALLBACK_EXPENSE_CATEGORY_ID,
    );
  });

  it("falls back to the income fallback category for IN with no match", () => {
    expect(matchCategory("ONBEKENDE BRON", rules, "IN")).toBe(
      FALLBACK_INCOME_CATEGORY_ID,
    );
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/csv/category-match'`.

- [ ] **Step 8: Implement**

Create `src/lib/csv/category-match.ts`:

```ts
import {
  FALLBACK_INCOME_CATEGORY_ID,
  FALLBACK_EXPENSE_CATEGORY_ID,
} from "@/lib/constants";

export function matchCategory(
  description: string,
  rules: { keyword: string; categoryId: string }[],
  direction: "IN" | "AF",
): string {
  const lowerDescription = description.toLowerCase();
  const match = rules.find((rule) =>
    lowerDescription.includes(rule.keyword.toLowerCase()),
  );
  if (match) return match.categoryId;
  return direction === "IN"
    ? FALLBACK_INCOME_CATEGORY_ID
    : FALLBACK_EXPENSE_CATEGORY_ID;
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 10: Write the failing duplicate-detection test**

Create `tests/duplicate-detect.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { markDuplicates } from "@/lib/csv/duplicate-detect";

describe("markDuplicates", () => {
  const existing = [
    { date: new Date(2026, 0, 15), description: "ALBERT HEIJN 1234", amount: 25.5 },
  ];

  it("marks an exact match as a duplicate", () => {
    const rows = [
      { date: new Date(2026, 0, 15), description: "ALBERT HEIJN 1234", amount: 25.5 },
    ];
    const result = markDuplicates(rows, existing);
    expect(result[0].isDuplicate).toBe(true);
  });

  it("does not mark a row with a different amount as a duplicate", () => {
    const rows = [
      { date: new Date(2026, 0, 15), description: "ALBERT HEIJN 1234", amount: 30 },
    ];
    const result = markDuplicates(rows, existing);
    expect(result[0].isDuplicate).toBe(false);
  });

  it("does not mark a row with a different date as a duplicate", () => {
    const rows = [
      { date: new Date(2026, 0, 16), description: "ALBERT HEIJN 1234", amount: 25.5 },
    ];
    const result = markDuplicates(rows, existing);
    expect(result[0].isDuplicate).toBe(false);
  });
});
```

- [ ] **Step 11: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/csv/duplicate-detect'`.

- [ ] **Step 12: Implement**

Create `src/lib/csv/duplicate-detect.ts`:

```ts
export function markDuplicates<
  T extends { date: Date; description: string; amount: number },
>(
  rows: T[],
  existing: { date: Date; description: string; amount: number }[],
): (T & { isDuplicate: boolean })[] {
  return rows.map((row) => {
    const isDuplicate = existing.some(
      (e) =>
        e.date.getTime() === row.date.getTime() &&
        e.description === row.description &&
        e.amount === row.amount,
    );
    return { ...row, isDuplicate };
  });
}
```

- [ ] **Step 13: Run all tests to verify they pass**

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: add ING CSV parsing, category matching, and duplicate detection"
```

---

### Task 14: Category rules management + CSV import preview/confirm UI

**Files:**
- Modify: `src/app/categories/page.tsx`, `src/app/categories/actions.ts` (add category-rule management)
- Create: `src/app/import/page.tsx`, `src/app/import/actions.ts`, `src/app/import/ImportForm.tsx`

**Interfaces:**
- Consumes: `parseIngCsv`, `matchCategory`, `markDuplicates` (Task 13), `prisma`.
- Produces: `previewImport(formData): Promise<PreviewRow[]>` and `confirmImport(accountId, rows): Promise<void>` server actions.

- [ ] **Step 1: Add category-rule actions**

Append to `src/app/categories/actions.ts`:

```ts
export async function createCategoryRule(formData: FormData) {
  const keyword = String(formData.get("keyword") ?? "").trim();
  const categoryId = String(formData.get("categoryId"));
  if (!keyword) throw new Error("Trefwoord is verplicht");

  await prisma.categoryRule.create({ data: { keyword, categoryId } });
  revalidatePath("/categories");
}

export async function deleteCategoryRule(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.categoryRule.delete({ where: { id } });
  revalidatePath("/categories");
}
```

- [ ] **Step 2: Add category-rule section to the categories page**

In `src/app/categories/page.tsx`, add the import and query, and a new section at the bottom of the returned JSX (before the closing `</div>`):

```tsx
import { createCategoryRule, deleteCategoryRule } from "./actions";
```

Inside `CategoriesPage`, alongside the existing `categories` query, add:

```tsx
const [rules] = await Promise.all([
  prisma.categoryRule.findMany({
    include: { category: true },
    orderBy: { keyword: "asc" },
  }),
]);
```

(Merge this into the existing single `prisma.category.findMany(...)` call site by adding a second query rather than replacing it — i.e. keep `categories` as-is and add `rules` alongside it.)

Add this JSX block after the "Nieuwe categorie" form:

```tsx
<div className="space-y-3 rounded border bg-white p-4">
  <h2 className="font-medium">Categorisatieregels (voor CSV-import)</h2>
  <ul className="divide-y">
    {rules.map((rule) => (
      <li key={rule.id} className="flex items-center justify-between py-2">
        <span className="text-sm">
          "{rule.keyword}" → {rule.category.name}
        </span>
        <DeleteButton
          action={deleteCategoryRule}
          id={rule.id}
          confirmMessage={`Regel "${rule.keyword}" verwijderen?`}
        />
      </li>
    ))}
    {rules.length === 0 && (
      <li className="py-2 text-sm text-gray-500">Nog geen regels.</li>
    )}
  </ul>
  <form action={createCategoryRule} className="flex gap-2">
    <input
      name="keyword"
      placeholder="Trefwoord (bijv. Albert Heijn)"
      required
      className="flex-1 rounded border px-3 py-2 text-sm"
    />
    <select name="categoryId" required className="rounded border px-3 py-2 text-sm">
      <option value="">Kies categorie</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
    <button type="submit" className="rounded bg-blue-600 px-3 py-2 text-sm text-white">
      Toevoegen
    </button>
  </form>
</div>
```

- [ ] **Step 3: Preview and confirm server actions**

Create `src/app/import/actions.ts`:

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseIngCsv } from "@/lib/csv/ing-parser";
import { matchCategory } from "@/lib/csv/category-match";
import { markDuplicates } from "@/lib/csv/duplicate-detect";

export interface PreviewRow {
  date: string; // ISO date, easy to round-trip through a hidden form field
  description: string;
  amount: number;
  direction: "IN" | "AF";
  categoryId: string;
  categoryName: string;
  isDuplicate: boolean;
  valid: boolean;
}

export async function previewImport(
  formData: FormData,
): Promise<{ rows: PreviewRow[]; error: string | null }> {
  const file = formData.get("file") as File | null;
  if (!file) return { rows: [], error: "Geen bestand geselecteerd." };

  const text = await file.text();

  let parsed;
  try {
    parsed = parseIngCsv(text);
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  }

  const [rules, categories, existing] = await Promise.all([
    prisma.categoryRule.findMany(),
    prisma.category.findMany(),
    prisma.transaction.findMany({
      select: { date: true, description: true, amount: true },
    }),
  ]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const existingPlain = existing.map((t) => ({
    date: t.date,
    description: t.description,
    amount: Number(t.amount),
  }));

  const withDuplicates = markDuplicates(parsed, existingPlain);

  const rows: PreviewRow[] = withDuplicates.map((row) => {
    if (!row.valid) {
      return {
        date: Number.isNaN(row.date.getTime()) ? "" : row.date.toISOString(),
        description: row.description,
        amount: row.amount,
        direction: row.direction,
        categoryId: "",
        categoryName: "-",
        isDuplicate: false,
        valid: false,
      };
    }
    const categoryId = matchCategory(row.description, rules, row.direction);
    return {
      date: row.date.toISOString(),
      description: row.description,
      amount: row.amount,
      direction: row.direction,
      categoryId,
      categoryName: categoryNameById.get(categoryId) ?? "Onbekend",
      isDuplicate: row.isDuplicate,
      valid: true,
    };
  });

  return { rows, error: null };
}

export async function confirmImport(accountId: string, rows: PreviewRow[]) {
  const toImport = rows.filter((r) => r.valid && !r.isDuplicate);

  await prisma.transaction.createMany({
    data: toImport.map((r) => ({
      amount: r.amount,
      date: new Date(r.date),
      description: r.description,
      accountId,
      categoryId: r.categoryId,
    })),
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
}
```

- [ ] **Step 4: Client component driving preview → confirm**

Create `src/app/import/ImportForm.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { previewImport, confirmImport, type PreviewRow } from "./actions";

export default function ImportForm({
  accounts,
}: {
  accounts: { id: string; name: string }[];
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handlePreview(formData: FormData) {
    setError(null);
    setDone(false);
    const result = await previewImport(formData);
    if (result.error) {
      setError(result.error);
      setRows(null);
    } else {
      setRows(result.rows);
    }
  }

  function handleConfirm() {
    if (!rows) return;
    startTransition(async () => {
      await confirmImport(accountId, rows);
      setDone(true);
      setRows(null);
    });
  }

  const importableCount =
    rows?.filter((r) => r.valid && !r.isDuplicate).length ?? 0;
  const duplicateCount = rows?.filter((r) => r.valid && r.isDuplicate).length ?? 0;
  const invalidCount = rows?.filter((r) => !r.valid).length ?? 0;

  return (
    <div className="space-y-4">
      <form action={handlePreview} className="space-y-3 rounded border bg-white p-4">
        <label className="block text-sm">
          Rekening
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <input type="file" name="file" accept=".csv" required className="block" />
        <button type="submit" className="rounded bg-blue-600 px-3 py-2 text-white">
          Bekijk voorbeeld
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-600">Import voltooid.</p>}

      {rows && (
        <div className="space-y-3 rounded border bg-white p-4">
          <p className="text-sm text-gray-600">
            {importableCount} transacties worden geïmporteerd, {duplicateCount}{" "}
            duplicaten en {invalidCount} ongeldige rijen worden overgeslagen.
          </p>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-1">Datum</th>
                  <th>Omschrijving</th>
                  <th>Bedrag</th>
                  <th>Categorie</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={
                      !row.valid || row.isDuplicate ? "text-gray-400" : ""
                    }
                  >
                    <td className="py-1">
                      {row.date ? new Date(row.date).toLocaleDateString("nl-NL") : "-"}
                    </td>
                    <td>{row.description}</td>
                    <td>€ {row.amount.toFixed(2)}</td>
                    <td>{row.categoryName}</td>
                    <td>
                      {!row.valid
                        ? "Overgeslagen: ongeldig"
                        : row.isDuplicate
                          ? "Duplicaat (overslaan)"
                          : "Nieuw"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleConfirm}
            disabled={isPending || importableCount === 0}
            className="rounded bg-green-600 px-3 py-2 text-white disabled:opacity-50"
          >
            {isPending ? "Bezig..." : `Importeer ${importableCount} transacties`}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Import page**

Create `src/app/import/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import ImportForm from "./ImportForm";

export default async function ImportPage() {
  const accounts = await prisma.account.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">CSV importeren (ING)</h1>
      {accounts.length === 0 ? (
        <p className="text-sm text-gray-500">
          Maak eerst een rekening aan op de pagina "Rekeningen".
        </p>
      ) : (
        <ImportForm accounts={accounts} />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Manual verification**

Run `npm run dev`. On `/categories`, add a rule "Albert Heijn" → Boodschappen. Export a small real (or hand-crafted, matching the sample format from Task 13's test) ING CSV, save it as `test.csv`. Go to `/import`, pick your bank account, upload `test.csv` — expect a preview table showing recognized categories and any duplicates greyed out. Click "Importeer" — expect a success message, and confirm the new transactions show up on `/transactions` and are reflected in `/dashboard`. Re-upload the same file — expect every row to now show as a duplicate and the confirm button to import 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add category rules and CSV import preview/confirm flow"
```

---

### Task 15: Final deploy verification + README

**Files:**
- Create: `README.md`

**Interfaces:** none — closing task.

- [ ] **Step 1: Push and confirm the Vercel deploy**

```bash
git push
```

Confirm in the Vercel dashboard that the deploy succeeds. Confirm `APP_PASSWORD_HASH` and `SESSION_SECRET` are set in Vercel's environment variables (added in Tasks 5/6) — if not, add them now and redeploy.

- [ ] **Step 2: Smoke test the live deployment**

Visit the Vercel deployment URL. Log in with the real password. Walk through: add an account, add a category with a budget, add a transaction, add a recurring rule, check the dashboard renders, import a small CSV. Confirm nothing errors and data persists across a page reload.

- [ ] **Step 3: Write the README**

Create `README.md`:

```markdown
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

\`\`\`bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash(process.argv[1], 12).then(h => console.log(h))" "NIEUW-WACHTWOORD"
\`\`\`

## CSV-import

Ondersteunt alleen het ING-exportformaat. Categorisatieregels beheer je op
de pagina "Categorieën".
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: add README"
git push
```
