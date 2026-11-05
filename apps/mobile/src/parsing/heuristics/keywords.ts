/**
 * Keyword tables for the heuristic receipt parser. Extend these tables to
 * teach the parser new receipt vocabularies; never add fixture-specific rules.
 * Patterns are matched case-insensitively against a single OCR line.
 */

// Letter boundaries that also work for accented letters (\b is ASCII-only).
const B = "(?<![\\p{L}\\p{N}])";
const E = "(?![\\p{L}\\p{N}])";
const word = (alts: string) => new RegExp(`${B}(?:${alts})${E}`, "iu");

export type TotalTier = { re: RegExp; confidence: number };

/** Total keywords, highest priority first. */
export const TOTAL_TIERS: TotalTier[] = [
  { re: word("grand\\s*total"), confidence: 0.95 },
  {
    re: word(
      [
        "total\\s*:?\\s*(?:bayar|pembayaran|payment|transaksi|pesanan|belanja|biaya|nominal|tagihan|ttc|fare|due|a\\s+pagar|[àa]\\s+payer|complessivo)",
        "totale",
        "summe",
        "gesamtbetrag",
        "totaal",
        "t[ổo]ng\\s+c[ộo]ng",
        "t[ổo]ng\\s+ti[ềe]n",
        "amount\\s+due",
      ].join("|"),
    ),
    confidence: 0.9,
  },
  { re: new RegExp(`${B}total${E}|合計|合计`, "iu"), confidence: 0.85 },
  { re: word("jumlah"), confidence: 0.8 },
  { re: word("tagihan"), confidence: 0.7 },
  { re: word("amount|nominal|montant|importe|betrag|valor"), confidence: 0.65 },
];

/**
 * Words that label a line as not the grand total (sub-totals, discounts, change, fees, tax).
 * A match preceded by a qualifier (TOTAL_SKIP_QUALIFIER) is ignored: "TOTAL incl. VAT".
 */
export const TOTAL_SKIP = word(
  [
    "sub\\s*-?\\s*total",
    "subtotaal",
    "zwischensumme",
    "diskon",
    "discount",
    "voucher",
    "kembali(?:an)?",
    "change",
    "troco",
    "cambio",
    "rendu",
    "hemat",
    "dpp",
    "ppn",
    "tax",
    "vat",
    "iva",
    "tva",
    "mwst",
    "gst",
    "sst",
    "btw",
    "admin",
    "fee",
    "biaya\\s+admin",
    "ht",
    "net",
    "netto",
    "tunai\\s*:", // cash tendered
    "cash",
    "tend",
    "tip",
    "credits?",
  ].join("|"),
);
/** Qualifiers that turn a skip word into a description of the total ("incl. VAT", "with tip"). */
export const TOTAL_SKIP_QUALIFIER =
  /(?<![\p{L}])(?:incl\.?|including|includes|inclusive|inkl\.?|inklusive|with|w\/|termasuk|sudah\s+termasuk|plus|con|avec|com|mit|di\s+cui)\s*(?:\d+(?:[.,]\d+)?\s*%\s*)?$/iu;
export const TOTAL_SKIP_CJK = /小計|小计|お釣り|お預り|消費税/u;

/** Tax keywords. The amount after the last keyword on a line is the tax. */
export const TAX_KEYWORD = new RegExp(
  `${B}(?:ppn|tax|vat|iva|tva|mwst|gst|sst|btw|pajak)${E}|消費税`,
  "giu",
);
/** Registration-number lines that mention a tax word but carry no tax amount. */
export const TAX_REGISTRATION = word("reg|no|nr|id|idnr|npwp|nif|abn|siret|cnpj|p\\.\\s?iva|invoice");

/** Reference-number labels, in priority order. */
export const REF_LABELS: RegExp[] = [
  /reference\s*(?:no\.?|number)/iu,
  /ref\.?\s*no\.?/iu,
  /no\.?\s*referensi/iu,
  /id\s*transaksi/iu,
  /receipt\s*(?:number|no\.?)/iu,
  /trxid/iu,
  /nomor\s*seri/iu,
  /id\s*#/iu,
  /n[º°]/iu,
  /rechnung\s*nr\.?/iu,
  /invoice\s*no\.?/iu,
];
export const WAYBILL = /^[A-Z]{2}\d{10,}$/;

/** Labels that introduce the merchant name directly. */
export const MERCHANT_LABEL = /^(?:merchant(?:\s*name)?|nama\s*merchant|nama\s*toko|toko|store)\s*:?\s+(.{3,})$/iu;

/** Lines that are never the merchant: app/bank boilerplate, receipt titles, labels. */
export const MERCHANT_SKIP = word(
  [
    "transaksi\\s+(?:berhasil|sukses)",
    "transfer\\s+(?:berhasil|successful|rupiah)",
    "transaction\\s+successful",
    "payment\\s+successful",
    "pembayaran\\s+berhasil",
    "rincian",
    "detail",
    "receipt",
    "tax\\s+invoice",
    "struk",
    "kassabon",
    "cash\\s+withdrawal",
    "status",
  ].join("|"),
);

