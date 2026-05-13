"use client";

import dynamic from "next/dynamic";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabase } from "@/lib/supabaseClient";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bot,
  CalendarDays,
  CreditCard,
  Download,
  FileText,
  HomeIcon,
  LineChart as LineChartIcon,
  Lock,
  LogOut,
  Mail,
  Menu,
  Package,
  Pencil,
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
  created_at?: string;
  type: "income" | "expense";
  space: TransactionSpace;
  category: string;
  amount: number;
  note: string;
  rawText: string;
  paymentMethod?: PaymentMethod | null;
};

const STORAGE_KEY = "catatkeu.transactions";
const STORAGE_EVENT = "catatkeu.transactions.updated";

const MoneyFlowChart = dynamic(() => import("./MoneyFlowChart"), {
  ssr: false,
});

type TransactionSpace = "personal" | "business";
type SpaceFilter = "all" | TransactionSpace;
type PeriodFilter = "today" | "week" | "month" | "all" | "custom";
type ActivePage = "dashboard" | "transactions" | "analytics";
type InputMode = "quick" | "business";
type HistoryTypeFilter = "all" | Transaction["type"];
type HistorySort = "newest" | "oldest" | "amount-desc" | "amount-asc";
type EditTransactionForm = {
  amount: string;
  category: string;
  date: string;
  note: string;
  space: TransactionSpace;
};
type BusinessTransactionKind = "sale" | "material";
type PaymentMethod = "cash" | "qris" | "transfer";
type MaterialUnit = "pcs" | "kg" | "gram" | "liter" | "pack" | "lainnya";
type TransactionRow = {
  id: string | number;
  user_id: string;
  date: string;
  type: Transaction["type"];
  category: string;
  amount: number;
  note: string;
  raw_text: string | null;
  space: TransactionSpace;
  payment_method: PaymentMethod | null;
  created_at?: string;
};

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
  { label: "Transaksi", icon: CreditCard, page: "transactions" as const },
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
  { label: "Semua", value: "all" },
  { label: "Custom tanggal", value: "custom" },
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

function getSpaceFilterLabel(space: SpaceFilter) {
  return space === "all" ? "Semua" : getSpaceLabel(space);
}

function getPeriodLabel(period: PeriodFilter) {
  return (
    periodFilterOptions.find((option) => option.value === period)?.label ??
    "Semua"
  );
}

