# Transactie Bewerken Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Jelmer fully edit an existing transaction (date, amount, description, account, category) inline in the transactions list, and optionally have a category change automatically remembered as a `CategoryRule` for future CSV imports.

**Architecture:** A new `updateTransaction` Server Action mirrors the existing `createTransaction` (same validation, same Dutch error messages), plus an optional atomic `CategoryRule` upsert when the user opts in. The transaction list's per-row markup moves into a new `TransactionRow` client component that toggles between a display view and an inline edit form — no new pages, no new routes.

**Tech Stack:** Next.js 16 (App Router) Server Actions, Prisma + Neon Postgres, Vitest for the one new pure-logic addition.

## Global Constraints

- All UI text in Dutch, matching existing copy style (e.g. "Bedrag moet een positief getal zijn", "Omschrijving is verplicht").
- Money via `formatEuro`/`signedAmount` from `@/lib/money` (existing, unchanged).
- Dates parsed from `<input type="date">` values via `parseLocalDate` from `@/lib/date` (existing) — never `new Date(string)`, which parses as UTC and causes off-by-one-day bugs against this app's local-time comparisons (a real bug fixed earlier in this project).
- `DeleteButton` (`src/components/DeleteButton.tsx`) reused as-is: `action`, `id`, `confirmMessage` props — do not modify it.
- Errors surface by throwing `Error` from Server Actions, exactly like every existing action in this app (`createTransaction`, `deleteCategory`, etc.) — no custom error UI, no try/catch swallowing.
- No automated tests for CRUD/UI (project convention) — only the one pure `src/lib` addition in Task 1 gets a Vitest test, following TDD.
- `CategoryRule` keyword matching for the "remember" feature must be case-insensitive (Prisma's `mode: "insensitive"` on PostgreSQL) so it doesn't create near-duplicate rules that differ only in case.

---

## File Structure

```
src/
  lib/
    date.ts                     (MODIFY: add formatDateInputValue)
  app/
    transactions/
      actions.ts                 (MODIFY: add updateTransaction)
      page.tsx                   (MODIFY: render TransactionRow instead of inline <li>)
      TransactionRow.tsx          (CREATE: client component, display/edit toggle)
tests/
  date.test.ts                   (CREATE)
```

---

### Task 1: Local-date formatting helper (pure, unit tested)

**Files:**
- Modify: `src/lib/date.ts`
- Create: `tests/date.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `formatDateInputValue(date: Date): string` — the inverse of the existing `parseLocalDate`, formats a `Date` back to a `"YYYY-MM-DD"` string using **local** calendar components (not `toISOString()`, which would shift the date by a day for any Date originally built from local components in a positive-UTC-offset timezone like the Netherlands — exactly the class of bug this project already found and fixed once). Task 2's edit form uses this to pre-fill the date input.

- [ ] **Step 1: Write the failing tests**

Read the current file first:

```bash
cat src/lib/date.ts
```

It currently contains only `parseLocalDate`. Create `tests/date.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseLocalDate, formatDateInputValue } from "@/lib/date";

describe("parseLocalDate", () => {
  it("parses a YYYY-MM-DD string as local-time midnight", () => {
    const date = parseLocalDate("2026-07-15");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6); // 0-indexed: July
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(0);
  });
});

