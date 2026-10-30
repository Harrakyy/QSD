# QSD — QRIS Statis ke Dinamis

Ubah QRIS statis (yang dicetak di meja kasir) menjadi QRIS dengan **nominal sudah terisi**, sehingga pembeli tinggal scan lalu bayar.

- `qris.js` adalah engine murni JavaScript **tanpa dependensi**. Bisa dipakai di browser, Node, dan Next.js.
- `index.html` adalah UI satu halaman yang mobile-friendly: upload QRIS → isi nominal → generate QR → unduh PNG.
- Semua proses berjalan di browser. Gambar dan teks QRIS tidak dikirim ke server mana pun.

## Pakai UI-nya

Halaman memakai ES module, jadi harus dibuka lewat HTTP, bukan `file://`:

```bash
npx serve .
```

Atau aktifkan **GitHub Pages** (Settings → Pages → branch `main`), lalu buka `https://<user>.github.io/QSD/`.

## Pakai engine-nya di proyek lain

Install langsung dari GitHub:

```bash
npm i github:Harrakyy/QSD
```

```js
import { parseQris, toDynamicQris } from "qsd";

const info = parseQris(teksQrisStatis);
// { ok: true, merchantName, merchantCity, nmid } atau { ok: false, error }

const dinamis = toDynamicQris(teksQrisStatis, 191999);
// render `dinamis` jadi gambar QR, misalnya dengan library `qrcode`
```

Alternatif lain: salin `qris.js` dan `qris.d.ts` ke proyekmu.

| Fungsi | Isi |
|---|---|
| `parseQris(payload)` | Validasi QRIS statis (CRC, tag `01` = `11`, ada nama merchant). Mengembalikan nama merchant, kota, dan NMID |
| `toDynamicQris(payload, amount)` | Tag `01` → `12`, sisipkan tag `54` (nominal) sesuai urutan tag, hitung ulang CRC16-CCITT |
| `crc16(text)` | CRC16-CCITT (poly `0x1021`, init `0xFFFF`), 4 hex huruf besar |

## Cara kerja

QRIS adalah teks EMVCo berformat TLV (tag 2 digit, panjang 2 digit, nilai) yang diakhiri tag `63` berisi CRC.

1. Tag `01` diubah dari `11` (statis) menjadi `12` (dinamis).
2. Tag `54` berisi nominal disisipkan sesuai urutan tag.
3. CRC dihitung ulang.

## ⚠️ Batasan

- **Modifikasi tidak resmi.** Umumnya bisa dibaca e-wallet dan m-banking, tapi tidak dijamin. Uji scan (tanpa membayar) di aplikasi yang dipakai pelanggan.
- **Tidak ada notifikasi pembayaran.** Uang masuk ke merchant, tapi aplikasimu tidak tahu otomatis. Cek di aplikasi merchant (DANA Bisnis, GoBiz, dll.), atau pakai **nominal unik** (misalnya total − Rp1..999) supaya mudah dicocokkan.
- Butuh konfirmasi otomatis? Pakai payment gateway resmi (Midtrans, Xendit, Tripay), atau aplikasi pembaca notifikasi merchant.

## Tes

```bash
npm test
```
