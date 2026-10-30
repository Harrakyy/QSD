import { test } from "node:test";
import assert from "node:assert/strict";
import { crc16, parseQris, toDynamicQris } from "./qris.js";

// QRIS statis sintetis (merchant fiktif) supaya repo tidak memuat QRIS milik siapa pun
const tlv = (tag, value) => tag + String(value.length).padStart(2, "0") + value;
const body =
  tlv("00", "01") + tlv("01", "11") +
  tlv("26", tlv("00", "ID.CO.TEST") + tlv("01", "ID0000000000001")) +
  tlv("51", tlv("00", "ID.CO.QRIS.WWW") + tlv("02", "ID1234567890123") + tlv("03", "UMI")) +
  tlv("52", "5812") + tlv("53", "360") + tlv("58", "ID") +
  tlv("59", "TOKO CONTOH") + tlv("60", "JAKARTA") + tlv("61", "12345") + "6304";
const STATIC = body + crc16(body);

test("crc16 sesuai nilai acuan CRC-16/CCITT-FALSE", () => {
  assert.equal(crc16("123456789"), "29B1");
});

test("parseQris membaca merchant dan NMID", () => {
  assert.deepEqual(parseQris(STATIC), {
    ok: true,
    merchantName: "TOKO CONTOH",
    merchantCity: "JAKARTA",
    nmid: "ID1234567890123",
  });
});

test("parseQris menolak CRC salah, QRIS dinamis, dan teks sembarang", () => {
  assert.equal(parseQris(STATIC.slice(0, -4) + "0000").ok, false);
  assert.equal(parseQris(toDynamicQris(STATIC, 1000)).ok, false);
  assert.equal(parseQris("https://example.com").ok, false);
  assert.equal(parseQris("").ok, false);
});

test("toDynamicQris: tag 01=12, tag 54 sebelum 58, CRC valid", () => {
  const out = toDynamicQris(STATIC, 191999);
  assert.ok(out.startsWith("000201010212"));
  assert.ok(out.includes("54061919995802ID"));
  assert.equal(crc16(out.slice(0, -4)), out.slice(-4));
});

test("toDynamicQris menolak nominal dan QRIS tidak valid", () => {
  assert.throws(() => toDynamicQris(STATIC, 0));
  assert.throws(() => toDynamicQris(STATIC, 1.5));
  assert.throws(() => toDynamicQris("bukan qris", 1000));
});
