"use client";

// Receipt printing, two paths:
//  1. Bluetooth Low-Energy — raw ESC/POS over a generic serial-style GATT
//     characteristic. Covers the common chip families used by cheap 58/80mm
//     BLE thermal printers. Printers using classic Bluetooth (SPP) instead
//     of BLE cannot be reached this way at all — the browser has no API for
//     classic Bluetooth.
//  2. System print dialog fallback — works with whatever printer Windows
//     already knows about (USB, network, or a classic-Bluetooth printer
//     paired at the OS level). printReceipt() always tries BLE first and
//     falls back to this automatically, so it works regardless of which
//     kind of printer is actually plugged in.

const SERVICE_CANDIDATES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // common cheap BLE printer service
  "0000ff00-0000-1000-8000-00805f9b34fb", // generic 0xFF00 printer service
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC/Microchip transparent UART
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART
];

const DEVICE_ID_KEY = "printer_device_id";
const DEVICE_NAME_KEY = "printer_device_name";
const PAPER_WIDTH_KEY = "printer_paper_width";

export type PaperWidth = "58" | "80";

export function getPaperWidth(): PaperWidth {
  if (typeof window === "undefined") return "58";
  return (localStorage.getItem(PAPER_WIDTH_KEY) as PaperWidth) || "58";
}

export function setPaperWidth(width: PaperWidth) {
  localStorage.setItem(PAPER_WIDTH_KEY, width);
}

let cachedDevice: BluetoothDevice | null = null;
let cachedChar: BluetoothRemoteGATTCharacteristic | null = null;

export function hasBluetooth(): boolean {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

export function savedPrinterName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DEVICE_NAME_KEY);
}

export function isPrinterConnected(): boolean {
  return !!cachedChar && !!cachedDevice?.gatt?.connected;
}

async function findWritableCharacteristic(device: BluetoothDevice): Promise<BluetoothRemoteGATTCharacteristic> {
  if (!device.gatt) throw new Error("Device has no GATT server");
  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const chars = await service.getCharacteristics();
    const writable = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
    if (writable) return writable;
  }
  throw new Error("Connected, but no writable channel found on this printer");
}

function attachDevice(device: BluetoothDevice, char: BluetoothRemoteGATTCharacteristic) {
  cachedDevice = device;
  cachedChar = char;
  device.addEventListener("gattserverdisconnected", () => {
    if (cachedDevice === device) { cachedDevice = null; cachedChar = null; }
  });
}

// Must be called from a user gesture (button click) — the browser requires
// that for the pairing prompt.
export async function pairNewPrinter(): Promise<string> {
  if (!hasBluetooth()) throw new Error("This browser doesn't support Bluetooth printing (use Chrome or Edge)");
  const device = await navigator.bluetooth!.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICE_CANDIDATES,
  });
  const char = await findWritableCharacteristic(device);
  attachDevice(device, char);
  localStorage.setItem(DEVICE_ID_KEY, device.id);
  localStorage.setItem(DEVICE_NAME_KEY, device.name ?? "Thermal printer");
  return device.name ?? "Thermal printer";
}

// Silent reconnect to a previously-paired printer — no prompt, safe to call
// on page load. Only works where the browser supports persisted Bluetooth
// permissions (navigator.bluetooth.getDevices).
export async function reconnectSavedPrinter(): Promise<string | null> {
  if (!hasBluetooth() || typeof navigator.bluetooth!.getDevices !== "function") return null;
  const savedId = localStorage.getItem(DEVICE_ID_KEY);
  if (!savedId) return null;
  const devices = await navigator.bluetooth!.getDevices!();
  const device = devices.find((d) => d.id === savedId);
  if (!device) return null;
  try {
    const char = await findWritableCharacteristic(device);
    attachDevice(device, char);
    return device.name ?? localStorage.getItem(DEVICE_NAME_KEY);
  } catch {
    return null;
  }
}

export function forgetPrinter() {
  cachedDevice?.gatt?.disconnect();
  cachedDevice = null;
  cachedChar = null;
  localStorage.removeItem(DEVICE_ID_KEY);
  localStorage.removeItem(DEVICE_NAME_KEY);
}

async function ensureConnected(): Promise<BluetoothRemoteGATTCharacteristic> {
  if (isPrinterConnected() && cachedChar) return cachedChar;
  await reconnectSavedPrinter();
  if (!cachedChar) throw new Error("No printer connected — open Printer settings and connect one");
  return cachedChar;
}

const CHUNK_SIZE = 180; // conservative BLE write size; most stacks handle this without negotiation

async function writeBytes(char: BluetoothRemoteGATTCharacteristic, data: Uint8Array) {
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    if (char.properties.writeWithoutResponse) await char.writeValueWithoutResponse(chunk);
    else await char.writeValue(chunk);
  }
}

