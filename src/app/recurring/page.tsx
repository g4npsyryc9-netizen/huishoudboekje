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
