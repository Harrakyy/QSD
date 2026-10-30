// Mengendalikan WebView aplikasi QSD di emulator lewat Chrome DevTools Protocol (aktif di build debug).
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { crc16 } from "../../qris.js";

const adb = (cmd) => execSync(`adb ${cmd}`, { encoding: "utf8" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const pass = (msg) => console.log(`::notice title=E2E lulus::${msg}`);
const fail = (msg) => { failed = true; console.log(`::error title=E2E gagal::${msg}`); };
const check = (ok, msg, detail = "") => (ok ? pass(msg) : fail(`${msg} ${detail}`));

// QRIS statis sintetis (merchant fiktif), sama seperti di qris.test.js
const tlv = (t, v) => t + String(v.length).padStart(2, "0") + v;
const body =
  tlv("00", "01") + tlv("01", "11") +
  tlv("26", tlv("00", "ID.CO.TEST") + tlv("01", "ID0000000000001")) +
  tlv("51", tlv("00", "ID.CO.QRIS.WWW") + tlv("02", "ID1234567890123") + tlv("03", "UMI")) +
  tlv("52", "5812") + tlv("53", "360") + tlv("58", "ID") +
  tlv("59", "TOKO CONTOH") + tlv("60", "JAKARTA") + tlv("61", "12345") + "6304";
const STATIC = body + crc16(body);

// 1. Sambungkan ke socket DevTools WebView milik aplikasi
let socket = "";
for (let i = 0; i < 20 && !socket; i++) {
  socket = adb("shell cat /proc/net/unix").split("\n").map((l) => l.trim().split(" ").pop())
    .find((n) => n?.startsWith("@webview_devtools_remote_"))?.slice(1) ?? "";
  if (!socket) await sleep(1500);
}
if (!socket) { fail("Socket DevTools WebView tidak ditemukan (aplikasi tidak terbuka?)"); process.exit(1); }
adb(`forward tcp:9222 localabstract:${socket}`);
const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = targets.find((t) => t.type === "page");
check(!!page, "Aplikasi terbuka dan WebView memuat halaman", JSON.stringify(targets));
if (!page) process.exit(1);
pass(`URL WebView: ${page.url}`);

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const evaluate = (expression) => new Promise((resolve) => {
  const msgId = ++id;
  const onMsg = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== msgId) return;
    ws.removeEventListener("message", onMsg);
    resolve(msg.result?.result?.value ?? msg.result?.exceptionDetails?.exception?.description);
  };
  ws.addEventListener("message", onMsg);
  ws.send(JSON.stringify({ id: msgId, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
});

// 2. Skenario: tempel QRIS → nominal → Generate
const r = await evaluate(`(async () => {
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 20 && !$("gen"); i++) await wait(500);
  const native = window.Capacitor?.isNativePlatform?.() ?? false;
  $("paste").value = ${JSON.stringify(STATIC)};
  $("paste").dispatchEvent(new Event("input", { bubbles: true }));
  $("amount").value = "15000";
  $("amount").dispatchEvent(new Event("input", { bubbles: true }));
  await wait(300);
  $("gen").click();
  await wait(2000);
  return { native, merchant: $("merchant").innerText, err: $("err1").textContent, total: $("qrTotal").textContent,
           payload: $("copy").dataset.text, png: $("qrImg").src.slice(0, 22), label: $("download").textContent };
})()`);

check(r?.native === true, "Berjalan sebagai aplikasi native (Capacitor)", JSON.stringify(r));
check(r?.merchant?.includes("TOKO CONTOH"), "QRIS terbaca: merchant TOKO CONTOH");
check(!r?.err, "Tidak ada pesan error", r?.err);
check(r?.total === "Rp 15.000", "Total tampil Rp 15.000", r?.total);
check(r?.png === "data:image/png;base64,", "Gambar QR dibuat");
const p = r?.payload ?? "";
check(p.startsWith("000201010212") && p.includes("540515000") && crc16(p.slice(0, -4)) === p.slice(-4),
  "Payload QRIS dinamis valid (tag 01=12, tag 54=15000, CRC benar)", p);
check(r?.label === "Bagikan / Simpan QR", "Tombol versi native: Bagikan / Simpan QR", r?.label);

// 3. Tekan Bagikan → file PNG tersimpan + lembar Bagikan Android terbuka
await evaluate(`document.getElementById("download").click(), true`);
await sleep(4000);
const cache = adb("shell run-as com.harrakyy.qsd ls cache");
check(cache.includes("QRIS-15000.png"), "File QRIS-15000.png tersimpan di cache aplikasi", cache);
const focus = adb("shell dumpsys window").split("\n").filter((l) => /mCurrentFocus|mFocusedApp/.test(l)).join(" | ");
check(/chooser|intentresolver|ResolverActivity|ChooserActivity/i.test(focus), "Lembar Bagikan native Android terbuka", focus);

writeFileSync("e2e-screen.png", execSync("adb exec-out screencap -p"));
ws.close();
process.exit(failed ? 1 : 0);
