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
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Wallet,
} from "lucide-react";

const summaryCards = [
  {
    label: "Saldo",
    value: "Rp0",
    helper: "Belum ada transaksi",
    icon: Wallet,
    tone: "text-cyan-300",
  },
  {
    label: "Pemasukan",
    value: "Rp0",
    helper: "Bulan ini",
    icon: ArrowDownLeft,
    tone: "text-emerald-300",
  },
  {
    label: "Pengeluaran",
    value: "Rp0",
    helper: "Bulan ini",
    icon: ArrowUpRight,
    tone: "text-rose-300",
  },
];

const navItems = [
  { label: "Dashboard", icon: HomeIcon, active: true },
  { label: "Transaksi", icon: CreditCard },
  { label: "Analitik", icon: BarChart3 },
  { label: "Pengaturan", icon: Settings },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#07090d] text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:flex-row">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-[#0b0f16]/90 px-5 py-6 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/25">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">AI Money</p>
              <h1 className="text-lg font-semibold text-white">Journal</h1>
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
            <p className="text-sm font-medium text-white">Catatan pintar</p>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              Tulis transaksi harian dengan bahasa natural.
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
                    Dashboard
                  </p>
                  <h2 className="text-xl font-semibold text-white sm:text-2xl">
                    Ringkasan Keuangan
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
                    Catat dengan bahasa natural
                  </h3>
                </div>
                <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-200">
                  <Sparkles size={18} />
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-white/10 bg-[#080b10] p-3">
                <textarea
                  className="min-h-32 w-full resize-none bg-transparent text-base leading-7 text-zinc-100 outline-none placeholder:text-zinc-600"
                  placeholder="Contoh: Beli kopi 25 ribu pagi ini pakai QRIS"
                />
                <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-zinc-500">AI parsing menyusul.</p>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
                    type="button"
                  >
                    <Send size={16} />
                    Simpan draft
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:col-span-2 lg:col-span-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Grafik</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    Arus kas
                  </h3>
                </div>
                <LineChart className="text-zinc-500" size={20} />
              </div>
              <div className="mt-5 flex h-64 items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#080b10]">
                <div className="text-center">
                  <BarChart3 className="mx-auto text-zinc-600" size={34} />
                  <p className="mt-3 text-sm text-zinc-500">
                    Grafik akan muncul setelah ada transaksi.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:col-span-2 lg:col-span-12">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Riwayat</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    Transaksi terbaru
                  </h3>
                </div>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
                  type="button"
                >
                  <Plus size={16} />
                  Tambah manual
                </button>
              </div>

              <div className="mt-5 flex min-h-52 items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#080b10] px-6 text-center">
                <div>
                  <CreditCard className="mx-auto text-zinc-600" size={34} />
                  <p className="mt-3 text-sm text-zinc-500">
                    Belum ada transaksi yang dicatat.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
