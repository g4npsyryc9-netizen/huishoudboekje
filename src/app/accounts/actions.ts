"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createAccount(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "BANK") as
    | "BANK"
    | "SAVINGS"
    | "CASH";
  const startBalance = Number(formData.get("startBalance") ?? 0);

  if (!name) throw new Error("Naam is verplicht");
  if (Number.isNaN(startBalance)) throw new Error("Ongeldig startsaldo");

  await prisma.account.create({ data: { name, type, startBalance } });
  revalidatePath("/accounts");
}

export async function deleteAccount(formData: FormData) {
  const id = String(formData.get("id"));
  const count = await prisma.transaction.count({ where: { accountId: id } });
  if (count > 0) {
    throw new Error(
      `Kan rekening niet verwijderen: er zijn nog ${count} gekoppelde transacties.`,
    );
  }
  const recurringCount = await prisma.recurringRule.count({
    where: { accountId: id },
  });
  if (recurringCount > 0) {
    throw new Error(
      `Kan rekening niet verwijderen: er zijn nog ${recurringCount} gekoppelde terugkerende posten.`,
    );
  }
  await prisma.account.delete({ where: { id } });
  revalidatePath("/accounts");
}
