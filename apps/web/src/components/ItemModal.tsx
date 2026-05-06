"use client";

import { useState } from "react";
import type { MenuItem, ModifierOption } from "@blessed-ave/types";
import { useCart } from "@/store/cart";
import toast from "react-hot-toast";

interface Props {
  item: MenuItem;
  onClose: () => void;
}

export function ItemModal({ item, onClose }: Props) {
  const addItem = useCart((s) => s.addItem);
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, ModifierOption[]>>({});
  const [notes, setNotes] = useState("");

  const totalPrice =
    (item.price +
      Object.values(selected).flat().reduce((s, o) => s + o.priceAdjustment, 0)) *
    quantity;

  function toggleOption(groupId: string, option: ModifierOption, multiSelect: boolean) {
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      if (multiSelect) {
        const exists = current.find((o) => o.id === option.id);
        return { ...prev, [groupId]: exists ? current.filter((o) => o.id !== option.id) : [...current, option] };
      }
      return { ...prev, [groupId]: [option] };
    });
  }

  function handleAdd() {
    for (const group of item.modifierGroups ?? []) {
      if (group.required && !(selected[group.id]?.length)) {
        toast.error(`Please choose a ${group.name}`, { icon: "☕" });
        return;
      }
    }
    const allOptions = Object.values(selected).flat();
    const unitPrice = item.price + allOptions.reduce((s, o) => s + o.priceAdjustment, 0);
    const id = `${item.id}:${allOptions.map((o) => o.id).sort().join(",")}`;
    addItem({ id, menuItem: item, quantity, selectedOptions: allOptions, unitPrice, notes });
    toast.success(`${item.name} added!`, {
      icon: "☕",
      style: { background: "#3D1C08", color: "#F5E8C8" },
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-brown-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header bar */}
        <div className="sticky top-0 bg-white rounded-t-3xl sm:rounded-t-3xl border-b border-cream-200 px-6 py-4 flex items-start justify-between">
          <div className="pr-8">
            <h2 className="font-display text-2xl font-bold text-brown-800">{item.name}</h2>
            {item.description && (
              <p className="text-sm text-brown-400 mt-1 leading-relaxed">{item.description}</p>
            )}
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cream-200 text-brown-500 hover:bg-cream-300 transition text-xl leading-none">
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-lg font-bold text-brown-700 mb-5">
            ₱{(item.price / 100).toFixed(2)}
          </p>

          {/* Modifier groups */}
          {(item.modifierGroups ?? []).map((group) => (
            <div key={group.id} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-semibold text-brown-800">{group.name}</h3>
                {group.required && (
                  <span className="rounded-full bg-gold-500 px-2 py-0.5 text-xs font-semibold text-brown-800">
                    Required
                  </span>
                )}
                {!group.required && (
                  <span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs text-brown-400">
                    Optional
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {group.options.map((option) => {
                  const isSelected = (selected[group.id] ?? []).some((o) => o.id === option.id);
                  return (
                    <button
                      key={option.id}
                      onClick={() => toggleOption(group.id, option, group.multiSelect)}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                        isSelected
                          ? "border-gold-500 bg-gold-500/10 text-brown-800 font-medium"
                          : "border-cream-200 text-brown-600 hover:border-brown-300 hover:bg-cream-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                          isSelected ? "border-gold-500 bg-gold-500" : "border-cream-300"
                        }`}>
                          {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-brown-800" />}
                        </div>
                        {option.name}
                      </div>
                      {option.priceAdjustment !== 0 && (
                        <span className="font-medium text-brown-500">
                          {option.priceAdjustment > 0 ? "+" : ""}₱{(option.priceAdjustment / 100).toFixed(2)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Notes */}
          <div className="mb-6">
            <label className="text-sm font-medium text-brown-700 mb-2 block">
              Special instructions
              <span className="text-brown-400 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. less sugar, extra hot, no ice..."
              rows={2}
              className="w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-sm text-brown-700 placeholder-brown-300 focus:outline-none focus:ring-2 focus:ring-gold-400 resize-none"
            />
          </div>

          {/* Quantity + Add to cart */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border-2 border-cream-200 px-3 py-2.5">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-6 w-6 flex items-center justify-center rounded-full bg-cream-200 text-brown-700 font-bold hover:bg-cream-300 transition text-lg leading-none">
                −
              </button>
              <span className="w-6 text-center font-bold text-brown-800">{quantity}</span>
              <button onClick={() => setQuantity((q) => q + 1)}
                className="h-6 w-6 flex items-center justify-center rounded-full bg-brown-800 text-cream-100 font-bold hover:bg-brown-700 transition text-lg leading-none">
                +
              </button>
            </div>
            <button
              onClick={handleAdd}
              className="flex-1 rounded-xl bg-brown-800 py-3.5 font-semibold text-cream-100 shadow transition hover:bg-brown-700 active:scale-95"
            >
              Add to Cart · ₱{(totalPrice / 100).toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