describe("formatDateInputValue", () => {
  it("formats a local Date back to YYYY-MM-DD using local components", () => {
    const date = new Date(2026, 6, 15); // 15 juli 2026, local midnight
    expect(formatDateInputValue(date)).toBe("2026-07-15");
  });

  it("round-trips with parseLocalDate", () => {
    const original = "2026-01-05";
    expect(formatDateInputValue(parseLocalDate(original))).toBe(original);
  });

  it("pads single-digit month and day with a leading zero", () => {
    const date = new Date(2026, 0, 3); // 3 januari 2026
    expect(formatDateInputValue(date)).toBe("2026-01-03");
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run tests/date.test.ts`
Expected: the `parseLocalDate` test passes (already implemented); all three `formatDateInputValue` tests FAIL with `formatDateInputValue is not a function` or similar.

- [ ] **Step 3: Implement**

Add to `src/lib/date.ts` (append below the existing `parseLocalDate`, keep that function unchanged):

```ts
export function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/date.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: PASS (30 tests — 26 existing + 4 new).

- [ ] **Step 6: Commit**

```bash
git add src/lib/date.ts tests/date.test.ts
git commit -m "feat: add formatDateInputValue local-date formatting helper"
```

---

### Task 2: Transaction editing + auto-remember category rule

**Files:**
- Modify: `src/app/transactions/actions.ts` (add `updateTransaction`)
- Modify: `src/app/transactions/page.tsx` (render `TransactionRow` per transaction)
- Create: `src/app/transactions/TransactionRow.tsx`

**Interfaces:**
- Consumes: `parseLocalDate`, `formatDateInputValue` (Task 1, `@/lib/date`), `formatEuro`, `signedAmount` (`@/lib/money`), `DeleteButton` (`@/components/DeleteButton`), `deleteTransaction` (existing, unchanged).
- Produces: `updateTransaction(formData: FormData): Promise<void>` exported from `src/app/transactions/actions.ts`; `TransactionRow` component exported (default) from `src/app/transactions/TransactionRow.tsx`, props `{ transaction, accounts, categories }` (exact shape below).

- [ ] **Step 1: Read the current files**

```bash
cat src/app/transactions/actions.ts
cat src/app/transactions/page.tsx
```

Confirm `createTransaction`/`deleteTransaction` and the current `page.tsx` structure match what's described below — the current `page.tsx` renders each transaction as an inline `<li>` inside a `<ul>`; this task replaces that `<li>` with `<TransactionRow>`.

- [ ] **Step 2: Add `updateTransaction` to `src/app/transactions/actions.ts`**

`parseLocalDate` is already imported from `"@/lib/date"` at the top of this file (added by an earlier fix) — no import changes needed. Just append this function to the file (after `deleteTransaction`):

```ts
export async function updateTransaction(formData: FormData) {
  const id = String(formData.get("id"));
  const amount = Number(formData.get("amount"));
  const date = parseLocalDate(String(formData.get("date")));
  const description = String(formData.get("description") ?? "").trim();
  const accountId = String(formData.get("accountId"));
  const categoryId = String(formData.get("categoryId"));
  const rememberKeyword = String(formData.get("rememberKeyword") ?? "").trim();

  if (Number.isNaN(amount) || amount <= 0)
    throw new Error("Bedrag moet een positief getal zijn");
  if (!description) throw new Error("Omschrijving is verplicht");

  const updateTx = prisma.transaction.update({
    where: { id },
    data: { amount, date, description, accountId, categoryId },
  });

  if (!rememberKeyword) {
    await updateTx;
  } else {
    const existingRule = await prisma.categoryRule.findFirst({
      where: { keyword: { equals: rememberKeyword, mode: "insensitive" } },
    });
    const upsertRule = existingRule
      ? prisma.categoryRule.update({
          where: { id: existingRule.id },
          data: { categoryId },
        })
      : prisma.categoryRule.create({
          data: { keyword: rememberKeyword, categoryId },
        });
    await prisma.$transaction([updateTx, upsertRule]);
  }

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/categories");
}
```

Note: `prisma.transaction.update(...)` called without `await` builds a deferred query object (a `PrismaPromise`) — it does not execute until awaited directly or passed into `prisma.$transaction([...])`. Building it once and using it either way (as done here) is the correct, standard Prisma pattern — do not call `.update(...)` a second time for the two branches.

- [ ] **Step 3: Create `src/app/transactions/TransactionRow.tsx`**

```tsx
"use client";

import { useState } from "react";
import { updateTransaction, deleteTransaction } from "./actions";
import DeleteButton from "@/components/DeleteButton";
import { formatEuro, signedAmount } from "@/lib/money";
import { formatDateInputValue } from "@/lib/date";

type Account = { id: string; name: string };
type Category = { id: string; name: string; type: "INCOME" | "EXPENSE" };
type Transaction = {
  id: string;
  amount: number;
  date: Date;
  description: string;
  accountId: string;
  categoryId: string;
  account: Account;
  category: Category;
};

export default function TransactionRow({
  transaction,
  accounts,
  categories,
}: {
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
}) {
  const [editing, setEditing] = useState(false);
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [remember, setRemember] = useState(false);

  if (!editing) {
    return (
      <li className="flex items-center justify-between p-3">
        <div>
          <p className="font-medium">{transaction.description}</p>
          <p className="text-sm text-gray-500">
            {transaction.date.toLocaleDateString("nl-NL")} ·{" "}
            {transaction.account.name} · {transaction.category.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={
              transaction.category.type === "INCOME"
                ? "text-green-600"
                : "text-red-600"
            }
          >
            {formatEuro(signedAmount(transaction.amount, transaction.category.type))}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm text-blue-600 hover:underline"
          >
            Bewerken
          </button>
          <DeleteButton
            action={deleteTransaction}
            id={transaction.id}
            confirmMessage="Transactie verwijderen?"
          />
        </div>
      </li>
    );
  }

  const categoryChanged = categoryId !== transaction.categoryId;

  return (
    <li className="p-3">
      <form
        action={async (formData) => {
          await updateTransaction(formData);
          setEditing(false);
        }}
        className="grid grid-cols-2 gap-2"
      >
        <input type="hidden" name="id" value={transaction.id} />
        <input
          name="date"
          type="date"
          defaultValue={formatDateInputValue(transaction.date)}
          required
          className="rounded border px-2 py-1 text-sm"
        />
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={transaction.amount}
          required
          className="rounded border px-2 py-1 text-sm"
        />
        <input
          name="description"
          defaultValue={transaction.description}
          required
          className="col-span-2 rounded border px-2 py-1 text-sm"
        />
        <select
          name="accountId"
          defaultValue={transaction.accountId}
          required
          className="rounded border px-2 py-1 text-sm"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          name="categoryId"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
          className="rounded border px-2 py-1 text-sm"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {categoryChanged && (
          <div className="col-span-2 flex items-center gap-2 rounded bg-gray-50 p-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Onthoud dit voor toekomstige imports
            </label>
            {remember && (
              <input
                name="rememberKeyword"
                defaultValue={transaction.description}
                placeholder="Trefwoord"
                required
                className="flex-1 rounded border px-2 py-1 text-sm"
              />
            )}
          </div>
        )}

        <div className="col-span-2 flex gap-2">
          <button
            type="submit"
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
          >
            Opslaan
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded bg-gray-200 px-3 py-1 text-sm"
          >
            Annuleren
          </button>
        </div>
      </form>
    </li>
  );
}
```

Note on the `rememberKeyword` input: it only exists in the DOM when `remember` is `true`, so `FormData` naturally omits it when the checkbox is off — `updateTransaction` reading `formData.get("rememberKeyword")` as `null` in that case is exactly what makes the "no rule created" branch fire. No extra plumbing needed.

Note on error handling: wrapping `updateTransaction` in a plain async arrow function passed as the form's `action` prop (rather than binding `updateTransaction` directly) is required here so `setEditing(false)` only runs after a successful save — if `updateTransaction` throws, execution never reaches `setEditing(false)`, and React's form-action handling propagates the thrown error to the nearest error boundary exactly the same way a directly-bound Server Action would (this is a React 19 form-action guarantee, not Next-specific), so error behavior stays consistent with every other form in this app.

- [ ] **Step 4: Update `src/app/transactions/page.tsx`**

Change the import line:

```ts
import { createTransaction, deleteTransaction } from "./actions";
```

to:

```ts
import { createTransaction } from "./actions";
import TransactionRow from "./TransactionRow";
```

(`deleteTransaction` is no longer imported directly by `page.tsx` — it's imported and used inside `TransactionRow` now.)

Replace the `<ul>` block:

```tsx
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
```

with:

```tsx
      <ul className="divide-y rounded border bg-white">
        {transactions.map((t) => (
          <TransactionRow
            key={t.id}
            transaction={{
              id: t.id,
              amount: Number(t.amount),
              date: t.date,
              description: t.description,
              accountId: t.accountId,
              categoryId: t.categoryId,
              account: { id: t.account.id, name: t.account.name },
              category: {
                id: t.category.id,
                name: t.category.name,
                type: t.category.type,
              },
            }}
            accounts={accounts}
            categories={categories}
          />
        ))}
        {transactions.length === 0 && (
          <li className="p-3 text-sm text-gray-500">Geen transacties gevonden.</li>
        )}
      </ul>
```

`amount` must be converted with `Number(t.amount)` here (Prisma's `Decimal` type doesn't cross the Server→Client Component boundary the way `Date` does) — this mirrors what the old inline code already did.

`DeleteButton` and `formatEuro`/`signedAmount` imports in `page.tsx` become unused after this change if nothing else in the file uses them — check with the type-checker in Step 6 and remove any import that `tsc`/`eslint` flags as unused (likely `DeleteButton`; `formatEuro`/`signedAmount` may still be needed if anything else in the file uses them — verify before removing).

- [ ] **Step 5: Manual verification — no login credentials available**

You do not have Jelmer's login password. Verify via a throwaway Prisma script exercising `updateTransaction`'s exact logic against the real dev database (same technique used throughout this project):

1. Pick an existing transaction (or create one via `prisma.transaction.create` in the script) on the seeded "Betaalrekening" account with category "Onbekend (uitgaven)".
2. Call the equivalent of `updateTransaction` logic directly via Prisma (or, preferably, import and call the real exported `updateTransaction` function from the script if the script runs in a context where `next/cache`'s `revalidatePath` doesn't throw outside a request — if it does throw, test the Prisma logic inline in the script instead, matching the function body exactly) with a `FormData`-like plain object: change the category and set `rememberKeyword: "Testwinkel"`.
3. Confirm: the transaction's category changed, a new `CategoryRule` with keyword "Testwinkel" now exists pointing at the new category.
4. Run it again with the same `rememberKeyword: "Testwinkel"` but a *different* target category — confirm the existing rule's `categoryId` was updated in place, and no second rule with the same keyword was created (query `prisma.categoryRule.count({ where: { keyword: { equals: "Testwinkel", mode: "insensitive" } } })` — expect `1`).
5. Confirm editing without setting `rememberKeyword` does not create or touch any `CategoryRule`.
6. Clean up all test data (transaction, category rule) afterward.

- [ ] **Step 6: Type-check, lint, full test suite**

```bash
npx tsc --noEmit
npm run lint
npm test
```

Expected: all clean; `npm test` still 30/30 (unchanged from Task 1 — this task adds no new automated tests, per the Global Constraints).

- [ ] **Step 7: Commit**

```bash
git add src/app/transactions/actions.ts src/app/transactions/page.tsx src/app/transactions/TransactionRow.tsx
git commit -m "feat: add transaction editing with auto-remember category rule"
```
