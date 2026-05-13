"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MoneyFlowChartData = {
  date: string;
  expense: number;
  income: number;
  label: string;
};

type MoneyFlowChartProps = {
  data: MoneyFlowChartData[];
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export default function MoneyFlowChart({ data }: MoneyFlowChartProps) {
  return (
    <ResponsiveContainer height="100%" minHeight={0} minWidth={0} width="100%">
      <BarChart data={data} margin={{ bottom: 0, left: -18, right: 4, top: 8 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="label"
          tick={{ fill: "#a1a1aa", fontSize: 11 }}
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          tick={{ fill: "#a1a1aa", fontSize: 11 }}
          tickFormatter={(value) => formatCompactCurrency(Number(value))}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "#0d1118",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            color: "#f4f4f5",
          }}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          formatter={(value) => formatCurrency(Number(value))}
          labelStyle={{ color: "#d4d4d8" }}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ color: "#a1a1aa", fontSize: 12 }}
        />
        <Bar
          dataKey="income"
          fill="#6ee7b7"
          name="Pemasukan"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="expense"
          fill="#fda4af"
          name="Pengeluaran"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
