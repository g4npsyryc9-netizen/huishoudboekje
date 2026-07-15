"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseLocalDate } from "@/lib/date";

export async function createTransaction(formData: FormData) {
  const amount = Number(formData.get("amount"));
  const date = parseLocalDate(String(formData.get("date")));
  const description = String(formData.get("description") ?? "").trim();
  const accountId = String(formData.get("accountId"));
  const categoryId = String(formData.get("categoryId"));

  if (Number.isNaN(amount) || amount <= 0)
    throw new Error("Bedrag moet een positief getal zijn");
  if (!description) throw new Error("Omschrijving is verplicht");

  await prisma.transaction.create({
    data: { amount, date, description, accountId, categoryId },
  });
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function deleteTransaction(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.transaction.delete({ where: { id } });
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}
