import { prisma } from "@/lib/prisma";
import { formatEuro, signedAmount } from "@/lib/money";
import { createTransaction, deleteTransaction } from "./actions";
import DeleteButton from "@/components/DeleteButton";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string; categoryId?: string; month?: string }>;
}) {
  const params = await searchParams;

  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const where: Record<string, unknown> = {};
  if (params.accountId) where.accountId = params.accountId;
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.month) {
    const [y, m] = params.month.split("-").map(Number);
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
        <select name="accountId" defaultValue={params.accountId ?? ""} className="rounded border px-2 py-1 text-sm">
          <option value="">Alle rekeningen</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select name="categoryId" defaultValue={params.categoryId ?? ""} className="rounded border px-2 py-1 text-sm">
          <option value="">Alle categorieën</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input
          type="month"
          name="month"
          defaultValue={params.month ?? ""}
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
