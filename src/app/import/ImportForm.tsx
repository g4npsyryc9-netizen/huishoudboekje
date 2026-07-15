"use client";

import { useState, useTransition } from "react";
import { previewImport, confirmImport, type PreviewRow } from "./actions";
import { formatEuro } from "@/lib/money";

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
                    <td>{formatEuro(row.amount)}</td>
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
