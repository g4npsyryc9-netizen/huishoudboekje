"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Parse a "YYYY-MM-DD" input as local-time components, matching how
// generateDueDates builds its due dates (new Date(year, month, day)) —
// new Date("YYYY-MM-DD") would parse as UTC midnight instead, causing
// off-by-one-day mismatches against those local-time due dates (see
// src/app/transactions/actions.ts for the same fix applied earlier).
function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export async function createRecurringRule(formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const categoryId = String(formData.get("categoryId"));
  const accountId = String(formData.get("accountId"));
  const dayOfMonth = Number(formData.get("dayOfMonth"));
  const startDate = parseLocalDate(String(formData.get("startDate")));
  const endDateRaw = String(formData.get("endDate") ?? "");
  const endDate = endDateRaw ? parseLocalDate(endDateRaw) : null;

  if (!description) throw new Error("Omschrijving is verplicht");
  if (Number.isNaN(amount) || amount <= 0)
    throw new Error("Bedrag moet een positief getal zijn");
  if (dayOfMonth < 1 || dayOfMonth > 28)
    throw new Error("Dag van de maand moet tussen 1 en 28 liggen");

  await prisma.recurringRule.create({
    data: {
      description,
      amount,
      categoryId,
      accountId,
      dayOfMonth,
      startDate,
      endDate,
    },
  });
  revalidatePath("/recurring");
}

export async function deleteRecurringRule(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.recurringRule.delete({ where: { id } });
  revalidatePath("/recurring");
}