export type Brand = { re: RegExp; name: string };

/** Banks and e-wallets: the merchant of a transfer receipt. */
export const BANK_BRANDS: Brand[] = [
  { re: word("bca"), name: "BCA" },
  { re: word("mandiri"), name: "Bank Mandiri" },
  { re: word("bri|brimo"), name: "BRI" },
  { re: word("bni"), name: "BNI" },
  { re: word("ocbc"), name: "OCBC" },
  { re: word("cimb"), name: "CIMB Niaga" },
  { re: word("jenius"), name: "Jenius" },
  { re: word("flip"), name: "Flip" },
  { re: word("gopay"), name: "GoPay" },
  { re: word("ovo"), name: "OVO" },
  { re: word("dana"), name: "DANA" },
  { re: word("shopeepay"), name: "ShopeePay" },
];

/** Chains and platforms whose name is a better merchant than the first OCR line. */
export const RETAIL_BRANDS: Brand[] = [
  { re: /indomaret/iu, name: "Indomaret" },
  { re: /alfamart/iu, name: "Alfamart" },
  { re: /alfamidi/iu, name: "Alfamidi" },
  { re: word("shopee"), name: "Shopee" },
  { re: word("tokopedia"), name: "Tokopedia" },
  { re: word("lazada"), name: "Lazada" },
  { re: /j\s*&\s*t\s+express|global\s+jet\s+express/iu, name: "J&T Express" },
  { re: word("jne"), name: "JNE" },
  { re: word("sicepat"), name: "SiCepat" },
  { re: word("pln|token\\s+listrik"), name: "PLN" },
];

/** Category rules, first match wins. */
export const CATEGORY_RULES: { re: RegExp; id: string }[] = [
  {
    re: word(
      "transfer|ditransfer|bi\\s*-?\\s*fast|virtual\\s+account|top\\s?-?up|tarik\\s+tunai|cash\\s+withdrawal|setor\\s+tunai",
    ),
    id: "default:transfer",
  },
  { re: word("token\\s+listrik|pln|pdam|tagihan\\s+listrik|electricity|water\\s+bill"), id: "default:utilities" },
  { re: /indomaret|alfamart|alfamidi|supermarket|supermarch|supermercado|supermarkt|hypermart/iu, id: "default:groceries" },
  {
    re: word(
      "grab|gojek\\s+ride|goride|gocar|taxi|taksi|uber|fuel|gas\\s+station|unleaded|pertamina|spbu|bensin|rail|railway|train|kereta|parkir|parking|tol|chuyến(?:\\s+đi)?|ride",
    ),
    id: "default:transport",
  },
  { re: word("hotel|inn|suites|motel|hostel|folio|übernachtung|penginapan"), id: "default:lodging" },
  {
    re: word("apotek|pharmacy|farmacia|farmácia|drogaria|apotheke|klinik|clinic|massage|spa|dokter|hospital"),
    id: "default:health",
  },
  { re: word("museum|cinema|bioskop|theater|theatre|concert|tiket\\s+masuk"), id: "default:entertainment" },
  {
    re: word("shopee|tokopedia|lazada|eletr\\p{L}*|electronics?|elektronik"),
    id: "default:shopping",
  },
  {
    re: new RegExp(
      `${B}(?:restoran|restaurant|resto|rumah\\s+makan|warung|kedai|cafe|café|coffee|kopi|espresso|bar|pub|diner|brasserie|bistro|trattoria|ramen|food\\s+court|bakso|mie|ayam|nasi|sate|phở|bún|cơm|tapas|take\\s+away|dine\\s+in|table|mesa|meja|bàn|couverts|covers?)${E}|らーめん|ラーメン|食堂|レストラン|カフェ|おにぎり|弁当`,
      "iu",
    ),
    id: "default:food_drink",
  },
  { re: /market|marché|markt|mart(?![\p{L}])|grocer|minimarket/iu, id: "default:groceries" },
  { re: word("express|ekspedisi|courier|kurir|waybill|resi"), id: "default:other" },
];

/** Lines whose numbers are phone/account numbers, not money (unless a currency is printed). */
export const NON_MONEY_LINE = word("telp|tel|telepon|phone|hp|wa|whatsapp|rekening|no\\.?\\s*rek|account|acct|no\\.");

/** Script/language hints used only when no currency symbol or code was printed. */
export const LANGUAGE_CURRENCY: { re: RegExp; code: string }[] = [
  { re: /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]|\d\s?đ(?![\p{L}])/iu, code: "VND" },
  { re: /[฀-๿]/u, code: "THB" },
  { re: /[぀-ヿ]/u, code: "JPY" },
];
