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
                id={account.id}
                confirmMessage={`Rekening "${account.name}" verwijderen?`}
              />
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
