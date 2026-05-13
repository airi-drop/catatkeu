"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  CreditCard,
  HomeIcon,
  LineChart as LineChartIcon,
  Menu,
  Package,
  Plus,
  Search,
  Send,
  ShoppingCart,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";

export type Transaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  space: TransactionSpace;
  category: string;
  amount: number;
  note: string;
  rawText: string;
};

const STORAGE_KEY = "catatkeu.transactions";
const STORAGE_EVENT = "catatkeu.transactions.updated";

const MoneyFlowChart = dynamic(() => import("./MoneyFlowChart"), {
  ssr: false,
});

type TransactionSpace = "personal" | "business";
type SpaceFilter = "all" | TransactionSpace;
type PeriodFilter = "today" | "week" | "month" | "all";
type ActivePage = "dashboard" | "analytics";
type InputMode = "quick" | "business";
type HistoryTypeFilter = "all" | Transaction["type"];
type HistorySort = "newest" | "oldest" | "amount-desc" | "amount-asc";
type BusinessTransactionKind = "sale" | "material";
type PaymentMethod = "cash" | "qris" | "transfer";
type MaterialUnit = "pcs" | "kg" | "gram" | "liter" | "pack" | "lainnya";

type BusinessForm = {
  kind: BusinessTransactionKind;
  itemName: string;
  quantity: string;
  unit: MaterialUnit;
  unitPrice: string;
  paymentMethod: PaymentMethod;
  supplier: string;
  note: string;
};

let cachedStorageValue: string | null = null;
let cachedTransactions: Transaction[] = [];

const initialBusinessForm: BusinessForm = {
  kind: "sale",
  itemName: "",
  quantity: "1",
  unit: "pcs",
  unitPrice: "",
  paymentMethod: "cash",
  supplier: "",
  note: "",
};

const dummyTransactions: Transaction[] = [
  {
    id: "dummy-1",
    date: "2026-05-13",
    type: "income",
    space: "business",
    category: "Penjualan",
    amount: 350000,
    note: "Penjualan paket nasi",
    rawText: "Penjualan paket nasi 350 ribu",
  },
  {
    id: "dummy-2",
    date: "2026-05-13",
    type: "expense",
    space: "business",
    category: "Bahan/Modal",
    amount: 125000,
    note: "Beli bahan dagangan",
    rawText: "Beli bahan dagangan 125 ribu",
  },
  {
    id: "dummy-3",
    date: "2026-05-12",
    type: "expense",
    space: "business",
    category: "Operasional",
    amount: 45000,
    note: "Ojek kirim pesanan",
    rawText: "Ojek kirim pesanan 45 ribu",
  },
];

const navItems = [
  { label: "Dashboard", icon: HomeIcon, page: "dashboard" as const },
  { label: "Analitik", icon: BarChart3, page: "analytics" as const },
] satisfies { icon: typeof HomeIcon; label: string; page: ActivePage }[];

const spaceOptions: { label: string; value: TransactionSpace }[] = [
  { label: "Pribadi", value: "personal" },
  { label: "Usaha", value: "business" },
];

const spaceFilterOptions: { label: string; value: SpaceFilter }[] = [
  { label: "Semua", value: "all" },
  ...spaceOptions,
];

const periodFilterOptions: { label: string; value: PeriodFilter }[] = [
  { label: "Hari ini", value: "today" },
  { label: "Minggu ini", value: "week" },
  { label: "Bulan ini", value: "month" },
  { label: "Semua periode", value: "all" },
];

const historyTypeFilterOptions: { label: string; value: HistoryTypeFilter }[] =
  [
    { label: "Semua", value: "all" },
    { label: "Pemasukan", value: "income" },
    { label: "Pengeluaran", value: "expense" },
  ];

const historySortOptions: { label: string; value: HistorySort }[] = [
  { label: "Terbaru", value: "newest" },
  { label: "Terlama", value: "oldest" },
  { label: "Nominal terbesar", value: "amount-desc" },
  { label: "Nominal terkecil", value: "amount-asc" },
];

function getSpaceLabel(space: TransactionSpace) {
  return space === "personal" ? "Pribadi" : "Usaha";
}