function AuthScreen() {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegistering = authMode === "register";

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMessage("");
    setAuthError("");

    if (!hasSupabaseConfig || !supabase) {
      setAuthError(
        "Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setIsSubmitting(true);

    const credentials = {
      email: email.trim(),
      password,
    };

    const { data, error } = isRegistering
      ? await supabase.auth.signUp(credentials)
      : await supabase.auth.signInWithPassword(credentials);

    setIsSubmitting(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    if (isRegistering && !data.session) {
      setAuthMessage(
        "Pendaftaran berhasil. Cek email untuk konfirmasi sebelum login.",
      );
      setAuthMode("login");
      setPassword("");
      return;
    }

    setAuthMessage(
      isRegistering ? "Akun berhasil dibuat." : "Login berhasil.",
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07090d] px-4 py-8 text-zinc-100 sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-lg border border-white/10 bg-[#0b0f16] shadow-2xl shadow-black/25 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden min-h-[560px] flex-col justify-between bg-[linear-gradient(145deg,rgba(34,211,238,0.18),rgba(16,185,129,0.08)_45%,rgba(7,9,13,0.96))] p-8 lg:flex">
            <div>
              <div className="flex size-12 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/20">
                <Sparkles size={22} />
              </div>
              <h1 className="mt-6 text-3xl font-semibold leading-tight text-white">
                CatatKeu
              </h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-zinc-300">
                Masuk untuk membuka catatan keuangan harian. Data transaksi
                tetap tersimpan di perangkat ini.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium text-white">
                Local-first untuk transaksi
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Auth hanya mengatur akses aplikasi. Penyimpanan transaksi belum
                dipindahkan ke database.
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-8 lg:p-10">
            <div className="mb-8 lg:hidden">
              <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/20">
                <Sparkles size={20} />
              </div>
              <h1 className="text-2xl font-semibold text-white">CatatKeu</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Login untuk membuka aplikasi.
              </p>
            </div>

            <div className="mb-7">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
                {isRegistering ? "Daftar akun" : "Masuk akun"}
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                {isRegistering ? "Buat akun baru" : "Selamat datang kembali"}
              </h2>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-lg border border-white/10 bg-white/[0.03] p-1">
              <button
                className={`h-10 rounded-md text-sm font-medium transition ${
                  !isRegistering
                    ? "bg-cyan-200 text-zinc-950"
                    : "text-zinc-400 hover:text-white"
                }`}
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                  setAuthMessage("");
                }}
                type="button"
              >
                Login
              </button>
              <button
                className={`h-10 rounded-md text-sm font-medium transition ${
                  isRegistering
                    ? "bg-cyan-200 text-zinc-950"
                    : "text-zinc-400 hover:text-white"
                }`}
                onClick={() => {
                  setAuthMode("register");
                  setAuthError("");
                  setAuthMessage("");
                }}
                type="button"
              >
                Register
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleAuthSubmit}>
              <label className="block">
                <span className="text-sm font-medium text-zinc-300">Email</span>
                <span className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-white/10 bg-[#080b10] px-3 text-zinc-300 focus-within:border-cyan-200/60">
                  <Mail size={18} />
                  <input
                    autoComplete="email"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nama@email.com"
                    required
                    type="email"
                    value={email}
                  />
                </span>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-zinc-300">
                  Password
                </span>
                <span className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-white/10 bg-[#080b10] px-3 text-zinc-300 focus-within:border-cyan-200/60">
                  <Lock size={18} />
                  <input
                    autoComplete={
                      isRegistering ? "new-password" : "current-password"
                    }
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                    minLength={6}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimal 6 karakter"
                    required
                    type="password"
                    value={password}
                  />
                </span>
              </label>

              {authError ? (
                <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm leading-6 text-rose-200">
                  {authError}
                </p>
              ) : null}

              {authMessage ? (
                <p className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm leading-6 text-emerald-200">
                  {authMessage}
                </p>
              ) : null}

              <button
                className="flex h-12 w-full items-center justify-center rounded-lg bg-cyan-200 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? "Memproses..."
                  : isRegistering
                    ? "Daftar"
                    : "Login"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
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

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatReportAmount(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(amount);
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

function isInPeriod(
  date: string,
  period: PeriodFilter,
  todayKey: string,
  customDate = todayKey,
) {
  if (period === "all") {
    return true;
  }

  if (period === "custom") {
    return isValidDateKey(customDate) && date === customDate;
  }

  if (period === "today") {
    return date === todayKey;
  }

  const today = dateKeyToLocalDate(todayKey) ?? new Date();
  const range = period === "week" ? getWeekRange(today) : getMonthRange(today);

  return date >= range.start && date <= range.end;
}

function getTransactionTimestamp(transaction: Transaction) {
  if (transaction.created_at) {
    const createdAtTime = Date.parse(transaction.created_at);

    if (Number.isFinite(createdAtTime)) {
      return createdAtTime;
    }
  }

  const idTime = Number(transaction.id.split("-")[0]);

  if (Number.isFinite(idTime) && idTime > 0) {
    return idTime;
  }

  const dateTime = Date.parse(transaction.date);

  return Number.isFinite(dateTime) ? dateTime : 0;
}

function compareTransactionsByRecency(
  first: Transaction,
  second: Transaction,
) {
  const createdComparison =
    getTransactionTimestamp(second) - getTransactionTimestamp(first);

  if (createdComparison !== 0) {
    return createdComparison;
  }

  const dateComparison = second.date.localeCompare(first.date);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  return second.id.localeCompare(first.id);
}

function sortTransactionsByRecency(transactions: Transaction[]) {
  return [...transactions].sort(compareTransactionsByRecency);
}

function getReportFileBase(period: PeriodFilter, space: SpaceFilter) {
  return `catatkeu-${period}-${space}-${getTodayDateKey()}`;
}

function getTransactionTypeLabel(type: Transaction["type"]) {
  return type === "income" ? "Pemasukan" : "Pengeluaran";
}

function getTransactionMemo(transaction: Transaction) {
  return transaction.rawText || transaction.note;
}

function escapeCsvCell(value: string | number) {
  const stringValue = String(value);

  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const moneyUnitMultipliers: Record<string, number> = {
  rb: 1_000,
  ribu: 1_000,
  k: 1_000,
  jt: 1_000_000,
  juta: 1_000_000,
  m: 1_000_000,
};

const quantityUnits = new Set([
  "gelas",
  "pcs",
  "kg",
  "gram",
  "liter",
  "pack",
  "butir",
  "porsi",
]);

const transactionActionPattern =
  /\b(?:transfer\s+masuk|tambahan\s+modal|modal\s+tambahan|tambah\s+modal|setoran\s+modal|top\s*up\s+modal|topup\s+modal|modal\s+masuk|masuk\s+uang|gaji\s+karyawan|ambil\s+pribadi|pengeluaran|pemasukan|operasional|penjualan|listrik|sewa|biaya|jual|beli|bayar|gaji|bonus|modal)\b/gi;

function parseAmountValue(value: string) {
  const parsed = Number(value.replace(",", "."));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseAmount(rawText: string) {
  const normalized = rawText.toLowerCase();
  const moneyPattern = /(\d+(?:[,.]\d+)?)\s*(rb|ribu|jt|juta|k|m)\b/g;
  const quantityPricePattern =
    /(\d+(?:[,.]\d+)?)\s*(gelas|pcs|porsi)\b\s*(?:x|@|harga|per)?\s*(\d+(?:[,.]\d+)?)\s*(rb|ribu|jt|juta|k|m)\b/;
  const quantityPriceMatch = normalized.match(quantityPricePattern);

  if (quantityPriceMatch) {
    const quantity = parseAmountValue(quantityPriceMatch[1]);
    const unitPrice = parseAmountValue(quantityPriceMatch[3]);
    const multiplier = moneyUnitMultipliers[quantityPriceMatch[4]] ?? 1;

    return Math.round(quantity * unitPrice * multiplier);
  }

  const moneyMatches = Array.from(normalized.matchAll(moneyPattern));

  if (moneyMatches.length > 0) {
    const match = moneyMatches[0];
    const value = parseAmountValue(match[1]);
    const multiplier = moneyUnitMultipliers[match[2]] ?? 1;

    return Math.round(value * multiplier);
  }

  const numberPattern = /\d+(?:[,.]\d+)?/g;
  const numberMatches = Array.from(normalized.matchAll(numberPattern));
  const amountMatch = numberMatches.find((match) => {
    const previousWord = normalized
      .slice(0, match.index)
      .match(/([a-z]+)\s*$/)?.[1];
    const nextWord = normalized
      .slice(match.index + match[0].length)
      .match(/^\s*([a-z]+)/)?.[1];

    return !(
      (previousWord && quantityUnits.has(previousWord)) ||
      (nextWord && quantityUnits.has(nextWord))
    );
  });

  if (!amountMatch) {
    return 0;
  }

  return Math.round(parseAmountValue(amountMatch[0]));
}

function isCapitalInjection(rawText: string) {
  return /\b(?:tambahan\s+modal|modal\s+tambahan|tambah\s+modal|modal\s+masuk|setoran\s+modal|top\s*up\s+modal|topup\s+modal)\b/i.test(
    rawText,
  );
}

function inferType(rawText: string): Transaction["type"] {
  const normalized = rawText.toLowerCase();
  const incomeKeywords = [
    "transfer masuk",
    "tambahan modal",
    "topup modal",
    "modal masuk",
    "masuk uang",
    "penjualan",
    "pemasukan",
    "jual",
    "terjual",
    "laku",
    "omzet",
    "omset",
    "bayar piutang",
    "piutang dibayar",
    "bonus",
    "terima",
    "refund",
  ];

  if (isCapitalInjection(normalized)) {
    return "income";
  }

  if (incomeKeywords.some((keyword) => normalized.includes(keyword))) {
    return "income";
  }

  const expenseKeywords = [
    "bayar utang",
    "bayar hutang",
    "gaji karyawan",
    "bayar gaji",
    "pengeluaran",
    "beli",
    "kulakan",
    "bahan",
    "biaya",
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

  return "expense";
}

function inferCategory(rawText: string, type: Transaction["type"]) {
  const normalized = rawText.toLowerCase();

  if (isCapitalInjection(normalized)) {
    return "Modal";
  }

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
      "kulakan",
      "stok",
      "barang dagangan",
      "supplier",
      "minyak",
      "tepung",
      "gas",
    ].some((keyword) => normalized.includes(keyword))
  ) {
    return "Bahan/Modal";
  }

  if (type === "income" && normalized.includes("modal")) {
    return "Modal";
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

function inferPaymentMethod(rawText: string): PaymentMethod | null {
  const normalized = rawText.toLowerCase();

  if (normalized.includes("qris")) {
    return "qris";
  }

  if (normalized.includes("transfer")) {
    return "transfer";
  }

  if (normalized.includes("cash")) {
    return "cash";
  }

  return null;
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
    created_at: new Date().toISOString(),
    type,
    space,
    category: inferCategory(trimmedText, type),
    amount,
    note: trimmedText,
    rawText: trimmedText,
    paymentMethod: inferPaymentMethod(trimmedText),
  };
}

function splitQuickTransactionText(rawText: string) {
  return rawText
    .split(/,(?=\s*\D)|\s+(?:dan|lalu|terus)\s+/i)
    .flatMap((text) => splitTextByTransactionActions(text))
    .map((text) => text.trim())
    .filter(Boolean);
}

function splitTextByTransactionActions(rawText: string) {
  const text = rawText.trim();
  const matches = Array.from(text.matchAll(transactionActionPattern));

  if (matches.length <= 1) {
    return [text];
  }

  const parts: string[] = [];
  let segmentStart = 0;

  matches.forEach((match) => {
    const actionStart = match.index ?? 0;

    if (actionStart === segmentStart) {
      return;
    }

    const currentSegment = text.slice(segmentStart, actionStart).trim();

    if (parseAmount(currentSegment) > 0) {
      parts.push(currentSegment);
      segmentStart = actionStart;
    }
  });

  parts.push(text.slice(segmentStart).trim());

  return parts;
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

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "cash" || value === "qris" || value === "transfer";
}

function normalizeApiTransaction(
  value: unknown,
  space: TransactionSpace,
  date: string,
): Transaction | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const transaction = value as Partial<Transaction>;
  const amount =
    typeof transaction.amount === "number"
      ? Math.round(transaction.amount)
      : Number.NaN;
  const type =
    transaction.type === "income" || transaction.type === "expense"
      ? transaction.type
      : null;
  const rawText =
    typeof transaction.rawText === "string" ? transaction.rawText.trim() : "";
  const note =
    typeof transaction.note === "string" && transaction.note.trim()
      ? transaction.note.trim()
      : rawText;
  const category =
    typeof transaction.category === "string" && transaction.category.trim()
      ? transaction.category.trim()
      : type === "income"
        ? "Penjualan"
        : "Lainnya";

  if (!type || !Number.isFinite(amount) || amount <= 0 || !rawText) {
    return null;
  }

  return {
    id:
      typeof transaction.id === "string" && transaction.id
        ? transaction.id
        : `${Date.now()}-${crypto.randomUUID()}`,
    date: normalizeDateKey(transaction.date ?? date) ?? date,
    created_at:
      typeof transaction.created_at === "string"
        ? transaction.created_at
        : new Date().toISOString(),
    type,
    space,
    category,
    amount,
    note,
    rawText,
    paymentMethod: isPaymentMethod(transaction.paymentMethod)
      ? transaction.paymentMethod
      : null,
  };
}

async function createAiQuickTransactions(
  rawText: string,
  space: TransactionSpace,
  date: string,
) {
  const response = await fetch("/api/parse-transaction", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      date,
      space,
      text: rawText,
    }),
  });

  if (!response.ok) {
    throw new Error("AI parser gagal.");
  }

  const parsed: unknown = await response.json();

  if (!Array.isArray(parsed)) {
    throw new Error("Format hasil AI tidak valid.");
  }

  return parsed
    .map((transaction) => normalizeApiTransaction(transaction, space, date))
    .filter((transaction): transaction is Transaction => Boolean(transaction));
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
      created_at: new Date().toISOString(),
      type: "income",
      space: "business",
      category: "Penjualan",
      amount: total,
      note: transactionNote,
      rawText,
      paymentMethod: form.paymentMethod,
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
    created_at: new Date().toISOString(),
    type: "expense",
    space: "business",
    category: "Bahan/Modal",
    amount: total,
    note: transactionNote,
    rawText,
    paymentMethod: form.paymentMethod,
  };
}

function normalizeTransaction(value: unknown): Transaction | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const transaction = value as Record<string, unknown>;
  const { amount, category, created_at, id, note, rawText, type } = transaction;

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
  const paymentMethod =
    transaction.paymentMethod === "cash" ||
    transaction.paymentMethod === "qris" ||
    transaction.paymentMethod === "transfer"
      ? transaction.paymentMethod
      : null;

  return {
    id,
    date,
    created_at: typeof created_at === "string" ? created_at : undefined,
    type,
    space,
    category,
    amount,
    note,
    rawText,
    paymentMethod,
  };
}

function normalizeTransactionRow(row: TransactionRow): Transaction | null {
  return normalizeTransaction({
    id: String(row.id),
    date: row.date,
    created_at: row.created_at,
    type: row.type,
    space: row.space,
    category: row.category,
    amount: row.amount,
    note: row.note,
    rawText: row.raw_text ?? "",
    paymentMethod: row.payment_method,
  });
}

function toTransactionPayload(transaction: Transaction, userId: string) {
  return {
    user_id: userId,
    date: normalizeDateKey(transaction.date) ?? getTodayDateKey(),
    type: transaction.type,
    category: transaction.category,
    amount: transaction.amount,
    note: transaction.note,
    raw_text: transaction.rawText,
    space: transaction.space,
    payment_method: transaction.paymentMethod ?? null,
  };
}

function parseTransactions(stored: string | null) {
  if (!stored) {
    const sortedDummyTransactions = sortTransactionsByRecency(dummyTransactions);
    console.log("parsedTransactions", sortedDummyTransactions);
    return sortedDummyTransactions;
  }

  if (stored === cachedStorageValue) {
    console.log("parsedTransactions", cachedTransactions);
    return cachedTransactions;
  }

  cachedStorageValue = stored;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      cachedTransactions = sortTransactionsByRecency(dummyTransactions);
      return cachedTransactions;
    }

    cachedTransactions = sortTransactionsByRecency(
      parsed
        .map(normalizeTransaction)
        .filter((transaction): transaction is Transaction =>
          Boolean(transaction),
        ),
    );
  } catch {
    cachedTransactions = sortTransactionsByRecency(dummyTransactions);
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

function writeTransactions(transactions: Transaction[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  cachedStorageValue = JSON.stringify(transactions);
  cachedTransactions = transactions;
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

async function getAuthenticatedUserId() {
  if (!supabase) {
    throw new Error("Supabase belum dikonfigurasi.");
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error(error?.message || "Sesi login tidak ditemukan.");
  }

  return data.user.id;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [transactionError, setTransactionError] = useState("");
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
  const [historyCustomDate, setHistoryCustomDate] = useState(getTodayDateKey);
  const [editingTransactionId, setEditingTransactionId] = useState<
    string | null
  >(null);
  const [editForm, setEditForm] = useState<EditTransactionForm>({
    amount: "",
    category: "",
    date: getTodayDateKey(),
    note: "",
    space: "business",
  });
  const [selectedDate, setSelectedDate] = useState(getTodayDateKey);
  const [inputMode, setInputMode] = useState<InputMode>("quick");
  const [businessForm, setBusinessForm] =
    useState<BusinessForm>(initialBusinessForm);

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => {
        setIsAuthLoading(false);
      });
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (isMounted) {
          setSession(data.session);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      queueMicrotask(() => {
        setTransactions([]);
        setIsTransactionsLoading(false);
      });
      return;
    }

    let isMounted = true;

    async function loadTransactions() {
      setIsTransactionsLoading(true);
      setTransactionError("");

      if (!supabase) {
        if (isMounted) {
          setTransactions(getTransactionsSnapshot());
          setTransactionError(
            "Supabase belum dikonfigurasi. Menampilkan data lokal sementara.",
          );
          setIsTransactionsLoading(false);
        }
        return;
      }

      try {
        const userId = await getAuthenticatedUserId();
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .order("date", { ascending: false })
          .order("id", { ascending: false });

        if (error) {
          throw error;
        }

        const loadedTransactions = sortTransactionsByRecency(
          ((data ?? []) as TransactionRow[])
            .map(normalizeTransactionRow)
            .filter((transaction): transaction is Transaction =>
              Boolean(transaction),
            ),
        );

        if (isMounted) {
          setTransactions(loadedTransactions);
          writeTransactions(loadedTransactions);
        }
      } catch (error) {
        if (isMounted) {
          setTransactions(getTransactionsSnapshot());
          setTransactionError(
            `Gagal memuat transaksi dari Supabase. Menampilkan data lokal sementara. ${
              error instanceof Error ? error.message : ""
            }`.trim(),
          );
        }
      } finally {
        if (isMounted) {
          setIsTransactionsLoading(false);
        }
      }
    }

    loadTransactions();

    return () => {
      isMounted = false;
    };
  }, [session]);

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
      const matchesPeriod =
        activePage === "dashboard" ||
        isInPeriod(transactionDateKey, periodFilter, todayKey, historyCustomDate);

      return matchesSpace && matchesPeriod;
    });
  }, [
    activePage,
    historyCustomDate,
    periodFilter,
    spaceFilter,
    todayKey,
    transactions,
  ]);

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

  const latestTransactions = useMemo(() => {
    return [...transactions].sort(compareTransactionsByRecency).slice(0, 5);
  }, [transactions]);

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

  function exportCsvReport() {
    const rows = [...filteredTransactions]
      .sort(compareTransactionsByRecency)
      .map((transaction) => [
        transaction.date,
        getTransactionTypeLabel(transaction.type),
        transaction.category,
        transaction.amount,
        getSpaceLabel(transaction.space),
        getTransactionMemo(transaction),
      ]);
    const csv = [
      ["tanggal", "tipe", "kategori", "nominal", "ruang", "catatan/rawText"],
      ...rows,
    ]
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\r\n");

    downloadBlob(
      csv,
      `${getReportFileBase(periodFilter, spaceFilter)}.csv`,
      "text/csv;charset=utf-8",
    );
  }

  async function exportPdfReport() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      format: "a4",
      orientation: "landscape",
      unit: "mm",
    });
    const transactionsForReport = [...filteredTransactions].sort(
      compareTransactionsByRecency,
    );
    const marginX = 14;
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const periodText = getPeriodLabel(periodFilter);
    const spaceText = getSpaceFilterLabel(spaceFilter);
    const columns = [
      { key: "date", label: "Tanggal", width: 31 },
      { key: "type", label: "Tipe", width: 30 },
      { key: "category", label: "Kategori", width: 42 },
      { key: "amount", label: "Nominal", width: 32 },
      { key: "space", label: "Ruang", width: 28 },
      { key: "memo", label: "Catatan/rawText", width: 106 },
    ] as const;

    function drawHeader() {
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      doc.setTextColor(17, 24, 39);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Laporan Keuangan CatatKeu", marginX, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(82, 82, 91);
      doc.text(`Dibuat: ${formatDateTime(new Date())}`, marginX, 25);
    }

    function drawTableHeader(y: number) {
      let x = marginX;
      doc.setFillColor(244, 244, 245);
      doc.setDrawColor(212, 212, 216);
      doc.setTextColor(39, 39, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);

      columns.forEach((column) => {
        doc.rect(x, y, column.width, 8, "FD");
        doc.text(column.label, x + 2, y + 5.2);
        x += column.width;
      });

      return y + 8;
    }

    function splitCellText(value: string, width: number) {
      const lines = doc.splitTextToSize(value || "-", width - 4) as string[];

      if (lines.length <= 3) {
        return lines;
      }

      return [...lines.slice(0, 2), `${lines[2]}...`];
    }

    drawHeader();

    doc.setDrawColor(228, 228, 231);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(marginX, 33, pageWidth - marginX * 2, 24, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(82, 82, 91);
    doc.text(`Periode: ${periodText}`, marginX + 5, 41);
    doc.text(`Ruang catatan: ${spaceText}`, marginX + 5, 49);

    [
      ["Saldo", totals.balance],
      ["Pemasukan", totals.income],
      ["Pengeluaran", totals.expense],
    ].forEach(([label, value], index) => {
      const x = marginX + 92 + index * 53;
      doc.setTextColor(82, 82, 91);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(String(label), x, 41);
      doc.setTextColor(17, 24, 39);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(formatCurrency(Number(value)), x, 49);
    });

    let y = 68;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text("Transaksi", marginX, y);
    y += 5;
    y = drawTableHeader(y);

    if (transactionsForReport.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(113, 113, 122);
      doc.text("Tidak ada transaksi pada filter aktif.", marginX, y + 9);
    }

    transactionsForReport.forEach((transaction) => {
      const values = {
        amount: formatReportAmount(transaction.amount),
        category: transaction.category,
        date: formatDate(transaction.date),
        memo: getTransactionMemo(transaction),
        space: getSpaceLabel(transaction.space),
        type: getTransactionTypeLabel(transaction.type),
      };
      const cellLines = columns.map((column) =>
        splitCellText(values[column.key], column.width),
      );
      const rowHeight = Math.max(
        9,
        Math.max(...cellLines.map((lines) => lines.length)) * 4.2 + 4,
      );

      if (y + rowHeight > pageHeight - 14) {
        doc.addPage();
        drawHeader();
        y = drawTableHeader(35);
      }

      let x = marginX;
      doc.setDrawColor(228, 228, 231);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(39, 39, 42);

      columns.forEach((column, index) => {
        doc.rect(x, y, column.width, rowHeight);
        cellLines[index].forEach((line, lineIndex) => {
          doc.text(line, x + 2, y + 5 + lineIndex * 4.2);
        });
        x += column.width;
      });

      y += rowHeight;
    });

    doc.save(`${getReportFileBase(periodFilter, spaceFilter)}.pdf`);
  }

  function commitTransactions(nextTransactions: Transaction[]) {
    const normalizedTransactions = sortTransactionsByRecency(
      nextTransactions.map((transaction) => ({
        ...transaction,
        date: normalizeDateKey(transaction.date) ?? getTodayDateKey(),
      })),
    );

    setTransactions(normalizedTransactions);
    writeTransactions(normalizedTransactions);
    console.log("transactions setelah update", normalizedTransactions);

    return normalizedTransactions;
  }

  async function insertTransactionsToSupabase(nextTransactions: Transaction[]) {
    if (!supabase) {
      throw new Error("Supabase belum dikonfigurasi.");
    }

    const userId = await getAuthenticatedUserId();
    const { data, error } = await supabase
      .from("transactions")
      .insert(
        nextTransactions.map((transaction) =>
          toTransactionPayload(transaction, userId),
        ),
      )
      .select("*");

    if (error) {
      throw error;
    }

    return ((data ?? []) as TransactionRow[])
      .map(normalizeTransactionRow)
      .filter((transaction): transaction is Transaction =>
        Boolean(transaction),
      );
  }

  async function updateTransactionInSupabase(transaction: Transaction) {
    if (!supabase) {
      throw new Error("Supabase belum dikonfigurasi.");
    }

    const userId = await getAuthenticatedUserId();
    const { data, error } = await supabase
      .from("transactions")
      .update(toTransactionPayload(transaction, userId))
      .eq("id", transaction.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const updatedTransaction = normalizeTransactionRow(data as TransactionRow);

    if (!updatedTransaction) {
      throw new Error("Data transaksi dari Supabase tidak valid.");
    }

    return updatedTransaction;
  }

  async function deleteTransactionFromSupabase(id: string) {
    if (!supabase) {
      throw new Error("Supabase belum dikonfigurasi.");
    }

    const userId = await getAuthenticatedUserId();
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }
  }

  function showSubmittedDateIfFilteredOut(date: string) {
    if (!isInPeriod(date, periodFilter, todayKey, historyCustomDate)) {
      setPeriodFilter("all");
    }
  }

  async function addTransaction(inputText = rawText) {
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

    setIsSavingTransaction(true);
    setTransactionError("");

    let nextTransactions: Transaction[] = [];

    try {
      nextTransactions = await createAiQuickTransactions(
        trimmedText,
        activeInputSpace,
        selectedDate,
      );
    } catch (error) {
      console.warn("AI parser gagal, memakai parser manual.", error);
      nextTransactions = createQuickTransactions(
        trimmedText,
        activeInputSpace,
        selectedDate,
      );
    }

    if (nextTransactions.length <= 0) {
      setQuickFeedback("");
      setIsSavingTransaction(false);
      return;
    }

    const updatedTransactions = [...nextTransactions, ...transactions];
    console.log("newTransactions", nextTransactions);

    try {
      const savedTransactions = await insertTransactionsToSupabase(
        nextTransactions,
      );
      const committedTransactions = commitTransactions([
        ...(savedTransactions.length > 0 ? savedTransactions : nextTransactions),
        ...transactions,
      ]);

      if (
        !committedTransactions.some((current) =>
          (savedTransactions.length > 0 ? savedTransactions : nextTransactions)
            .some((transaction) => transaction.id === current.id),
        )
      ) {
        setQuickFeedback("");
        return;
      }
    } catch (error) {
      commitTransactions(updatedTransactions);
      setTransactionError(
        `Gagal simpan ke Supabase. Transaksi disimpan lokal sementara. ${
          error instanceof Error ? error.message : ""
        }`.trim(),
      );
    } finally {
      setIsSavingTransaction(false);
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

  async function addBusinessTransaction() {
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
    setIsSavingTransaction(true);
    setTransactionError("");

    try {
      const savedTransactions = await insertTransactionsToSupabase([
        transaction,
      ]);
      const savedTransaction = savedTransactions[0] ?? transaction;
      const committedTransactions = commitTransactions([
        savedTransaction,
        ...transactions,
      ]);

      if (!committedTransactions.some((current) => current.id === savedTransaction.id)) {
        return;
      }
    } catch (error) {
      commitTransactions(updatedTransactions);
      setTransactionError(
        `Gagal simpan ke Supabase. Transaksi disimpan lokal sementara. ${
          error instanceof Error ? error.message : ""
        }`.trim(),
      );
    } finally {
      setIsSavingTransaction(false);
    }

    showSubmittedDateIfFilteredOut(selectedDate);
    setBusinessForm((current) => ({
      ...initialBusinessForm,
      kind: current.kind,
      paymentMethod: current.paymentMethod,
    }));
  }

  async function deleteTransaction(id: string) {
    const updatedTransactions = transactions.filter(
      (transaction) => transaction.id !== id,
    );

    setIsSavingTransaction(true);
    setTransactionError("");

    try {
      await deleteTransactionFromSupabase(id);
      commitTransactions(updatedTransactions);
    } catch (error) {
      commitTransactions(updatedTransactions);
      setTransactionError(
        `Gagal hapus di Supabase. Perubahan disimpan lokal sementara. ${
          error instanceof Error ? error.message : ""
        }`.trim(),
      );
    } finally {
      setIsSavingTransaction(false);
    }

    if (editingTransactionId === id) {
      setEditingTransactionId(null);
    }
  }

  function startEditTransaction(transaction: Transaction) {
    setEditingTransactionId(transaction.id);
    setEditForm({
      amount: String(transaction.amount),
      category: transaction.category,
      date: transaction.date,
      note: transaction.note,
      space: transaction.space,
    });
  }

  function updateEditForm<Field extends keyof EditTransactionForm>(
    field: Field,
    value: EditTransactionForm[Field],
  ) {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function cancelEditTransaction() {
    setEditingTransactionId(null);
  }

  async function saveEditTransaction(id: string) {
    const amount = Math.round(Number(editForm.amount));
    const date = normalizeDateKey(editForm.date);
    const category = editForm.category.trim();
    const note = editForm.note.trim();

    if (!Number.isFinite(amount) || amount <= 0 || !date || !category || !note) {
      return;
    }

    const updatedTransaction = transactions.find(
      (transaction) => transaction.id === id,
    );

    if (!updatedTransaction) {
      return;
    }

    const nextTransaction = {
      ...updatedTransaction,
      amount,
      category,
      date,
      note,
      rawText: updatedTransaction.rawText || note,
      space: editForm.space,
    };
    const updatedTransactions = transactions.map((transaction) =>
      transaction.id === id ? nextTransaction : transaction,
    );

    setIsSavingTransaction(true);
    setTransactionError("");

    try {
      const savedTransaction = await updateTransactionInSupabase(
        nextTransaction,
      );
      commitTransactions(
        transactions.map((transaction) =>
          transaction.id === id ? savedTransaction : transaction,
        ),
      );
    } catch (error) {
      commitTransactions(updatedTransactions);
      setTransactionError(
        `Gagal simpan perubahan ke Supabase. Perubahan disimpan lokal sementara. ${
          error instanceof Error ? error.message : ""
        }`.trim(),
      );
    } finally {
      setIsSavingTransaction(false);
    }

    setEditingTransactionId(null);
  }

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
  }

  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090d] px-6 text-zinc-100">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/20">
            <Sparkles size={20} />
          </div>
          <p className="text-sm font-medium text-zinc-300">Memuat sesi...</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07090d] text-zinc-100">
      <div className="min-h-screen w-full">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/10 bg-[#0b0f16]/90 px-5 py-7 xl:flex xl:flex-col 2xl:w-72">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/20">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">CatatKeu</h1>
              <p className="mt-0.5 text-xs leading-5 text-zinc-400">
                Catatan uang simpel untuk pribadi & UMKM
              </p>
            </div>
          </div>

          <nav className="mt-9 space-y-1.5">
            {navItems.map((item) => (
              <button
                className={`flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition ${
                  activePage === item.page
                    ? "bg-cyan-200 text-zinc-950 shadow-lg shadow-cyan-950/15"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
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
            <p className="text-sm font-medium text-white">Ruang uang harian</p>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              Ringkas untuk mengecek pemasukan, pengeluaran, dan arus kas.
            </p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col xl:pl-64 2xl:pl-72">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07090d]/88 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8 2xl:px-10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  aria-label="Buka menu"
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-300 xl:hidden"
                  onClick={() => setIsMobileNavOpen((current) => !current)}
                  type="button"
                >
                  <Menu size={20} />
                </button>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
                    CatatKeu
                  </p>
                  <h2 className="text-[clamp(1.05rem,3.8vw,1.5rem)] font-semibold leading-tight text-white">
                    {activePage === "dashboard"
                      ? "Ringkasan Uang Harian"
                      : activePage === "transactions"
                        ? "Pusat Transaksi"
                        : "Analitik Keuangan"}
                  </h2>
                  <p className="mt-1 hidden text-sm text-zinc-400 sm:block">
                    Catatan uang simpel untuk pribadi & UMKM
                  </p>
                </div>
              </div>
              <button
                className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
                onClick={handleLogout}
                type="button"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
            {isMobileNavOpen ? (
              <nav className="fixed inset-x-4 top-[84px] z-30 grid gap-2 rounded-lg border border-white/10 bg-[#0b0f16]/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:left-auto sm:w-80 xl:hidden">
                {navItems.map((item) => (
                  <button
                    className={`flex h-12 items-center justify-start gap-3 rounded-lg px-3 text-sm font-medium transition ${
                      activePage === item.page
                        ? "bg-cyan-200 text-zinc-950 shadow-lg shadow-cyan-950/20"
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

          {isTransactionsLoading || transactionError ? (
            <div className="px-4 pt-4 sm:px-6 lg:px-8 2xl:px-10">
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  transactionError
                    ? "border-rose-300/20 bg-rose-400/10 text-rose-100"
                    : "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
                }`}
              >
                {transactionError || "Memuat transaksi..."}
              </div>
            </div>
          ) : null}

          <div className="grid w-full gap-5 px-4 py-5 sm:grid-cols-2 sm:px-6 sm:py-6 lg:grid-cols-12 lg:gap-6 lg:px-8 lg:py-8 2xl:gap-7 2xl:px-10">
            <section className="grid gap-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-12 xl:grid-cols-3">
              <div className="grid gap-3 sm:col-span-2 lg:grid-cols-2 xl:col-span-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Ruang catatan
                  </p>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                    {spaceFilterOptions.map((option) => (
                      <button
                        className={`h-10 shrink-0 rounded-lg px-4 text-sm font-medium transition ${
                          spaceFilter === option.value
                            ? "bg-teal-200 text-zinc-950 shadow-lg shadow-teal-950/20"
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
                {activePage === "analytics" ? (
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Periode
                  </p>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                    {periodFilterOptions.map((option) => (
                      <button
                        className={`h-10 shrink-0 rounded-lg px-4 text-sm font-medium transition ${
                          periodFilter === option.value
                            ? "bg-cyan-200 text-zinc-950 shadow-lg shadow-cyan-950/20"
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
                ) : null}
              </div>
              {summaryCards.map((card, index) => (
                <article
                  className={`min-w-0 rounded-lg border border-white/10 p-5 shadow-2xl shadow-black/15 sm:p-6 ${
                    index === 0
                      ? "bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(168,85,247,0.13)_48%,rgba(15,23,42,0.86))]"
                      : "bg-white/[0.04]"
                  }`}
                  key={card.label}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-400">{card.label}</p>
                      <p className="mt-3 break-words text-[clamp(1.35rem,3vw,1.85rem)] font-semibold leading-tight tracking-tight text-white">
                        {card.value}
                      </p>
                    </div>
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10 sm:size-11 ${card.tone}`}
                    >
                      <card.icon size={22} />
                    </div>
                  </div>
                  <p className="mt-5 break-words text-sm text-zinc-500">{card.helper}</p>
                </article>
              ))}
            </section>

            {activePage === "dashboard" ? (
              <section className="rounded-lg border border-cyan-200/15 bg-[linear-gradient(180deg,rgba(18,30,43,0.88),rgba(11,18,27,0.82))] p-5 shadow-2xl shadow-cyan-950/15 sm:col-span-2 lg:col-span-12 lg:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-zinc-400">Input transaksi</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    Mau catat apa hari ini?
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                    Tulis pemasukan atau pengeluaran dengan bahasa sehari-hari.
                  </p>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-200/20 sm:size-11">
                  <Sparkles size={18} />
                </div>
              </div>

              {activeInputSpace ? (
                <div
                  className={`mt-6 grid gap-2 rounded-lg border border-white/10 bg-[#080b10] p-1.5 ${
                    activeInputSpace === "business"
                      ? "grid-cols-1 sm:grid-cols-2"
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
                  <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-100">
                    <Wallet size={20} />
                  </div>
                  <p className="text-sm text-zinc-400">
                    Pilih Pribadi atau Usaha untuk mencatat transaksi
                  </p>
                </div>
              ) : activeInputMode === "quick" ? (
                <div className="mt-5 rounded-lg border border-white/10 bg-[#080b10] p-4 shadow-inner shadow-black/10 sm:p-5">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-zinc-300">
                      Catat Cepat
                    </p>
                    <label
                      className="flex min-w-0 items-center gap-2 text-sm text-zinc-400"
                      htmlFor="quick-date"
                    >
                      <CalendarDays size={16} />
                      <input
                        className="h-11 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 sm:w-40"
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
                    className="min-h-44 w-full resize-none bg-transparent text-base leading-7 text-zinc-100 outline-none placeholder:text-zinc-600 sm:min-h-40"
                    onChange={(event) => {
                      setRawText(event.target.value);
                      setQuickFeedback("");
                    }}
                    placeholder="Tulis transaksi seperti kamu mencatat di chat..."
                    value={rawText}
                  />
                  <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-zinc-500">
                      {quickFeedback ||
                        `Disimpan ke ruang ${getSpaceLabel(activeInputSpace)}.`}
                    </p>
                    <button
                      className="inline-flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-lg bg-cyan-200 px-5 text-sm font-semibold text-zinc-950 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      disabled={
                        isSavingTransaction ||
                        isTransactionsLoading ||
                        !hasValidSelectedDate ||
                        !rawText.trim()
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
                <div className="mt-5 rounded-lg border border-white/10 bg-[#080b10] p-4 shadow-inner shadow-black/10 sm:p-5">
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
                      <div className="mt-2 flex min-w-0 items-center gap-2 text-zinc-400">
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
                        className="mt-2 flex h-11 items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-white"
                        id="business-total"
                      >
                        <span className="truncate">{formatCurrency(businessTotal)}</span>
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
                      className="inline-flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-lg bg-cyan-200 px-5 text-sm font-semibold text-zinc-950 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      disabled={
                        isSavingTransaction ||
                        isTransactionsLoading ||
                        !hasValidSelectedDate ||
                        !canSubmitBusiness
                      }
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

            {activePage === "transactions" ? (
              <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 sm:col-span-2 lg:col-span-12 lg:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">Transaksi</p>
                    <h3 className="mt-1 text-lg font-semibold text-white">
                      Pencarian dan pengelolaan
                    </h3>
                  </div>
                  <p className="w-fit max-w-full rounded-lg border border-white/10 bg-[#080b10] px-3 py-2 text-sm text-zinc-400">
                    {sortedTransactions.length} dari {filteredTransactions.length} transaksi
                  </p>
                </div>

                <div className="mt-5 grid gap-3 rounded-lg border border-white/10 bg-[#080b10] p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-500">
                      Search transaksi
                    </span>
                    <div className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-[#0d1118] px-3 text-zinc-400">
                      <Search size={16} />
                      <input
                        className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                        onChange={(event) =>
                          setHistorySearch(event.target.value)
                        }
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
                      className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
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
                      className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
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
                      className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
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

                <div className="mt-3 rounded-lg border border-white/10 bg-[#080b10] p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Filter tanggal
                  </p>
                  <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                      {periodFilterOptions.map((option) => (
                        <button
                          className={`h-10 shrink-0 rounded-lg px-4 text-sm font-medium transition ${
                            periodFilter === option.value
                              ? "bg-cyan-200 text-zinc-950 shadow-lg shadow-cyan-950/20"
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
                    {periodFilter === "custom" ? (
                      <label
                        className="flex min-w-0 items-center gap-2 text-sm text-zinc-400"
                        htmlFor="history-custom-date"
                      >
                        <CalendarDays size={16} />
                        <input
                          className="h-11 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 sm:w-44"
                          id="history-custom-date"
                          onChange={(event) =>
                            setHistoryCustomDate(event.target.value)
                          }
                          type="date"
                          value={historyCustomDate}
                        />
                      </label>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 min-h-72 space-y-3">
                  {isTransactionsLoading ? (
                    <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#080b10] px-6 text-center">
                      <p className="text-sm font-medium text-zinc-300">
                        Memuat transaksi...
                      </p>
                    </div>
                  ) : sortedTransactions.length > 0 ? (
                    sortedTransactions.map((transaction) => {
                      const isEditing = editingTransactionId === transaction.id;

                      return (
                        <article
                          className="rounded-lg border border-white/10 bg-[#080b10] p-4 shadow-lg shadow-black/10 transition hover:border-cyan-200/20 hover:bg-[#0b111a] sm:p-5"
                          key={transaction.id}
                        >
                          {isEditing ? (
                            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
                              <label className="block">
                                <span className="text-xs font-medium text-zinc-500">
                                  Nominal
                                </span>
                                <input
                                  className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
                                  min="0"
                                  onChange={(event) =>
                                    updateEditForm("amount", event.target.value)
                                  }
                                  type="number"
                                  value={editForm.amount}
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs font-medium text-zinc-500">
                                  Kategori
                                </span>
                                <input
                                  className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
                                  onChange={(event) =>
                                    updateEditForm(
                                      "category",
                                      event.target.value,
                                    )
                                  }
                                  type="text"
                                  value={editForm.category}
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs font-medium text-zinc-500">
                                  Tanggal
                                </span>
                                <input
                                  className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
                                  onChange={(event) =>
                                    updateEditForm("date", event.target.value)
                                  }
                                  type="date"
                                  value={editForm.date}
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs font-medium text-zinc-500">
                                  Ruang catatan
                                </span>
                                <select
                                  className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#0d1118] px-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
                                  onChange={(event) =>
                                    updateEditForm(
                                      "space",
                                      event.target.value as TransactionSpace,
                                    )
                                  }
                                  value={editForm.space}
                                >
                                  {spaceOptions.map((option) => (
                                    <option
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block md:col-span-2 2xl:col-span-5">
                                <span className="text-xs font-medium text-zinc-500">
                                  Catatan
                                </span>
                                <textarea
                                  className="mt-2 min-h-20 w-full resize-none rounded-lg border border-white/10 bg-[#0d1118] px-3 py-3 text-sm leading-6 text-white outline-none transition focus:border-cyan-300/60"
                                  onChange={(event) =>
                                    updateEditForm("note", event.target.value)
                                  }
                                  value={editForm.note}
                                />
                              </label>
                              <div className="flex flex-col gap-2 md:col-span-2 md:flex-row 2xl:col-span-5">
                                <button
                                  className="inline-flex h-11 items-center justify-center rounded-lg bg-cyan-200 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  disabled={isSavingTransaction}
                                  onClick={() =>
                                    saveEditTransaction(transaction.id)
                                  }
                                  type="button"
                                >
                                  Simpan
                                </button>
                                <button
                                  className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
                                  onClick={cancelEditTransaction}
                                  type="button"
                                >
                                  Batal
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex min-w-0 gap-3">
                                <div
                                  className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg ${
                                    transaction.type === "income"
                                      ? "bg-emerald-400/10 text-emerald-200"
                                      : "bg-rose-400/10 text-rose-200"
                                  }`}
                                >
                                  {transaction.type === "income" ? (
                                    <ArrowUpRight size={18} />
                                  ) : (
                                    <ArrowDownLeft size={18} />
                                  )}
                                </div>
                                <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="min-w-0 break-words font-medium text-white">
                                    {transaction.note}
                                  </p>
                                  <span
                                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                                      transaction.type === "income"
                                        ? "bg-emerald-400/10 text-emerald-200"
                                        : "bg-rose-400/10 text-rose-200"
                                    }`}
                                  >
                                    {getTransactionTypeLabel(transaction.type)}
                                  </span>
                                  <span className="rounded-md bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300">
                                    {getSpaceLabel(transaction.space)}
                                  </span>
                                </div>
                                <p className="mt-2 break-words text-sm text-zinc-500">
                                  {formatDate(transaction.date)} -{" "}
                                  {transaction.category}
                                </p>
                                <p className="mt-1 truncate text-sm text-zinc-600">
                                  {transaction.rawText}
                                </p>
                                </div>
                              </div>
                              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 pl-[52px] sm:justify-end sm:pl-0">
                                <p
                                  className={`min-w-0 break-words text-right text-[clamp(0.95rem,2.4vw,1.125rem)] font-semibold leading-tight ${
                                    transaction.type === "income"
                                      ? "text-emerald-300"
                                      : "text-rose-300"
                                  }`}
                                >
                                  {transaction.type === "income" ? "+" : "-"}
                                  {formatCurrency(transaction.amount)}
                                </p>
                                <button
                                  aria-label={`Edit transaksi ${transaction.note}`}
                                  className="flex size-11 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 sm:size-10"
                                  disabled={isSavingTransaction}
                                  onClick={() =>
                                    startEditTransaction(transaction)
                                  }
                                  type="button"
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  aria-label={`Hapus transaksi ${transaction.note}`}
                                  className="flex size-11 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50 sm:size-10"
                                  disabled={isSavingTransaction}
                                  onClick={() =>
                                    deleteTransaction(transaction.id)
                                  }
                                  type="button"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })
                  ) : (
                    <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#080b10] px-6 text-center">
                      <div>
                        <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-400">
                          <CreditCard size={24} />
                        </div>
                        <p className="mt-4 text-base font-medium text-zinc-200">
                          {filteredTransactions.length > 0
                            ? "Tidak ada transaksi yang cocok"
                            : "Belum ada transaksi"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-zinc-500">
                          {filteredTransactions.length > 0
                            ? "Sesuaikan kata kunci, kategori, atau periode yang dipilih."
                            : "Mulai catat pemasukan atau pengeluaran pertamamu."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {activePage === "analytics" ? (
              <>
                <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 sm:col-span-2 lg:col-span-8 lg:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Grafik</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    Arus uang
                  </h3>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  <button
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white sm:h-10 sm:flex-none"
                    onClick={exportCsvReport}
                    type="button"
                  >
                    <Download size={15} />
                    Export CSV
                  </button>
                  <button
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-200 px-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-100 sm:h-10 sm:flex-none"
                    onClick={exportPdfReport}
                    type="button"
                  >
                    <FileText size={15} />
                    Export PDF
                  </button>
                  <LineChartIcon className="hidden text-cyan-200 sm:block" size={20} />
                </div>
              </div>
              <div className="mt-5 h-[clamp(18rem,42vw,24rem)] overflow-hidden rounded-lg border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(12,21,31,0.86),rgba(8,13,20,0.72))] p-2 sm:p-4">
                {chartData.length > 0 ? (
                  <MoneyFlowChart data={chartData} />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center">
                    <div>
                      <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-400">
                        <BarChart3 size={24} />
                      </div>
                      <p className="mt-4 text-base font-medium text-zinc-200">
                        Belum ada data untuk periode ini
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-500">
                        Grafik arus uang akan muncul saat transaksi sudah dicatat.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 sm:col-span-2 lg:col-span-4 lg:p-6">
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
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#080b10] px-4 py-3.5"
                    key={item.label}
                  >
                    <p className="text-sm text-zinc-400">{item.label}</p>
                    <p className={`min-w-0 break-words text-right text-sm font-semibold ${item.tone}`}>
                      {formatCurrency(item.value)}
                    </p>
                  </div>
                ))}
              </div>
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 sm:col-span-2 lg:col-span-4 lg:p-6">
              <p className="text-sm text-zinc-400">Kategori pengeluaran</p>
              <h3 className="mt-1 text-lg font-semibold text-white">Top 3</h3>
              <div className="mt-5 space-y-3">
                {topExpenseCategories.length > 0 ? (
                  topExpenseCategories.map((item, index) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#080b10] px-4 py-3.5"
                      key={item.category}
                    >
                      <p className="min-w-0 truncate text-sm font-medium text-white">
                        {index + 1}. {item.category}
                      </p>
                      <p className="min-w-0 shrink text-right text-sm font-semibold text-rose-300">
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#080b10] px-6 text-center">
                    <div>
                      <div className="mx-auto flex size-11 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-400">
                        <ShoppingCart size={22} />
                      </div>
                      <p className="mt-3 text-sm font-medium text-zinc-300">
                        Belum ada pengeluaran
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        Data kategori akan muncul sesuai filter aktif.
                      </p>
                    </div>
                  </div>
                )}
              </div>
                </section>

                <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 sm:col-span-2 lg:col-span-8 lg:p-6">
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
                        className="min-w-0 rounded-lg border border-white/10 bg-[#080b10] px-4 py-4"
                        key={item.label}
                      >
                        <p className="text-sm text-zinc-400">{item.label}</p>
                        <p className={`mt-2 break-words text-[clamp(0.95rem,2vw,1rem)] font-semibold ${item.tone}`}>
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

                <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 sm:col-span-2 lg:col-span-4 lg:p-6">
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
                    className="rounded-lg border border-white/10 bg-[#080b10] px-2 py-5 text-center"
                    key={item.label}
                  >
                    <p className="text-[clamp(1.35rem,4vw,1.5rem)] font-semibold text-white">
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
              <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 sm:col-span-2 lg:col-span-12 lg:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Riwayat</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    5 transaksi terbaru
                  </h3>
                </div>
              </div>

              <div className="mt-5 min-h-52 rounded-lg border border-white/10 bg-[#080b10]">
                {latestTransactions.length > 0 ? (
                  <div className="divide-y divide-white/10">
                    {latestTransactions.map((transaction) => (
                      <article
                        className="flex flex-col gap-4 px-4 py-4 transition hover:bg-white/[0.03] sm:flex-row sm:items-start sm:justify-between sm:px-5"
                        key={transaction.id}
                      >
                        <div className="flex min-w-0 gap-3">
                          <div
                            className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg ${
                              transaction.type === "income"
                                ? "bg-emerald-400/10 text-emerald-200"
                                : "bg-rose-400/10 text-rose-200"
                            }`}
                          >
                            {transaction.type === "income" ? (
                              <ArrowUpRight size={18} />
                            ) : (
                              <ArrowDownLeft size={18} />
                            )}
                          </div>
                          <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 break-words font-medium text-white">
                              {transaction.note}
                            </p>
                            <span
                              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                                transaction.type === "income"
                                  ? "bg-emerald-400/10 text-emerald-200"
                                  : "bg-rose-400/10 text-rose-200"
                              }`}
                            >
                              {transaction.type === "income"
                                ? "Pemasukan"
                                : "Pengeluaran"}
                            </span>
                            <span className="rounded-md bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300">
                              {getSpaceLabel(transaction.space)}
                            </span>
                          </div>
                          <p className="mt-2 break-words text-sm text-zinc-500">
                            {formatDate(transaction.date)} -{" "}
                            {transaction.category}
                          </p>
                          <p className="mt-1 truncate text-sm text-zinc-600">
                            {transaction.rawText}
                          </p>
                          </div>
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 pl-[52px] sm:justify-end sm:pl-0">
                          <p
                            className={`min-w-0 break-words text-right text-[clamp(0.95rem,2.4vw,1.125rem)] font-semibold leading-tight ${
                              transaction.type === "income"
                                ? "text-emerald-300"
                                : "text-rose-300"
                            }`}
                          >
                            {transaction.type === "income" ? "+" : "-"}
                            {formatCurrency(transaction.amount)}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-52 items-center justify-center px-6 text-center">
                    <div>
                      <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-400">
                        <CreditCard size={24} />
                      </div>
                      <p className="mt-4 text-base font-medium text-zinc-200">
                        Belum ada transaksi
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-500">
                        Mulai catat pemasukan atau pengeluaran pertamamu.
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
