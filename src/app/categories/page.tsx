import { prisma } from "@/lib/prisma";
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
        {categories.length === 0 && (
          <li className="p-3 text-sm text-gray-500">Nog geen categorieën.</li>
        )}
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