function getPeriodLabel(period: PeriodFilter) {
  return (
    periodFilterOptions.find((option) => option.value === period)?.label ??
    "Semua"
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string) {
  const normalizedDate = normalizeDateKey(date) ?? getTodayDateKey();
  const [year, month, day] = normalizedDate.split("-").map(Number);

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function getTodayDateKey() {
  const today = new Date();
  return toDateKey(today);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateKeyToLocalDate(dateKey: string) {
  const normalizedDate = normalizeDateKey(dateKey);

  if (!normalizedDate) {
    return null;
  }

  const [year, month, day] = normalizedDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isValidDateKey(value: string) {
  return normalizeDateKey(value) === value;
}

function normalizeDateKey(value: string) {
  const trimmedValue = value.trim();
  const isoMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const localMatch = trimmedValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  const parts = isoMatch
    ? {
        day: Number(isoMatch[3]),
        month: Number(isoMatch[2]),
        year: Number(isoMatch[1]),
      }
    : localMatch
      ? {
          day: Number(localMatch[1]),
          month: Number(localMatch[2]),
          year: Number(localMatch[3]),
        }
      : null;

  if (!parts) {
    return null;
  }

  const date = new Date(parts.year, parts.month - 1, parts.day);
  const normalized = toDateKey(date);

  return date.getFullYear() === parts.year &&
    date.getMonth() === parts.month - 1 &&
    date.getDate() === parts.day
    ? normalized
    : null;
}

function getWeekRange(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return { end: toDateKey(end), start: toDateKey(start) };
}

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return { end: toDateKey(end), start: toDateKey(start) };
}

function isInPeriod(date: string, period: PeriodFilter, todayKey: string) {
  if (period === "all") {
    return true;
  }

  if (period === "today") {
    return date === todayKey;
  }

  const today = dateKeyToLocalDate(todayKey) ?? new Date();
  const range = period === "week" ? getWeekRange(today) : getMonthRange(today);

  return date >= range.start && date <= range.end;
}

function getTransactionCreatedKey(transaction: Transaction) {
  return Number(transaction.id.split("-")[0]) || 0;
}

function compareTransactionsByRecency(
  first: Transaction,
  second: Transaction,
) {
  const dateComparison = second.date.localeCompare(first.date);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  const createdComparison =
    getTransactionCreatedKey(second) - getTransactionCreatedKey(first);

  if (createdComparison !== 0) {
    return createdComparison;
  }

  return second.id.localeCompare(first.id);
}

function parseAmount(rawText: string) {
  const normalized = rawText.toLowerCase().replace(",", ".");
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(juta|jt|ribu|rb|k)?/);

  if (!match) {
    return 0;
  }

  const value = Number(match[1]);
  const unit = match[2];

  if (Number.isNaN(value)) {
    return 0;
  }

  if (unit === "juta" || unit === "jt") {
    return Math.round(value * 1_000_000);
  }

  if (unit === "ribu" || unit === "rb" || unit === "k") {
    return Math.round(value * 1_000);
  }

  return Math.round(value);
}

function inferType(rawText: string): Transaction["type"] {
  const normalized = rawText.toLowerCase();
  const expenseKeywords = [
    "bayar utang",
    "bayar hutang",
    "bayar gaji",
    "beli",
    "kulakan",
    "modal",
    "bahan",
    "operasional",
    "sewa",
    "listrik",
    "air",
    "internet",
    "pulsa",
    "bensin",
    "ongkir",
    "ambil pribadi",
    "prive",
  ];

  if (expenseKeywords.some((keyword) => normalized.includes(keyword))) {
    return "expense";
  }

  const incomeKeywords = [
    "penjualan",
    "jual",
    "terjual",
    "laku",
    "omzet",
    "omset",
    "bayar piutang",
    "piutang dibayar",
    "gaji",
    "bonus",
    "masuk",
    "terima",
    "refund",
  ];

  return incomeKeywords.some((keyword) => normalized.includes(keyword))
    ? "income"
    : "expense";
}

function inferCategory(rawText: string, type: Transaction["type"]) {
  const normalized = rawText.toLowerCase();

  if (
    ["penjualan", "jual", "terjual", "laku", "omzet", "omset"].some(
      (keyword) => normalized.includes(keyword),
    )
  ) {
    return "Penjualan";
  }

  if (
    [
      "bahan",
      "modal",
      "kulakan",
      "stok",
      "barang dagangan",
      "supplier",
      "tepung",
    ].some((keyword) => normalized.includes(keyword))
  ) {
    return "Bahan/Modal";
  }

  if (
    [
      "operasional",
      "sewa",
      "listrik",
      "air",
      "internet",
      "pulsa",
      "bensin",
      "parkir",
      "tol",
      "ojek",
      "grab",
      "gojek",
      "ongkir",
      "kirim",
    ].some((keyword) => normalized.includes(keyword))
  ) {
    return "Operasional";
  }

  if (["utang", "hutang", "pinjam", "pinjaman"].some((keyword) => normalized.includes(keyword))) {
    return "Utang";
  }

  if (
    ["piutang", "bon pelanggan", "tempo", "belum dibayar"].some((keyword) =>
      normalized.includes(keyword),
    )
  ) {
    return "Piutang";
  }

  if (
    ["prive", "ambil pribadi", "pakai pribadi", "tarik pribadi"].some(
      (keyword) => normalized.includes(keyword),
    )
  ) {
    return "Prive";
  }

  if (
    ["gaji", "upah", "pegawai", "karyawan"].some((keyword) =>
      normalized.includes(keyword),
    )
  ) {
    return "Gaji";
  }

  if (
    ["makan", "kopi", "nasi", "roti", "minum"].some((keyword) =>
      normalized.includes(keyword),
    )
  ) {
    return "Makanan";
  }

  if (type === "income") {
    return "Penjualan";
  }

  return "Lainnya";
}

function createTransaction(
  rawText: string,
  space: TransactionSpace = "business",
  date = getTodayDateKey(),
): Transaction {
  const type = inferType(rawText);
  const amount = parseAmount(rawText);
  const trimmedText = rawText.trim();
  const dateKey = normalizeDateKey(date) ?? getTodayDateKey();

  return {
    id: `${Date.now()}-${crypto.randomUUID()}`,
    date: dateKey,
    type,
    space,
    category: inferCategory(trimmedText, type),
    amount,
    note: trimmedText,
    rawText: trimmedText,
  };
}

function splitQuickTransactionText(rawText: string) {
  return rawText
    .split(/,(?=\s*\D)|\s+(?:dan|lalu|terus)\s+/i)
    .map((text) => text.trim())
    .filter(Boolean);
}

function createQuickTransactions(
  rawText: string,
  space: TransactionSpace,
  date = getTodayDateKey(),
) {
  return splitQuickTransactionText(rawText)
    .map((text) => createTransaction(text, space, date))
    .filter((transaction) => transaction.amount > 0);
}

function parsePositiveNumber(value: string) {
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function createBusinessTransaction(
  form: BusinessForm,
  date = getTodayDateKey(),
): Transaction {
  const dateKey = normalizeDateKey(date) ?? getTodayDateKey();
  const itemName = form.itemName.trim();
  const quantity = parsePositiveNumber(form.quantity);
  const unitPrice = parsePositiveNumber(form.unitPrice);
  const total = Math.round(quantity * unitPrice);
  const note = form.note.trim();
  const supplier = form.supplier.trim();
  const paymentLabel = form.paymentMethod.toUpperCase();

  if (form.kind === "sale") {
    const transactionNote = note || `Penjualan ${itemName}`;
    const rawText = [
      `Penjualan ${itemName}`,
      `${quantity} x ${formatCurrency(unitPrice)}`,
      paymentLabel,
      note,
    ]
      .filter(Boolean)
      .join(" - ");

    return {
      id: `${Date.now()}-${crypto.randomUUID()}`,
      date: dateKey,
      type: "income",
      space: "business",
      category: "Penjualan",
      amount: total,
      note: transactionNote,
      rawText,
    };
  }

  const transactionNote = note || `Pembelian bahan ${itemName}`;
  const rawText = [
    `Pembelian bahan ${itemName}`,
    `${quantity} ${form.unit} x ${formatCurrency(unitPrice)}`,
    supplier ? `Supplier: ${supplier}` : "",
    paymentLabel,
    note,
  ]
    .filter(Boolean)
    .join(" - ");

  return {
    id: `${Date.now()}-${crypto.randomUUID()}`,
    date: dateKey,
    type: "expense",
    space: "business",
    category: "Bahan/Modal",
    amount: total,
    note: transactionNote,
    rawText,
  };
}

function normalizeTransaction(value: unknown): Transaction | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const transaction = value as Record<string, unknown>;
  const { amount, category, id, note, rawText, type } = transaction;

  const isBaseTransaction =
    typeof id === "string" &&
    (type === "income" || type === "expense") &&
    typeof category === "string" &&
    typeof amount === "number" &&
    typeof note === "string" &&
    typeof rawText === "string";

  if (!isBaseTransaction) {
    return null;
  }

  const space =
    transaction.space === "personal" || transaction.space === "business"
      ? transaction.space
      : "business";
  const date =
    typeof transaction.date === "string"
      ? normalizeDateKey(transaction.date) ?? getTodayDateKey()
      : getTodayDateKey();

  return {
    id,
    date,
    type,
    space,
    category,
    amount,
    note,
    rawText,
  };
}

function parseTransactions(stored: string | null) {
  if (!stored) {
    console.log("parsedTransactions", dummyTransactions);
    return dummyTransactions;
  }

  if (stored === cachedStorageValue) {
    console.log("parsedTransactions", cachedTransactions);
    return cachedTransactions;
  }

  cachedStorageValue = stored;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      cachedTransactions = dummyTransactions;
      return cachedTransactions;
    }

    cachedTransactions = parsed
      .map(normalizeTransaction)
      .filter((transaction): transaction is Transaction => Boolean(transaction));
  } catch {
    cachedTransactions = dummyTransactions;
  }

  console.log("parsedTransactions", cachedTransactions);
  return cachedTransactions;
}

