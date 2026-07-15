"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { formatEuro } from "@/lib/money";

export function CategoryPieChart({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  if (data.length === 0)
    return <p className="text-sm text-gray-500">Nog geen uitgaven deze maand.</p>;
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatEuro(Number(value))} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TrendLineChart({
  data,
}: {
  data: { month: string; inkomsten: number; uitgaven: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(value) => formatEuro(Number(value))} />
        <Line type="monotone" dataKey="inkomsten" stroke="#16A34A" />
        <Line type="monotone" dataKey="uitgaven" stroke="#DC2626" />
      </LineChart>
    </ResponsiveContainer>
  );
}
