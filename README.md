# QSD — QRIS Statis ke Dinamis

Ubah QRIS statis (yang dicetak di meja kasir) menjadi QRIS dengan **nominal sudah terisi**, sehingga pembeli tinggal scan lalu bayar.

- `qris.js` adalah engine murni JavaScript **tanpa dependensi**. Bisa dipakai di browser, Node, dan Next.js.
- `app/` berisi aplikasi satu halaman yang mobile-friendly (upload QRIS → isi nominal → generate QR). Tersedia sebagai **APK Android**, **PWA**, dan web.
- Semua proses berjalan di perangkat. Gambar dan teks QRIS tidak dikirim ke server mana pun.

## Pakai aplikasinya

### Android (APK)

1. Buka [Releases](https://github.com/Harrakyy/QSD/releases), lalu unduh `QSD-x.y.z.apk` terbaru di HP.
2. Buka file itu. Android akan meminta izin **"Instal aplikasi tidak dikenal"** untuk browser atau file manager, izinkan.
3. Versi berikutnya cukup dipasang di atas versi lama, tanpa uninstall.

Di dalam APK, tombol **Bagikan / Simpan QR** membuka lembar berbagi Android untuk menyimpan QR ke galeri atau mengirimnya lewat WhatsApp.

### Web / PWA

Aktifkan **Settings → Pages → Source: GitHub Actions**, lalu buka `https://harrakyy.github.io/QSD/`. Dari Chrome Android, pilih menu ⋮ → **Instal aplikasi** untuk memasangnya tanpa APK.

### Uji di komputer

```bash
cd app
npm install
npm run dev   # http://localhost:5177
```

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

## Membuat rilis APK

APK dibuat oleh GitHub Actions, jadi Java dan Android Studio tidak perlu dipasang di komputer.

1. **Sekali saja:** isi 4 secret di **Settings → Secrets and variables → Actions**: `ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`. Kunci tanda tangan **jangan pernah di-commit**. Kalau kuncinya hilang, versi baru tidak bisa dipasang di atas versi lama.
2. Naikkan versi lalu push tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. Workflow **Android APK** membuat APK yang ditandatangani dan menerbitkannya di Releases.

Setiap push ke `main` juga membuat APK debug (tab Actions → artifact) untuk memastikan build masih jalan.

## Struktur

| Path | Isi |
|---|---|
| `qris.js`, `qris.d.ts` | Engine (library, tanpa dependensi) |
| `app/web/` | Sumber UI (`index.html`, `ui.js`, manifest, service worker) |
| `app/build.mjs` | Bundle `web/` → `www/` dengan esbuild (offline, tanpa CDN) |
| `app/android/` | Proyek Android (Capacitor 8) |
| `.github/workflows/` | Build APK + rilis, dan deploy GitHub Pages |

## Tes

```bash
npm test
```