function getTransactionsSnapshot() {
  if (typeof window === "undefined") {
    return dummyTransactions;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return parseTransactions(stored);
}

function subscribeTransactions(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", listener);
  window.addEventListener(STORAGE_EVENT, listener);

  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(STORAGE_EVENT, listener);
  };
}

function writeTransactions(transactions: Transaction[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  cachedStorageValue = JSON.stringify(transactions);
  cachedTransactions = transactions;
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

export default function Home() {
  const [transactions, setTransactions] =
    useState<Transaction[]>(dummyTransactions);
  const [rawText, setRawText] = useState("");
  const [quickFeedback, setQuickFeedback] = useState("");
  const [spaceFilter, setSpaceFilter] = useState<SpaceFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("today");
  const [activePage, setActivePage] = useState<ActivePage>("dashboard");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState("all");
  const [historyTypeFilter, setHistoryTypeFilter] =
    useState<HistoryTypeFilter>("all");
  const [historySort, setHistorySort] = useState<HistorySort>("newest");
  const [selectedDate, setSelectedDate] = useState(getTodayDateKey);
  const [inputMode, setInputMode] = useState<InputMode>("quick");
  const [businessForm, setBusinessForm] =
    useState<BusinessForm>(initialBusinessForm);

  useEffect(() => {
    const syncTransactions = () => {
      const parsedTransactions = getTransactionsSnapshot();
      setTransactions(parsedTransactions);
    };

    syncTransactions();
    return subscribeTransactions(syncTransactions);
  }, []);

  const todayKey = getTodayDateKey();
  const periodLabel = getPeriodLabel(periodFilter);

  const businessQuantity = parsePositiveNumber(businessForm.quantity);
  const businessUnitPrice = parsePositiveNumber(businessForm.unitPrice);
  const businessTotal = Math.round(businessQuantity * businessUnitPrice);
  const canSubmitBusiness =
    businessForm.itemName.trim().length > 0 && businessTotal > 0;
  const activeInputSpace =
    spaceFilter === "personal" || spaceFilter === "business"
      ? spaceFilter
      : null;
  const activeInputMode =
    activeInputSpace === "business" ? inputMode : "quick";
  const hasValidSelectedDate = isValidDateKey(selectedDate);
  const quickTransactions = useMemo(
    () =>
      activeInputSpace
        ? createQuickTransactions(rawText, activeInputSpace, selectedDate)
        : [],
    [activeInputSpace, rawText, selectedDate],
  );

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const transactionDateKey = normalizeDateKey(transaction.date);

      if (!transactionDateKey) {
        return false;
      }

      const matchesSpace =
        spaceFilter === "all" || transaction.space === spaceFilter;
      const matchesPeriod = isInPeriod(
        transactionDateKey,
        periodFilter,
        todayKey,
      );

      return matchesSpace && matchesPeriod;
    });
  }, [periodFilter, spaceFilter, todayKey, transactions]);

  const totals = useMemo(() => {
    return filteredTransactions.reduce(
      (result, transaction) => {
        if (transaction.type === "income") {
          result.income += transaction.amount;
        } else {
          result.expense += transaction.amount;
        }

        result.balance = result.income - result.expense;
        return result;
      },
      { balance: 0, income: 0, expense: 0 },
    );
  }, [filteredTransactions]);

  const historyCategoryOptions = useMemo(() => {
    return [...new Set(filteredTransactions.map((transaction) => transaction.category))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [filteredTransactions]);

  const sortedTransactions = useMemo(() => {
    const normalizedSearch = historySearch.trim().toLowerCase();

    return filteredTransactions
      .filter((transaction) => {
        const matchesSearch =
          !normalizedSearch ||
          [
            transaction.note,
            transaction.rawText,
            transaction.category,
          ].some((value) => value.toLowerCase().includes(normalizedSearch));
        const matchesCategory =
          historyCategoryFilter === "all" ||
          transaction.category === historyCategoryFilter;
        const matchesType =
          historyTypeFilter === "all" || transaction.type === historyTypeFilter;

        return matchesSearch && matchesCategory && matchesType;
      })
      .sort((a, b) => {
        if (historySort === "oldest") {
          return compareTransactionsByRecency(b, a);
        }

        if (historySort === "amount-desc") {
          const amountComparison = b.amount - a.amount;
          return amountComparison !== 0
            ? amountComparison
            : compareTransactionsByRecency(a, b);
        }

        if (historySort === "amount-asc") {
          const amountComparison = a.amount - b.amount;
          return amountComparison !== 0
            ? amountComparison
            : compareTransactionsByRecency(a, b);
        }

        return compareTransactionsByRecency(a, b);
      });
  }, [
    filteredTransactions,
    historyCategoryFilter,
    historySearch,
    historySort,
    historyTypeFilter,
  ]);

  const chartData = useMemo(() => {
    const totalsByDate = new Map<
      string,
      { date: string; expense: number; income: number; label: string }
    >();

    filteredTransactions.forEach((transaction) => {
      const current = totalsByDate.get(transaction.date) ?? {
        date: transaction.date,
        expense: 0,
        income: 0,
        label: formatDate(transaction.date),
      };

      if (transaction.type === "income") {
        current.income += transaction.amount;
      } else {
        current.expense += transaction.amount;
      }

      totalsByDate.set(transaction.date, current);
    });

    return [...totalsByDate.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [filteredTransactions]);

  const periodSummary = useMemo(() => {
    return filteredTransactions.reduce(
      (result, transaction) => {
        if (transaction.type === "income") {
          result.income += transaction.amount;
        } else {
          result.expense += transaction.amount;
        }

        result.profit = result.income - result.expense;
        return result;
      },
      { expense: 0, income: 0, profit: 0 },
    );
  }, [filteredTransactions]);

  const topExpenseCategories = useMemo(() => {
    const totalsByCategory = new Map<string, number>();

    filteredTransactions.forEach((transaction) => {
      if (transaction.type !== "expense") {
        return;
      }

      totalsByCategory.set(
        transaction.category,
        (totalsByCategory.get(transaction.category) ?? 0) + transaction.amount,
      );
    });

    return [...totalsByCategory.entries()]
      .map(([category, amount]) => ({ amount, category }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [filteredTransactions]);

  const transactionStats = useMemo(
    () => ({
      expense: filteredTransactions.filter(
        (transaction) => transaction.type === "expense",
      ).length,
      income: filteredTransactions.filter(
        (transaction) => transaction.type === "income",
      ).length,
      total: filteredTransactions.length,
    }),
    [filteredTransactions],
  );

  const businessSummary = useMemo(() => {
    return filteredTransactions.reduce(
      (result, transaction) => {
        if (transaction.space !== "business") {
          return result;
        }

        if (
          transaction.type === "income" &&
          transaction.category === "Penjualan"
        ) {
          result.sales += transaction.amount;
        }

        if (
          transaction.type === "expense" &&
          transaction.category === "Bahan/Modal"
        ) {
          result.material += transaction.amount;
        }

        if (
          transaction.type === "expense" &&
          transaction.category === "Operasional"
        ) {
          result.operational += transaction.amount;
        }

        if (transaction.type === "income") {
          result.netCash += transaction.amount;
        } else {
          result.netCash -= transaction.amount;
        }

        result.grossProfit = result.sales - result.material;
        return result;
      },
      { grossProfit: 0, material: 0, netCash: 0, operational: 0, sales: 0 },
    );
  }, [filteredTransactions]);

  const summaryCards = [
    {
      label: "Saldo",
      value: formatCurrency(totals.balance),
      helper: `${filteredTransactions.length} transaksi - ${periodLabel}`,
      icon: Wallet,
      tone: "text-cyan-300",
    },
    {
      label: "Pemasukan",
      value: formatCurrency(totals.income),
      helper: `Total ${periodLabel.toLowerCase()}`,
      icon: ArrowDownLeft,
      tone: "text-emerald-300",
    },
    {
      label: "Pengeluaran",
      value: formatCurrency(totals.expense),
      helper: `Total ${periodLabel.toLowerCase()}`,
      icon: ArrowUpRight,
      tone: "text-rose-300",
    },
  ];

  function commitTransactions(nextTransactions: Transaction[]) {
    const normalizedTransactions = nextTransactions.map((transaction) => ({
      ...transaction,
      date: normalizeDateKey(transaction.date) ?? getTodayDateKey(),
    }));

    setTransactions(normalizedTransactions);
    writeTransactions(normalizedTransactions);
    console.log("transactions setelah update", normalizedTransactions);

    return normalizedTransactions;
  }

  function showSubmittedDateIfFilteredOut(date: string) {
    if (!isInPeriod(date, periodFilter, todayKey)) {
      setPeriodFilter("all");
    }
  }

  function addTransaction(inputText = rawText) {
    const trimmedText = inputText.trim();

    if (!trimmedText) {
      setQuickFeedback("");
      return;
    }

    if (!activeInputSpace) {
      return;
    }

    if (!hasValidSelectedDate) {
      setQuickFeedback("");
      return;
    }

    const nextTransactions = createQuickTransactions(
      trimmedText,
      activeInputSpace,
      selectedDate,
    );

    if (nextTransactions.length <= 0) {
      setQuickFeedback("");
      return;
    }

    const updatedTransactions = [...nextTransactions, ...transactions];
    console.log("newTransactions", nextTransactions);
    const committedTransactions = commitTransactions(updatedTransactions);

    if (
      !nextTransactions.every((transaction) =>
        committedTransactions.some((current) => current.id === transaction.id),
      )
    ) {
      setQuickFeedback("");
      return;
    }

    showSubmittedDateIfFilteredOut(selectedDate);
    setQuickFeedback(
      `${nextTransactions.length} transaksi berhasil dicatat`,
    );
    setRawText("");
  }

  function updateBusinessForm<Field extends keyof BusinessForm>(
    field: Field,
    value: BusinessForm[Field],
  ) {
    setBusinessForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function addBusinessTransaction() {
    if (
      activeInputSpace !== "business" ||
      !canSubmitBusiness ||
      !hasValidSelectedDate
    ) {
      return;
    }

    const transaction = createBusinessTransaction(
      businessForm,
      selectedDate,
    );
    const updatedTransactions = [transaction, ...transactions];
    console.log("newTransactions", [transaction]);
    const committedTransactions = commitTransactions(updatedTransactions);

    if (!committedTransactions.some((current) => current.id === transaction.id)) {
      return;
    }

    showSubmittedDateIfFilteredOut(selectedDate);
    setBusinessForm((current) => ({
      ...initialBusinessForm,
      kind: current.kind,
      paymentMethod: current.paymentMethod,
    }));
  }

  function deleteTransaction(id: string) {
    commitTransactions(
      transactions.filter((transaction) => transaction.id !== id),
    );
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:flex-row">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-[#0b0f16]/90 px-5 py-6 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/25">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">CatatKeu</p>
              <h1 className="text-lg font-semibold text-white">Harian</h1>
            </div>
          </div>

          <nav className="mt-10 space-y-1">
            {navItems.map((item) => (
              <button
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                  activePage === item.page
                    ? "bg-white text-zinc-950"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
                key={item.label}
                onClick={() => {
                  setActivePage(item.page);
                  setIsMobileNavOpen(false);
                }}
                type="button"
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-200">
              <Bot size={18} />
            </div>
            <p className="text-sm font-medium text-white">Catatan sederhana</p>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              Cocok untuk uang pribadi dan usaha mikro.
            </p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07090d]/85 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  aria-label="Buka menu"
                  className="flex size-10 items-center justify-center rounded-lg border border-white/10 text-zinc-300 lg:hidden"
                  onClick={() => setIsMobileNavOpen((current) => !current)}
                  type="button"
                >
                  <Menu size={20} />
                </button>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
                    CatatKeu
                  </p>
                  <h2 className="text-xl font-semibold text-white sm:text-2xl">
                    {activePage === "dashboard"
                      ? "Ringkasan Uang Harian"
                      : "Analitik Keuangan"}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  aria-label="Cari"
                  className="hidden size-10 items-center justify-center rounded-lg border border-white/10 text-zinc-300 transition hover:bg-white/5 sm:flex"
                  type="button"
                >
                  <Search size={18} />
                </button>
                <button
                  aria-label="Notifikasi"
                  className="flex size-10 items-center justify-center rounded-lg border border-white/10 text-zinc-300 transition hover:bg-white/5"
                  type="button"
                >
                  <Bell size={18} />
                </button>
              </div>
            </div>
            {isMobileNavOpen ? (
              <nav className="mt-3 grid grid-cols-2 gap-2 lg:hidden">
                {navItems.map((item) => (
                  <button
                    className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition ${
                      activePage === item.page
                        ? "bg-white text-zinc-950"
                        : "border border-white/10 text-zinc-300 hover:bg-white/5"
                    }`}
                    key={item.label}
                    onClick={() => {
                      setActivePage(item.page);
                      setIsMobileNavOpen(false);
                    }}
                    type="button"
                  >
                    <item.icon size={16} />
                    {item.label}
                  </button>
                ))}
              </nav>
            ) : null}
          </header>

          <div className="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-12 lg:gap-5 lg:px-8">
            <section className="grid gap-4 sm:col-span-2 sm:grid-cols-3 lg:col-span-12">
              <div className="grid gap-3 sm:col-span-3 lg:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Ruang catatan
                  </p>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                    {spaceFilterOptions.map((option) => (
                      <button
                        className={`h-9 shrink-0 rounded-lg px-3 text-sm font-medium transition ${
                          spaceFilter === option.value
                            ? "bg-white text-zinc-950"
                            : "border border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white"
                        }`}
                        key={option.value}
                        onClick={() => {
                          setSpaceFilter(option.value);
                          setQuickFeedback("");

                          if (option.value !== "business") {
                            setInputMode("quick");
                          }
                        }}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Periode
                  </p>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                    {periodFilterOptions.map((option) => (
                      <button
                        className={`h-9 shrink-0 rounded-lg px-3 text-sm font-medium transition ${
                          periodFilter === option.value
                            ? "bg-cyan-300 text-zinc-950"
                            : "border border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white"
                        }`}
                        key={option.value}
                        onClick={() => setPeriodFilter(option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {summaryCards.map((card) => (
                <article
                  className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20"
                  key={card.label}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-zinc-400">{card.label}</p>
                      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                        {card.value}
                      </p>
                    </div>
                    <div
                      className={`flex size-11 items-center justify-center rounded-lg bg-white/5 ${card.tone}`}
                    >
                      <card.icon size={22} />
                    </div>
                  </div>
                  <p className="mt-5 text-sm text-zinc-500">{card.helper}</p>
                </article>
              ))}
            </section>

            {activePage === "dashboard" ? (
              <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:col-span-2 lg:col-span-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-400">Input transaksi</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    Catat cepat atau transaksi usaha
                  </h3>
                </div>
                <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-200">
                  <Sparkles size={18} />
                </div>
              </div>

              {activeInputSpace ? (
                <div
                  className={`mt-5 grid gap-2 rounded-lg border border-white/10 bg-[#080b10] p-1 ${
                    activeInputSpace === "business"
                      ? "grid-cols-2"
                      : "grid-cols-1"
                  }`}
                >
                  {[
                    {
                      label: "Catat Cepat",
                      mode: "quick" as const,
                      icon: Send,
                    },
                    ...(activeInputSpace === "business"
                      ? [
                          {
                            label: "Transaksi Usaha",
                            mode: "business" as const,
                            icon: ShoppingCart,
                          },
                        ]
                      : []),
                  ].map((mode) => (
                    <button
                      className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm font-medium transition ${
                        activeInputMode === mode.mode
                          ? "bg-white text-zinc-950"
                          : "text-zinc-400 hover:bg-white/5 hover:text-white"
                      }`}
                      key={mode.mode}
                      onClick={() => setInputMode(mode.mode)}
                      type="button"
                    >
                      <mode.icon size={16} />
                      {mode.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {!activeInputSpace ? (
                <div className="mt-5 rounded-lg border border-dashed border-white/10 bg-[#080b10] px-4 py-8 text-center">
                  <p className="text-sm text-zinc-400">
                    Pilih Pribadi atau Usaha untuk mencatat transaksi
                  </p>
                </div>
              ) : activeInputMode === "quick" ? (
                <div className="mt-4 rounded-lg border border-white/10 bg-[#080b10] p-3">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-zinc-300">
                      Catat Cepat
                    </p>
                    <label
                      className="flex items-center gap-2 text-sm text-zinc-400"
                      htmlFor="quick-date"
                    >
                      <CalendarDays size={16} />
                      <input
                        className="h-9 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 sm:w-36"
                        id="quick-date"
                        onChange={(event) =>
                          setSelectedDate(event.target.value)
                        }
                        type="date"
                        value={selectedDate}
                      />
                    </label>
                  </div>
                  <textarea
                    className="min-h-32 w-full resize-none bg-transparent text-base leading-7 text-zinc-100 outline-none placeholder:text-zinc-600"
                    onChange={(event) => {
                      setRawText(event.target.value);
                      setQuickFeedback("");
                    }}
                    placeholder="Contoh: Penjualan nasi 350 ribu, beli bahan 125 ribu, atau bayar listrik 80 ribu"
                    value={rawText}
                  />
                  <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-zinc-500">
                      {quickFeedback ||
                        `Disimpan ke ruang ${getSpaceLabel(activeInputSpace)}.`}
                    </p>
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={
                        !hasValidSelectedDate ||
                        !rawText.trim() ||
                        quickTransactions.length <= 0
                      }
                      onClick={() => addTransaction()}
                      type="button"
                    >
                      <Send size={16} />
                      Tambah transaksi
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-white/10 bg-[#080b10] p-4">
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                      <label
                        className="text-sm font-medium text-zinc-300"
                        htmlFor="business-kind"
                      >
                        Jenis Transaksi
                      </label>
                      <select
                        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
                        id="business-kind"
                        onChange={(event) =>
                          updateBusinessForm(
                            "kind",
                            event.target.value as BusinessTransactionKind,
                          )
                        }
                        value={businessForm.kind}
                      >
                        <option value="sale">Penjualan</option>
                        <option value="material">Pembelian Bahan</option>
                      </select>
                    </div>
                    <div>
                      <label
                        className="text-sm font-medium text-zinc-300"
                        htmlFor="business-date"
                      >
                        Tanggal
                      </label>
                      <div className="mt-2 flex items-center gap-2 text-zinc-400">
                        <CalendarDays size={16} />
                        <input
                          className="h-11 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 sm:w-40"
                          id="business-date"
                          onChange={(event) =>
                            setSelectedDate(event.target.value)
                          }
                          type="date"
                          value={selectedDate}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        className="text-sm font-medium text-zinc-300"
                        htmlFor="business-item"
                      >
                        {businessForm.kind === "sale"
                          ? "Nama item"
                          : "Nama bahan"}
                      </label>
                      <input
                        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/60"
                        id="business-item"
                        onChange={(event) =>
                          updateBusinessForm("itemName", event.target.value)
                        }
                        placeholder={
                          businessForm.kind === "sale"
                            ? "Nasi box"
                            : "Tepung terigu"
                        }
                        type="text"
                        value={businessForm.itemName}
                      />
                    </div>

                    <div>
                      <label
                        className="text-sm font-medium text-zinc-300"
                        htmlFor="business-quantity"
                      >
                        Qty
                      </label>
                      <input
                        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/60"
                        id="business-quantity"
                        min="0"
                        onChange={(event) =>
                          updateBusinessForm("quantity", event.target.value)
                        }
                        step="0.01"
                        type="number"
                        value={businessForm.quantity}
                      />
                    </div>

                    {businessForm.kind === "material" ? (
                      <div>
                        <label
                          className="text-sm font-medium text-zinc-300"
                          htmlFor="business-unit"
                        >
                          Satuan
                        </label>
                        <select
                          className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
                          id="business-unit"
                          onChange={(event) =>
                            updateBusinessForm(
                              "unit",
                              event.target.value as MaterialUnit,
                            )
                          }
                          value={businessForm.unit}
                        >
                          <option value="pcs">pcs</option>
                          <option value="kg">kg</option>
                          <option value="gram">gram</option>
                          <option value="liter">liter</option>
                          <option value="pack">pack</option>
                          <option value="lainnya">lainnya</option>
                        </select>
                      </div>
                    ) : null}

                    <div>
                      <label
                        className="text-sm font-medium text-zinc-300"
                        htmlFor="business-unit-price"
                      >
                        Harga satuan
                      </label>
                      <input
                        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/60"
                        id="business-unit-price"
                        min="0"
                        onChange={(event) =>
                          updateBusinessForm("unitPrice", event.target.value)
                        }
                        placeholder="0"
                        step="100"
                        type="number"
                        value={businessForm.unitPrice}
                      />
                    </div>

                    <div>
                      <label
                        className="text-sm font-medium text-zinc-300"
                        htmlFor="business-total"
                      >
                        Total otomatis
                      </label>
                      <div
                        className="mt-2 flex h-11 items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-white"
                        id="business-total"
                      >
                        {formatCurrency(businessTotal)}
                      </div>
                    </div>

                    {businessForm.kind === "material" ? (
                      <div>
                        <label
                          className="text-sm font-medium text-zinc-300"
                          htmlFor="business-supplier"
                        >
                          Supplier optional
                        </label>
                        <input
                          className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/60"
                          id="business-supplier"
                          onChange={(event) =>
                            updateBusinessForm("supplier", event.target.value)
                          }
                          placeholder="Nama supplier"
                          type="text"
                          value={businessForm.supplier}
                        />
                      </div>
                    ) : null}

                    <div>
                      <label
                        className="text-sm font-medium text-zinc-300"
                        htmlFor="business-payment"
                      >
                        Metode pembayaran
                      </label>
                      <select
                        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
                        id="business-payment"
                        onChange={(event) =>
                          updateBusinessForm(
                            "paymentMethod",
                            event.target.value as PaymentMethod,
                          )
                        }
                        value={businessForm.paymentMethod}
                      >
                        <option value="cash">cash</option>
                        <option value="qris">qris</option>
                        <option value="transfer">transfer</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        className="text-sm font-medium text-zinc-300"
                        htmlFor="business-note"
                      >
                        Catatan optional
                      </label>
                      <textarea
                        className="mt-2 min-h-20 w-full resize-none rounded-lg border border-white/10 bg-[#0d1118] px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/60"
                        id="business-note"
                        onChange={(event) =>
                          updateBusinessForm("note", event.target.value)
                        }
                        placeholder="Catatan singkat"
                        value={businessForm.note}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-zinc-500">
                      {businessForm.kind === "sale"
                        ? "Disimpan sebagai pemasukan kategori Penjualan."
                        : "Disimpan sebagai pengeluaran kategori Bahan/Modal."}
                    </p>
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!hasValidSelectedDate || !canSubmitBusiness}
                      onClick={addBusinessTransaction}
                      type="button"
                    >
                      <Package size={16} />
                      Simpan transaksi
                    </button>
                  </div>
                </div>
              )}
              </section>
            ) : null}

            {activePage === "analytics" ? (
              <>
                <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:col-span-2 lg:col-span-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Grafik</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    Arus uang
                  </h3>
                </div>
                <LineChartIcon className="text-zinc-500" size={20} />
              </div>
              <div className="mt-5 h-64 rounded-lg border border-white/10 bg-[#080b10] p-3">
                {chartData.length > 0 ? (
                  <MoneyFlowChart data={chartData} />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center">
                    <div>
                      <BarChart3 className="mx-auto text-zinc-600" size={34} />
                      <p className="mt-3 text-sm text-zinc-500">
                        Grafik arus uang akan muncul setelah ada transaksi.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:col-span-2 lg:col-span-4">
              <p className="text-sm text-zinc-400">Ringkasan periode</p>
              <h3 className="mt-1 text-lg font-semibold text-white">
                {periodLabel}
              </h3>
              <div className="mt-5 space-y-3">
                {[
                  {
                    label: "Pemasukan",
                    tone: "text-emerald-300",
                    value: periodSummary.income,
                  },
                  {
                    label: "Pengeluaran",
                    tone: "text-rose-300",
                    value: periodSummary.expense,
                  },
                  {
                    label: "Laba/Rugi",
                    tone:
                      periodSummary.profit >= 0
                        ? "text-cyan-300"
                        : "text-rose-300",
                    value: periodSummary.profit,
                  },
                ].map((item) => (
                  <div
                    className="flex items-center justify-between gap-4 rounded-lg bg-[#080b10] px-3 py-3"
                    key={item.label}
                  >
                    <p className="text-sm text-zinc-400">{item.label}</p>
                    <p className={`text-sm font-semibold ${item.tone}`}>
                      {formatCurrency(item.value)}
                    </p>
                  </div>
                ))}
              </div>
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:col-span-2 lg:col-span-4">
              <p className="text-sm text-zinc-400">Kategori pengeluaran</p>
              <h3 className="mt-1 text-lg font-semibold text-white">Top 3</h3>
              <div className="mt-5 space-y-3">
                {topExpenseCategories.length > 0 ? (
                  topExpenseCategories.map((item, index) => (
                    <div
                      className="flex items-center justify-between gap-4 rounded-lg bg-[#080b10] px-3 py-3"
                      key={item.category}
                    >
                      <p className="min-w-0 truncate text-sm font-medium text-white">
                        {index + 1}. {item.category}
                      </p>
                      <p className="shrink-0 text-sm font-semibold text-rose-300">
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#080b10] px-6 text-center">
                    <p className="text-sm text-zinc-500">
                      Belum ada pengeluaran pada filter ini.
                    </p>
                  </div>
                )}
              </div>
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:col-span-2 lg:col-span-8">
                  <p className="text-sm text-zinc-400">Khusus Usaha</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    Ringkasan usaha
                  </h3>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {[
                      {
                        label: "Penjualan",
                        tone: "text-emerald-300",
                        value: businessSummary.sales,
                      },
                      {
                        label: "Bahan/Modal",
                        tone: "text-rose-300",
                        value: businessSummary.material,
                      },
                      {
                        label: "Operasional",
                        tone: "text-rose-300",
                        value: businessSummary.operational,
                      },
                      {
                        label: "Laba kotor sederhana",
                        tone:
                          businessSummary.grossProfit >= 0
                            ? "text-cyan-300"
                            : "text-rose-300",
                        value: businessSummary.grossProfit,
                      },
                      {
                        label: "Arus kas bersih",
                        tone:
                          businessSummary.netCash >= 0
                            ? "text-cyan-300"
                            : "text-rose-300",
                        value: businessSummary.netCash,
                      },
                    ].map((item) => (
                      <div
                        className="rounded-lg bg-[#080b10] px-3 py-4"
                        key={item.label}
                      >
                        <p className="text-sm text-zinc-400">{item.label}</p>
                        <p className={`mt-2 text-base font-semibold ${item.tone}`}>
                          {formatCurrency(item.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-zinc-500">
                    Dihitung dari transaksi Usaha yang cocok dengan filter ruang
                    dan periode aktif.
                  </p>
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:col-span-2 lg:col-span-4">
              <p className="text-sm text-zinc-400">Statistik</p>
              <h3 className="mt-1 text-lg font-semibold text-white">
                Transaksi
              </h3>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { label: "Total", value: transactionStats.total },
                  { label: "Masuk", value: transactionStats.income },
                  { label: "Keluar", value: transactionStats.expense },
                ].map((item) => (
                  <div
                    className="rounded-lg bg-[#080b10] px-2 py-4 text-center"
                    key={item.label}
                  >
                    <p className="text-2xl font-semibold text-white">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{item.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-zinc-500">
                Mengikuti filter ruang dan periode yang sedang aktif.
              </p>
                </section>
              </>
            ) : null}

            {activePage === "dashboard" ? (
              <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:col-span-2 lg:col-span-12">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Riwayat</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    Catatan terbaru
                  </h3>
                </div>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!activeInputSpace}
                  onClick={() =>
                    addTransaction("Penjualan nasi 350 ribu hari ini")
                  }
                  type="button"
                >
                  <Plus size={16} />
                  Coba contoh
                </button>
              </div>

              <div className="mt-4 grid gap-3 rounded-lg border border-white/10 bg-[#080b10] p-3 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
                <label className="block">
                  <span className="text-xs font-medium text-zinc-500">
                    Search transaksi
                  </span>
                  <div className="mt-2 flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#0d1118] px-3 text-zinc-400">
                    <Search size={16} />
                    <input
                      className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                      onChange={(event) => setHistorySearch(event.target.value)}
                      placeholder="Cari catatan"
                      type="search"
                      value={historySearch}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-zinc-500">
                    Kategori
                  </span>
                  <select
                    className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
                    onChange={(event) =>
                      setHistoryCategoryFilter(event.target.value)
                    }
                    value={historyCategoryFilter}
                  >
                    <option value="all">Semua kategori</option>
                    {historyCategoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-zinc-500">
                    Tipe
                  </span>
                  <select
                    className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
                    onChange={(event) =>
                      setHistoryTypeFilter(
                        event.target.value as HistoryTypeFilter,
                      )
                    }
                    value={historyTypeFilter}
                  >
                    {historyTypeFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-zinc-500">
                    Sort
                  </span>
                  <select
                    className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
                    onChange={(event) =>
                      setHistorySort(event.target.value as HistorySort)
                    }
                    value={historySort}
                  >
                    {historySortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5 min-h-52 rounded-lg border border-dashed border-white/10 bg-[#080b10]">
                {sortedTransactions.length > 0 ? (
                  <div className="divide-y divide-white/10">
                    {sortedTransactions.map((transaction) => (
                      <article
                        className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                        key={transaction.id}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-white">
                              {transaction.note}
                            </p>
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-medium ${
                                transaction.type === "income"
                                  ? "bg-emerald-400/10 text-emerald-200"
                                  : "bg-rose-400/10 text-rose-200"
                              }`}
                            >
                              {transaction.type === "income"
                                ? "Pemasukan"
                                : "Pengeluaran"}
                            </span>
                            <span className="rounded-md bg-white/5 px-2 py-1 text-xs font-medium text-zinc-300">
                              {getSpaceLabel(transaction.space)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-zinc-500">
                            {formatDate(transaction.date)} -{" "}
                            {transaction.category}
                          </p>
                          <p className="mt-1 truncate text-sm text-zinc-600">
                            {transaction.rawText}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                          <p
                            className={`text-right font-semibold ${
                              transaction.type === "income"
                                ? "text-emerald-300"
                                : "text-rose-300"
                            }`}
                          >
                            {transaction.type === "income" ? "+" : "-"}
                            {formatCurrency(transaction.amount)}
                          </p>
                          <button
                            aria-label={`Hapus transaksi ${transaction.note}`}
                            className="flex size-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-rose-200"
                            onClick={() => deleteTransaction(transaction.id)}
                            type="button"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-52 items-center justify-center px-6 text-center">
                    <div>
                      <CreditCard className="mx-auto text-zinc-600" size={34} />
                      <p className="mt-3 text-sm text-zinc-500">
                        {filteredTransactions.length > 0
                          ? "Tidak ada transaksi yang cocok dengan filter riwayat."
                          : "Belum ada catatan. Tulis pemasukan, belanja pribadi, atau transaksi usaha mikro pertama."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
