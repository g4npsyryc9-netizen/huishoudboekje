import { formatEuro } from "@/lib/money";

export default function BudgetBar({
  name,
  spent,
  budget,
  color,
}: {
  name: string;
  spent: number;
  budget: number;
  color: string;
}) {
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const over = spent > budget;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{name}</span>
        <span className={over ? "text-red-600" : "text-gray-600"}>
          {formatEuro(spent)} / {formatEuro(budget)}
        </span>
      </div>
      <div className="mt-1 h-2 w-full rounded bg-gray-200">
        <div
          className="h-2 rounded"
          style={{ width: `${pct}%`, backgroundColor: over ? "#DC2626" : color }}
        />
      </div>
    </div>
  );
}
