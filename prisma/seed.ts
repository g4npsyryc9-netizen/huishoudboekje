import { PrismaClient } from "@prisma/client";
import {
  FALLBACK_INCOME_CATEGORY_ID,
  FALLBACK_EXPENSE_CATEGORY_ID,
} from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  await prisma.category.upsert({
    where: { id: FALLBACK_INCOME_CATEGORY_ID },
    update: {},
    create: {
      id: FALLBACK_INCOME_CATEGORY_ID,
      name: "Onbekend (inkomsten)",
      type: "INCOME",
      color: "#9CA3AF",
    },
  });

  await prisma.category.upsert({
    where: { id: FALLBACK_EXPENSE_CATEGORY_ID },
    update: {},
    create: {
      id: FALLBACK_EXPENSE_CATEGORY_ID,
      name: "Onbekend (uitgaven)",
      type: "EXPENSE",
      color: "#9CA3AF",
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
