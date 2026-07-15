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
