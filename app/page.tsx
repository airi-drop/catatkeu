"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  CreditCard,
  HomeIcon,
  LineChart,
  Menu,
  Package,
  Plus,
  Search,
  Send,
  Settings,
  ShoppingCart,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";

export type Transaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  note: string;
  rawText: string;
};

const STORAGE_KEY = "catatkeu.transactions";
const STORAGE_EVENT = "catatkeu.transactions.updated";

type InputMode = "quick" | "business";
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
    category: "Penjualan",
    amount: 350000,
    note: "Penjualan paket nasi",
    rawText: "Penjualan paket nasi 350 ribu",
  },
  {
    id: "dummy-2",
    date: "2026-05-13",
    type: "expense",
    category: "Bahan/Modal",
    amount: 125000,
    note: "Beli bahan dagangan",
    rawText: "Beli bahan dagangan 125 ribu",
  },
  {
    id: "dummy-3",
    date: "2026-05-12",
    type: "expense",
    category: "Operasional",
    amount: 45000,
    note: "Ojek kirim pesanan",
    rawText: "Ojek kirim pesanan 45 ribu",
  },
];

const navItems = [
  { label: "Dashboard", icon: HomeIcon, active: true },
  { label: "Transaksi", icon: CreditCard },
  { label: "Analitik", icon: BarChart3 },
  { label: "Pengaturan", icon: Settings },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
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
    ["bahan", "modal", "kulakan", "stok", "barang dagangan", "supplier"].some(
      (keyword) => normalized.includes(keyword),
    )
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

function createTransaction(rawText: string): Transaction {
  const type = inferType(rawText);
  const amount = parseAmount(rawText);
  const trimmedText = rawText.trim();

  return {
    id: `${Date.now()}-${crypto.randomUUID()}`,
    date: new Date().toISOString().slice(0, 10),
    type,
    category: inferCategory(trimmedText, type),
    amount,
    note: trimmedText,
    rawText: trimmedText,
  };
}

function parsePositiveNumber(value: string) {
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function createBusinessTransaction(form: BusinessForm): Transaction {
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
      date: new Date().toISOString().slice(0, 10),
      type: "income",
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
    date: new Date().toISOString().slice(0, 10),
    type: "expense",
    category: "Bahan/Modal",
    amount: total,
    note: transactionNote,
    rawText,
  };
}

function isTransaction(value: unknown): value is Transaction {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const transaction = value as Record<string, unknown>;

  return (
    typeof transaction.id === "string" &&
    typeof transaction.date === "string" &&
    (transaction.type === "income" || transaction.type === "expense") &&
    typeof transaction.category === "string" &&
    typeof transaction.amount === "number" &&
    typeof transaction.note === "string" &&
    typeof transaction.rawText === "string"
  );
}

function parseTransactions(stored: string | null) {
  if (!stored) {
    return dummyTransactions;
  }

  if (stored === cachedStorageValue) {
    return cachedTransactions;
  }

  cachedStorageValue = stored;

  try {
    const parsed: unknown = JSON.parse(stored);
    cachedTransactions =
      Array.isArray(parsed) && parsed.every(isTransaction)
        ? parsed
        : dummyTransactions;
  } catch {
    cachedTransactions = dummyTransactions;
  }

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
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

export default function Home() {
  const transactions = useSyncExternalStore(
    subscribeTransactions,
    getTransactionsSnapshot,
    () => dummyTransactions,
  );
  const [rawText, setRawText] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("quick");
  const [businessForm, setBusinessForm] =
    useState<BusinessForm>(initialBusinessForm);

  const businessQuantity = parsePositiveNumber(businessForm.quantity);
  const businessUnitPrice = parsePositiveNumber(businessForm.unitPrice);
  const businessTotal = Math.round(businessQuantity * businessUnitPrice);
  const canSubmitBusiness =
    businessForm.itemName.trim().length > 0 && businessTotal > 0;

  const totals = useMemo(() => {
    return transactions.reduce(
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
  }, [transactions]);

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions]);

  const summaryCards = [
    {
      label: "Saldo",
      value: formatCurrency(totals.balance),
      helper: `${transactions.length} transaksi tersimpan`,
      icon: Wallet,
      tone: "text-cyan-300",
    },
    {
      label: "Pemasukan",
      value: formatCurrency(totals.income),
      helper: "Total saat ini",
      icon: ArrowDownLeft,
      tone: "text-emerald-300",
    },
    {
      label: "Pengeluaran",
      value: formatCurrency(totals.expense),
      helper: "Total saat ini",
      icon: ArrowUpRight,
      tone: "text-rose-300",
    },
  ];

  function addTransaction(inputText = rawText) {
    const trimmedText = inputText.trim();

    if (!trimmedText) {
      return;
    }

    const transaction = createTransaction(trimmedText);

    if (transaction.amount <= 0) {
      return;
    }

    writeTransactions([transaction, ...transactions]);
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
    if (!canSubmitBusiness) {
      return;
    }

    const transaction = createBusinessTransaction(businessForm);
    writeTransactions([transaction, ...transactions]);
    setBusinessForm((current) => ({
      ...initialBusinessForm,
      kind: current.kind,
      paymentMethod: current.paymentMethod,
    }));
  }

  function deleteTransaction(id: string) {
    writeTransactions(
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
              <a
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  item.active
                    ? "bg-white text-zinc-950"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
                href="#"
                key={item.label}
              >
                <item.icon size={18} />
                {item.label}
              </a>
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
                  type="button"
                >
                  <Menu size={20} />
                </button>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
                    CatatKeu
                  </p>
                  <h2 className="text-xl font-semibold text-white sm:text-2xl">
                    Ringkasan Uang Harian
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
          </header>

          <div className="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-12 lg:gap-5 lg:px-8">
            <section className="grid gap-4 sm:col-span-2 sm:grid-cols-3 lg:col-span-12">
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

              <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-[#080b10] p-1">
                {[
                  { label: "Catat Cepat", mode: "quick" as const, icon: Send },
                  {
                    label: "Transaksi Usaha",
                    mode: "business" as const,
                    icon: ShoppingCart,
                  },
                ].map((mode) => (
                  <button
                    className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm font-medium transition ${
                      inputMode === mode.mode
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

              {inputMode === "quick" ? (
                <div className="mt-4 rounded-lg border border-white/10 bg-[#080b10] p-3">
                  <textarea
                    className="min-h-32 w-full resize-none bg-transparent text-base leading-7 text-zinc-100 outline-none placeholder:text-zinc-600"
                    onChange={(event) => setRawText(event.target.value)}
                    placeholder="Contoh: Penjualan nasi 350 ribu, beli bahan 125 ribu, atau bayar listrik 80 ribu"
                    value={rawText}
                  />
                  <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-zinc-500">
                      Natural language untuk transaksi umum.
                    </p>
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!rawText.trim() || parseAmount(rawText) <= 0}
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
                      disabled={!canSubmitBusiness}
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

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:col-span-2 lg:col-span-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Grafik</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    Arus uang
                  </h3>
                </div>
                <LineChart className="text-zinc-500" size={20} />
              </div>
              <div className="mt-5 flex h-64 items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#080b10]">
                <div className="text-center">
                  <BarChart3 className="mx-auto text-zinc-600" size={34} />
                  <p className="mt-3 text-sm text-zinc-500">
                    Grafik arus uang akan muncul setelah ada transaksi.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:col-span-2 lg:col-span-12">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Riwayat</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    Catatan terbaru
                  </h3>
                </div>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
                  onClick={() =>
                    addTransaction("Penjualan nasi 350 ribu hari ini")
                  }
                  type="button"
                >
                  <Plus size={16} />
                  Coba contoh
                </button>
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
                        Belum ada catatan. Tulis pemasukan, belanja pribadi,
                        atau transaksi usaha mikro pertama.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
