"use client";

// Bluetooth Low-Energy thermal receipt printing (ESC/POS over a generic
// serial-style GATT characteristic). Covers the common chip families used by
// cheap 58/80mm BLE thermal printers. Printers using classic Bluetooth (SPP)
// instead of BLE cannot be reached from a browser at all — those need to be
// paired at the OS level and used as a regular/USB printer instead.

const SERVICE_CANDIDATES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // common cheap BLE printer service
  "0000ff00-0000-1000-8000-00805f9b34fb", // generic 0xFF00 printer service
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC/Microchip transparent UART
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART
];

const DEVICE_ID_KEY = "printer_device_id";
const DEVICE_NAME_KEY = "printer_device_name";

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

// ── ESC/POS receipt building ────────────────────────────────────────────

const WIDTH = 32; // characters per line on a 58mm printer at default font

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

function padLine(left: string, right: string) {
  const space = Math.max(1, WIDTH - left.length - right.length);
  return left + " ".repeat(space) + right;
}

function center(s: string) {
  const pad = Math.max(0, Math.floor((WIDTH - s.length) / 2));
  return " ".repeat(pad) + s;
}

function wrap(s: string): string[] {
  if (s.length <= WIDTH) return [s];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += WIDTH) out.push(s.slice(i, i + WIDTH));
  return out;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

export function buildReceipt(data: ReceiptData): Uint8Array {
  const lines: string[] = [];
  lines.push(center(data.storeName));
  lines.push(center("Customer Copy"));
  lines.push("-".repeat(WIDTH));
  lines.push(data.orderLabel);
  lines.push(data.timestamp.toLocaleString("en-PH"));
  lines.push("-".repeat(WIDTH));

  for (const l of data.lines) {
    lines.push(...wrap(`${l.qty} x ${l.name}`));
    lines.push(padLine(`  @ ${peso(l.unitPrice)}`, peso(l.lineTotal)));
    if (l.discountLabel) lines.push(`  (${l.discountLabel})`);
  }

  lines.push("-".repeat(WIDTH));
  lines.push(padLine("Subtotal", peso(data.subtotal)));
  if (data.discount > 0) lines.push(padLine("Discount", `-${peso(data.discount)}`));
  if (data.vatEnabled) lines.push(padLine("VAT incl.", peso(data.vat)));
  lines.push(padLine("TOTAL", peso(data.total)));
  lines.push(padLine("Payment", data.paymentMethod));
  if (data.tendered != null) lines.push(padLine("Tendered", peso(data.tendered)));
  if (data.change != null) lines.push(padLine("Change", peso(data.change)));
  lines.push("-".repeat(WIDTH));
  lines.push(center("Thank you!"));
  lines.push("");
  lines.push("");
  lines.push("");

  const body = new TextEncoder().encode(lines.join("\n") + "\n");
  return concatBytes([
    new Uint8Array([0x1b, 0x40]),       // ESC @  — init
    new Uint8Array([0x1b, 0x61, 0x00]), // ESC a 0 — left align
    body,
    new Uint8Array([0x1d, 0x56, 0x42, 0x00]), // GS V B 0 — partial cut (best-effort; ignored if unsupported)
  ]);
}

export async function printReceipt(data: ReceiptData): Promise<void> {
  const char = await ensureConnected();
  await writeBytes(char, buildReceipt(data));
}
