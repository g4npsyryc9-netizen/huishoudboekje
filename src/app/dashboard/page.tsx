import { prisma } from "@/lib/prisma";
import { formatEuro, signedAmount } from "@/lib/money";
import { syncRecurringTransactions } from "@/lib/recurring";
import { CategoryPieChart, TrendLineChart } from "./Charts";
import BudgetBar from "./BudgetBar";

// This page runs syncRecurringTransactions() as a write side-effect on every
// visit ("elke keer dat je de app opent"). Without forcing dynamic rendering,
// Next.js would statically prerender this route at build time (no cookies()/
// fetch() calls are made directly in the page, so its default `dynamic =
// "auto"` heuristic sees nothing to force dynamic behavior) and bake in
// build-time data forever, only refreshing via the unrelated
// revalidatePath("/dashboard") calls in transactions/actions.ts. That would
// mean the recurring-rule sync only ever runs once, at build time, instead of
// on every dashboard visit as the spec requires.
export const dynamic = "force-dynamic";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function DashboardPage() {
  await syncRecurringTransactions();

  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [accounts, thisMonthTx, trendTx, budgets] = await Promise.all([
    prisma.account.findMany({
      include: { transactions: { include: { category: true } } },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: monthStart, lt: nextMonthStart } },
      include: { category: true },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: sixMonthsAgo, lt: nextMonthStart } },
      include: { category: true },
    }),
    prisma.budget.findMany({ include: { category: true } }),
  ]);

  const totalBalance = accounts.reduce((sum, account) => {
    const accountTotal = account.transactions.reduce(
      (s, t) => s + signedAmount(Number(t.amount), t.category.type),
      0,
    );
    return sum + Number(account.startBalance) + accountTotal;
  }, 0);

  const income = thisMonthTx
    .filter((t) => t.category.type === "INCOME")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = thisMonthTx
    .filter((t) => t.category.type === "EXPENSE")
    .reduce((s, t) => s + Number(t.amount), 0);

  const expenseByCategory = new Map<
    string,
    { name: string; value: number; color: string }
  >();
  for (const t of thisMonthTx) {
    if (t.category.type !== "EXPENSE") continue;
    const existing = expenseByCategory.get(t.categoryId);
    if (existing) {
      existing.value += Number(t.amount);
    } else {
      expenseByCategory.set(t.categoryId, {
        name: t.category.name,
        value: Number(t.amount),
        color: t.category.color,
      });
    }
  }

  const trendByMonth = new Map<
    string,
    { month: string; inkomsten: number; uitgaven: number }
  >();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const key = d.toLocaleDateString("nl-NL", { month: "short", year: "2-digit" });
    trendByMonth.set(key, { month: key, inkomsten: 0, uitgaven: 0 });
  }
  for (const t of trendTx) {
    const key = t.date.toLocaleDateString("nl-NL", {
      month: "short",
      year: "2-digit",
    });
    const bucket = trendByMonth.get(key);
    if (!bucket) continue;
    if (t.category.type === "INCOME") bucket.inkomsten += Number(t.amount);
    else bucket.uitgaven += Number(t.amount);
  }

  const spentByCategory = new Map<string, number>();
  for (const t of thisMonthTx) {
    if (t.category.type !== "EXPENSE") continue;
    spentByCategory.set(
      t.categoryId,
      (spentByCategory.get(t.categoryId) ?? 0) + Number(t.amount),
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded border bg-white p-4">
          <p className="text-sm text-gray-500">Totaalsaldo</p>
          <p className="text-2xl font-semibold">{formatEuro(totalBalance)}</p>
        </div>
        <div className="rounded border bg-white p-4">
          <p className="text-sm text-gray-500">Inkomsten deze maand</p>
          <p className="text-2xl font-semibold text-green-600">
            {formatEuro(income)}
          </p>
        </div>
        <div className="rounded border bg-white p-4">
          <p className="text-sm text-gray-500">Uitgaven deze maand</p>
          <p className="text-2xl font-semibold text-red-600">
            {formatEuro(expense)}
          </p>
        </div>
      </div>

      <div className="rounded border bg-white p-4">
        <h2 className="mb-2 font-medium">Uitgaven per categorie</h2>
        <CategoryPieChart data={[...expenseByCategory.values()]} />
      </div>

      <div className="rounded border bg-white p-4">
        <h2 className="mb-2 font-medium">Trend (6 maanden)</h2>
        <TrendLineChart data={[...trendByMonth.values()]} />
      </div>

      <div className="space-y-3 rounded border bg-white p-4">
        <h2 className="font-medium">Budgetten</h2>
        {budgets.map((b) => (
          <BudgetBar
            key={b.id}
            name={b.category.name}
            spent={spentByCategory.get(b.categoryId) ?? 0}
            budget={Number(b.amount)}
            color={b.category.color}
          />
        ))}
        {budgets.length === 0 && (
          <p className="text-sm text-gray-500">Nog geen budgetten ingesteld.</p>
        )}
      </div>
    </div>
  );
}
