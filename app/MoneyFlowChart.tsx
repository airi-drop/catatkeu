"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
      <BarChart data={data} margin={{ bottom: 0, left: -12, right: 8, top: 12 }}>
        <defs>
          <linearGradient id="incomeGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#6ee7b7" />
          </linearGradient>
          <linearGradient id="expenseGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#f0abfc" />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(190,242,255,0.09)" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="label"
          tick={{ fill: "#b8c4d4", fontSize: 11 }}
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          tick={{ fill: "#b8c4d4", fontSize: 11 }}
          tickFormatter={(value) => formatCompactCurrency(Number(value))}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(12,18,28,0.94)",
            border: "1px solid rgba(190,242,255,0.16)",
            borderRadius: 16,
            boxShadow: "0 18px 44px rgba(0,0,0,0.28)",
            color: "#f4f4f5",
          }}
          cursor={{ fill: "rgba(34,211,238,0.06)", radius: 12 }}
          formatter={(value) => formatCurrency(Number(value))}
          labelStyle={{ color: "#e2f6ff" }}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ color: "#b8c4d4", fontSize: 12, paddingTop: 8 }}
        />
        <Bar
          dataKey="income"
          fill="url(#incomeGradient)"
          name="Pemasukan"
          radius={[10, 10, 4, 4]}
        >
          {data.map((entry) => (
            <Cell key={`income-${entry.date}`} />
          ))}
        </Bar>
        <Bar
          dataKey="expense"
          fill="url(#expenseGradient)"
          name="Pengeluaran"
          radius={[10, 10, 4, 4]}
        >
          {data.map((entry) => (
            <Cell key={`expense-${entry.date}`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
