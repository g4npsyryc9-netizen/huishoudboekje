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
