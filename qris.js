// QSD — QRIS Statis → Dinamis. Tanpa dependensi; jalan di browser dan Node (ESM).
// QRIS = teks EMVCo berformat TLV (tag 2 digit, panjang 2 digit, nilai), ditutup tag 63 berisi CRC16-CCITT.

/** CRC16-CCITT (poly 0x1021, init 0xFFFF), 4 karakter hex huruf besar. */
export function crc16(text) {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function parseTlv(payload) {
  const out = [];
  for (let i = 0; i < payload.length; ) {
    const tag = payload.slice(i, i + 2);
    const lenText = payload.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lenText)) return null;
    const value = payload.slice(i + 4, i + 4 + Number(lenText));
    if (value.length !== Number(lenText)) return null;
    out.push({ tag, value });
    i += 4 + value.length;
  }
  return out;
}

const encode = (tlvs) => tlvs.map((t) => t.tag + String(t.value.length).padStart(2, "0") + t.value).join("");

/**
 * Validasi QRIS statis (CRC benar, tag 01 = "11", ada nama merchant).
 * @param {string} payload teks hasil scan QRIS
 * @returns {{ok: true, merchantName: string, merchantCity: string, nmid: string | null} | {ok: false, error: string}}
 */
export function parseQris(payload) {
  const text = String(payload ?? "").trim();
  const tlvs = parseTlv(text);
  if (!tlvs || tlvs[0]?.tag !== "00" || tlvs.at(-1)?.tag !== "63") {
    return { ok: false, error: "Teks ini bukan QRIS yang valid." };
  }
  if (crc16(text.slice(0, -4)) !== tlvs.at(-1).value) {
    return { ok: false, error: "Checksum QRIS tidak cocok. Pastikan gambar QR jelas dan tidak terpotong." };
  }
  const get = (tag) => tlvs.find((t) => t.tag === tag)?.value;
  if (get("01") !== "11") {
    return { ok: false, error: "QRIS harus versi statis (yang dicetak), bukan QRIS dinamis/sekali pakai." };
  }
  const merchantName = get("59");
  if (!merchantName) return { ok: false, error: "QRIS tidak memuat nama merchant." };
  // NMID ada di sub-tag 02 dari tag 51 (Merchant Account Information QRIS nasional)
  const t51 = get("51");
  const nmid = (t51 && parseTlv(t51)?.find((t) => t.tag === "02")?.value) || null;
  return { ok: true, merchantName, merchantCity: get("60") ?? "", nmid };
}

/**
 * Ubah QRIS statis menjadi dinamis dengan nominal terisi: tag 01 → "12", sisipkan tag 54, hitung ulang CRC.
 * @param {string} staticPayload teks QRIS statis
 * @param {number} amount nominal rupiah, bilangan bulat positif
 * @returns {string} teks QRIS dinamis, siap dijadikan gambar QR
 */
export function toDynamicQris(staticPayload, amount) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Nominal harus bilangan bulat positif.");
  const parsed = parseQris(staticPayload);
  if (!parsed.ok) throw new Error(parsed.error);
  const tlvs = parseTlv(String(staticPayload).trim())
    .filter((t) => t.tag !== "63" && t.tag !== "54")
    .map((t) => (t.tag === "01" ? { tag: "01", value: "12" } : t));
  tlvs.push({ tag: "54", value: String(amount) });
  tlvs.sort((a, b) => Number(a.tag) - Number(b.tag)); // urutan tag EMVCo harus naik
  const body = encode(tlvs) + "6304";
  return body + crc16(body);
}
