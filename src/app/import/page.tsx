import { prisma } from "@/lib/prisma";
import ImportForm from "./ImportForm";

export default async function ImportPage() {
  const accounts = await prisma.account.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">CSV importeren (ING)</h1>
      {accounts.length === 0 ? (
        <p className="text-sm text-gray-500">
          Maak eerst een rekening aan op de pagina &quot;Rekeningen&quot;.
        </p>
      ) : (
        <ImportForm accounts={accounts} />
      )}
    </div>
  );
}
