export function crc16(text: string): string;
export type ParseQrisResult =
  | { ok: true; merchantName: string; merchantCity: string; nmid: string | null }
  | { ok: false; error: string };
export function parseQris(payload: string): ParseQrisResult;
export function toDynamicQris(staticPayload: string, amount: number): string;
