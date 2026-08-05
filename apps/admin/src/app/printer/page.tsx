"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useRequireRole } from "@/lib/useRequireRole";
import toast from "react-hot-toast";
import {
  hasBluetooth, savedPrinterName, isPrinterConnected,
  pairNewPrinter, reconnectSavedPrinter, forgetPrinter, printReceipt,
} from "@/lib/printer";

export default function PrinterSettingsPage() {
  const authorized = useRequireRole(["OWNER", "MANAGER", "STAFF"], "/pos/login");
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectedName, setConnectedName] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);

  useEffect(() => {
    setSavedName(savedPrinterName());
    if (!savedPrinterName()) return;
    (async () => {
      setConnecting(true);
      const name = await reconnectSavedPrinter();
      setConnectedName(name);
      setConnecting(false);
    })();
  }, []);

  async function handlePair() {
    setConnecting(true);
    try {
      const name = await pairNewPrinter();
      setConnectedName(name);
      setSavedName(name);
      toast.success(`Connected to ${name}`);
    } catch (err: any) {
      toast.error(err.message ?? "Couldn't connect to printer");
    } finally {
      setConnecting(false);
    }
  }

  function handleForget() {
    forgetPrinter();
    setConnectedName(null);
    setSavedName(null);
    toast.success("Printer forgotten");
  }

  async function handleTestPrint() {
    setTesting(true);
    try {
      await printReceipt({
        storeName: "Blessed Ave",
        orderLabel: "Test Print",
        timestamp: new Date(),
        lines: [{ name: "Sample Item", qty: 1, unitPrice: 10000, lineTotal: 10000 }],
        subtotal: 10000, discount: 0, vat: 1071, vatEnabled: true, total: 10000,
        paymentMethod: "TEST",
      });
      toast.success("Sent to printer");
    } catch (err: any) {
      toast.error(err.message ?? "Print failed");
    } finally {
      setTesting(false);
    }
  }

  if (!authorized) return null;

  const connected = isPrinterConnected();
  const supported = hasBluetooth();

  return (
    <AdminLayout>
      <div className="mx-auto max-w-xl px-6 py-8">
        <h1 className="text-lg font-bold text-slate-900">Receipt Printer</h1>
        <p className="mt-1 text-sm text-slate-500">
          Connect a Bluetooth (BLE) thermal printer. Customer-copy receipts print automatically once payment is confirmed on an order.
        </p>

        {!supported && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This browser doesn't support Web Bluetooth. Use Chrome or Edge on this device.
          </div>
        )}

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {connected ? connectedName ?? savedName ?? "Printer" : savedName ? savedName : "No printer connected"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {connecting ? "Connecting…" : connected ? "Connected" : savedName ? "Not connected — paired before, may be off or out of range" : "Not paired yet"}
              </p>
            </div>
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-green-500" : "bg-slate-300"}`} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={handlePair} disabled={!supported || connecting}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50">
              {savedName ? "Connect a different printer" : "Find & Connect Printer"}
            </button>
            {savedName && (
              <button onClick={handleForget}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
                Forget
              </button>
            )}
            <button onClick={handleTestPrint} disabled={!connected || testing}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
              {testing ? "Printing…" : "Test Print"}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 leading-relaxed">
          Only BLE (Bluetooth Low Energy) printers can connect here — most Chinese-made 58mm/80mm thermal
          printers advertise this way. If yours is classic Bluetooth (SPP) instead, pair it in Windows'
          Bluetooth settings first and it'll behave like a regular local printer instead of showing up here.
        </div>
      </div>
    </AdminLayout>
  );
}
