import { parseQris, toDynamicQris } from "../../qris.js";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const isNative = Capacitor.isNativePlatform();

const $ = (id) => document.getElementById(id);
const rupiah = (n) => "Rp " + n.toLocaleString("id-ID");
const STORE_KEY = "qsd:qris";
let qris = "";

const show = (el, text) => { el.textContent = text; el.classList.toggle("hidden", !text); };
const amountValue = () => Number($("amount").value.replace(/\D/g, ""));
const refresh = () => { $("gen").disabled = !(qris && amountValue() > 0); };

function setQris(text, { remember = true } = {}) {
  const parsed = parseQris(text);
  if (!parsed.ok) {
    show($("err1"), parsed.error);
    return;
  }
  qris = text.trim();
  show($("err1"), "");
  $("merchant").innerHTML = "";
  const name = document.createElement("b");
  name.textContent = parsed.merchantName;
  $("merchant").append(name, [parsed.merchantCity, parsed.nmid && "NMID " + parsed.nmid].filter(Boolean).join(" · "));
  $("merchant").classList.remove("hidden");
  $("result").classList.add("hidden");
  if (remember) { try { localStorage.setItem(STORE_KEY, qris); } catch {} }
  refresh();
}

// jsQR bisa gagal di satu skala tapi berhasil di skala lain (terbukti pada foto QRIS asli di 1200px),
// jadi coba beberapa ukuran sampai terbaca. Ukuran asli dibatasi 2000px supaya tetap cepat di HP.
const DECODE_SIZES = [2000, 1000, 800, 600, 1400];

async function decodeImage(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  for (const max of DECODE_SIZES) {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const text = jsQR(data, width, height)?.data;
    if (text) return text;
  }
  return null;
}

$("file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  try {
    const text = await decodeImage(file);
    text ? setQris(text) : show($("err1"), "QR tidak terbaca. Gunakan foto/screenshot yang jelas dan tidak terpotong.");
  } catch {
    show($("err1"), "Gagal membaca gambar.");
  }
});

$("paste").addEventListener("input", (e) => e.target.value.trim() && setQris(e.target.value));

$("amount").addEventListener("input", (e) => {
  const n = Number(e.target.value.replace(/\D/g, "").slice(0, 12));
  e.target.value = n ? n.toLocaleString("id-ID") : "";
  refresh();
});

$("gen").addEventListener("click", async () => {
  const amount = amountValue();
  try {
    const dynamic = toDynamicQris(qris, amount);
    const url = await QRCode.toDataURL(dynamic, { width: 600, margin: 2, errorCorrectionLevel: "M" });
    const merchant = parseQris(qris).merchantName;
    $("qrImg").src = url;
    $("qrImg").alt = `QRIS ${merchant} ${rupiah(amount)}`;
    $("qrMerchant").textContent = merchant;
    $("qrTotal").textContent = rupiah(amount);
    $("download").href = url;
    $("download").download = `QRIS-${amount}.png`;
    $("copy").dataset.text = dynamic;
    $("result").classList.remove("hidden");
    $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    show($("err1"), err.message);
  }
});

$("download").addEventListener("click", async (e) => {
  if (!isNative) return; // web: biarkan atribut download bekerja
  e.preventDefault();
  try {
    const { uri } = await Filesystem.writeFile({
      path: $("download").download,
      data: $("download").href.split(",")[1],
      directory: Directory.Cache,
    });
    await Share.share({ title: $("qrImg").alt, files: [uri] });
  } catch (err) {
    if (!/cancel/i.test(String(err?.message))) show($("err1"), "Gagal membagikan QR.");
  }
});

$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("copy").dataset.text);
    $("copy").textContent = "Tersalin ✓";
    setTimeout(() => ($("copy").textContent = "Salin teks QRIS"), 1500);
  } catch {
    $("copy").textContent = "Gagal menyalin";
  }
});

try {
  const saved = localStorage.getItem(STORE_KEY);
  if (saved) setQris(saved, { remember: false });
} catch {}

if (isNative) $("download").textContent = "Bagikan / Simpan QR";

// PWA: cache offline hanya untuk versi web; di APK aset sudah ada di dalam aplikasi
if (!isNative && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
