type TransactionSpace = "personal" | "business";
type PaymentMethod = "cash" | "qris" | "transfer";
type TransactionType = "income" | "expense";

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  }[];
};

type AiTransaction = {
  type?: unknown;
  category?: unknown;
  amount?: unknown;
  note?: unknown;
  rawText?: unknown;
  paymentMethod?: unknown;
};

const paymentMethods = new Set<PaymentMethod>(["cash", "qris", "transfer"]);
const transactionTypes = new Set<TransactionType>(["income", "expense"]);

function normalizeDateKey(value: unknown) {
  if (typeof value !== "string") {
    return new Date().toISOString().slice(0, 10);
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return value;
}

function normalizeSpace(value: unknown): TransactionSpace {
  return value === "personal" ? "personal" : "business";
}

function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.toLowerCase();

  return paymentMethods.has(normalized as PaymentMethod)
    ? (normalized as PaymentMethod)
    : null;
}

function normalizeTransaction(
  transaction: AiTransaction,
  space: TransactionSpace,
  date: string,
) {
  const amount =
    typeof transaction.amount === "number"
      ? Math.round(transaction.amount)
      : Number.NaN;
  const type =
    typeof transaction.type === "string" &&
    transactionTypes.has(transaction.type as TransactionType)
      ? (transaction.type as TransactionType)
      : "expense";
  const note =
    typeof transaction.note === "string" ? transaction.note.trim() : "";
  const rawText =
    typeof transaction.rawText === "string"
      ? transaction.rawText.trim()
      : note;
  const category =
    typeof transaction.category === "string" && transaction.category.trim()
      ? transaction.category.trim()
      : type === "income"
        ? "Penjualan"
        : "Lainnya";

  if (!Number.isFinite(amount) || amount <= 0 || !rawText) {
    return null;
  }

  return {
    id: `${Date.now()}-${crypto.randomUUID()}`,
    date,
    created_at: new Date().toISOString(),
    type,
    space,
    category,
    amount,
    note: note || rawText,
    rawText,
    paymentMethod: normalizePaymentMethod(transaction.paymentMethod),
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY belum dikonfigurasi." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    text?: unknown;
    space?: unknown;
    date?: unknown;
  } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const space = normalizeSpace(body?.space);
  const date = normalizeDateKey(body?.date);

  if (!text) {
    return Response.json({ error: "Teks transaksi wajib diisi." }, { status: 400 });
  }

  const prompt = [
    "Parse catatan transaksi bahasa Indonesia menjadi array JSON transaksi.",
    "Setiap item wajib berisi type, category, amount, note, rawText, paymentMethod.",
    'type hanya "income" atau "expense".',
    'paymentMethod hanya "cash", "qris", "transfer", atau null jika tidak disebut.',
    "amount harus angka rupiah integer. Hitung qty x harga satuan, contoh 3 x 12000 = 36000.",
    "Pisahkan multi transaksi dari koma, baris baru, dan kata seperti dan/lalu/terus.",
    "Jangan gabungkan transaksi berbeda.",
    `Semua transaksi harus memakai space ${
      space === "personal" ? "personal" : "business"
    }.`,
    `Tanggal transaksi: ${date}.`,
    `Catatan: ${text}`,
  ].join("\n");

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                type: { type: "STRING" },
                category: { type: "STRING" },
                amount: { type: "NUMBER" },
                note: { type: "STRING" },
                rawText: { type: "STRING" },
                paymentMethod: { type: "STRING", nullable: true },
              },
              required: ["type", "category", "amount", "note", "rawText"],
              propertyOrdering: [
                "type",
                "category",
                "amount",
                "note",
                "rawText",
                "paymentMethod",
              ],
            },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    return Response.json(
      { error: "Gemini gagal memproses transaksi." },
      { status: 502 },
    );
  }

  const data = (await response.json()) as GeminiResponse;
  const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = jsonText ? (JSON.parse(jsonText) as unknown) : null;

  if (!Array.isArray(parsed)) {
    return Response.json({ error: "Format respons AI tidak valid." }, { status: 502 });
  }

  const transactions = parsed
    .map((transaction) =>
      normalizeTransaction(transaction as AiTransaction, space, date),
    )
    .filter((transaction): transaction is NonNullable<typeof transaction> =>
      Boolean(transaction),
    );

  return Response.json(transactions);
}
