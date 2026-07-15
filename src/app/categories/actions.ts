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
  await prisma.$transaction([
    prisma.budget.deleteMany({ where: { categoryId: id } }),
    prisma.recurringRule.deleteMany({ where: { categoryId: id } }),
    prisma.categoryRule.deleteMany({ where: { categoryId: id } }),
    prisma.category.delete({ where: { id } }),
  ]);
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