// ── Receipt building ─────────────────────────────────────────────────────
// Shared between the two print paths: raw ESC/POS bytes over Bluetooth, and
// a monospace HTML block for the OS print dialog fallback. Character width
// depends on paper size (58mm ≈ 32 cols, 80mm ≈ 48 cols at default font).

function charsForWidth(width: PaperWidth): number {
  return width === "80" ? 48 : 32;
}

export interface ReceiptLine {
  name: string;
  qty: number;
  unitPrice: number; // centavos
  lineTotal: number;  // centavos, after discount
  discountLabel?: string;
}

export interface ReceiptData {
  storeName: string;
  orderLabel: string;
  timestamp: Date;
  lines: ReceiptLine[];
  subtotal: number; // centavos, pre-discount
  discount: number; // centavos saved
  vat: number;       // centavos, informational (included in total, not added)
  vatEnabled: boolean;
  total: number;     // centavos
  paymentMethod: string;
  tendered?: number; // centavos
  change?: number;    // centavos
}

function peso(cents: number) { return `P${(cents / 100).toFixed(2)}`; }

function padLine(left: string, right: string, width: number) {
  const space = Math.max(1, width - left.length - right.length);
  return left + " ".repeat(space) + right;
}

function center(s: string, width: number) {
  const pad = Math.max(0, Math.floor((width - s.length) / 2));
  return " ".repeat(pad) + s;
}

function wrap(s: string, width: number): string[] {
  if (s.length <= width) return [s];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += width) out.push(s.slice(i, i + width));
  return out;
}

function receiptTextLines(data: ReceiptData, width: number): string[] {
  const lines: string[] = [];
  lines.push(center(data.storeName, width));
  lines.push(center("Customer Copy", width));
  lines.push("-".repeat(width));
  lines.push(data.orderLabel);
  lines.push(data.timestamp.toLocaleString("en-PH"));
  lines.push("-".repeat(width));

  for (const l of data.lines) {
    lines.push(...wrap(`${l.qty} x ${l.name}`, width));
    lines.push(padLine(`  @ ${peso(l.unitPrice)}`, peso(l.lineTotal), width));
    if (l.discountLabel) lines.push(`  (${l.discountLabel})`);
  }

  lines.push("-".repeat(width));
  lines.push(padLine("Subtotal", peso(data.subtotal), width));
  if (data.discount > 0) lines.push(padLine("Discount", `-${peso(data.discount)}`, width));
  if (data.vatEnabled) lines.push(padLine("VAT incl.", peso(data.vat), width));
  lines.push(padLine("TOTAL", peso(data.total), width));
  lines.push(padLine("Payment", data.paymentMethod, width));
  if (data.tendered != null) lines.push(padLine("Tendered", peso(data.tendered), width));
  if (data.change != null) lines.push(padLine("Change", peso(data.change), width));
  lines.push("-".repeat(width));
  lines.push(center("Thank you!", width));
  return lines;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

export function buildReceipt(data: ReceiptData, width: number): Uint8Array {
  const text = receiptTextLines(data, width).join("\n") + "\n\n\n\n";
  const body = new TextEncoder().encode(text);
  return concatBytes([
    new Uint8Array([0x1b, 0x40]),       // ESC @  — init
    new Uint8Array([0x1b, 0x61, 0x00]), // ESC a 0 — left align
    body,
    new Uint8Array([0x1d, 0x56, 0x42, 0x00]), // GS V B 0 — partial cut (best-effort; ignored if unsupported)
  ]);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildReceiptHtml(data: ReceiptData, width: number, mmWidth: PaperWidth): string {
  const text = receiptTextLines(data, width).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title>
<style>
  @page { size: ${mmWidth}mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body { padding: 2mm 3mm; }
  pre { margin: 0; font-family: "Courier New", monospace; font-size: 11px; line-height: 1.3; white-space: pre-wrap; word-break: break-word; }
</style></head><body><pre>${escapeHtml(text)}</pre></body></html>`;
}

// Fallback that works with ANY printer the OS knows about — USB, network, or
// a classic-Bluetooth printer paired in Windows — by handing the receipt to
// the browser's normal print dialog instead of talking ESC/POS directly.
// Not silent (the user picks the printer/hits print once), but it always
// works, unlike the BLE path which depends on printer hardware we can't see.
function printViaSystemDialog(data: ReceiptData, mmWidth: PaperWidth) {
  const width = charsForWidth(mmWidth);
  const html = buildReceiptHtml(data, width, mmWidth);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 2000);
  };
  doc.open();
  doc.write(html);
  doc.close();
}

// Prints via the connected/saved BLE printer if one's available, otherwise
// falls back to the system print dialog — always resolves, never leaves a
// sale un-receipted just because Bluetooth isn't set up.
export async function printReceipt(data: ReceiptData): Promise<void> {
  const paperWidth = getPaperWidth();
  try {
    const char = await ensureConnected();
    await writeBytes(char, buildReceipt(data, charsForWidth(paperWidth)));
  } catch {
    printViaSystemDialog(data, paperWidth);
  }
}
