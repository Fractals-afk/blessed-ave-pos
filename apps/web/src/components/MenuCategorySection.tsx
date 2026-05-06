"use client";

import { useState } from "react";
import Image from "next/image";
import type { MenuCategory, MenuItem } from "@blessed-ave/types";
import { ItemModal } from "./ItemModal";

interface Props {
  category: MenuCategory;
}

export function MenuCategorySection({ category }: Props) {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  return (
    <section id={`cat-${category.id}`}>
      <div className="flex items-center gap-3 mb-5">
        <h2 className="font-display text-2xl font-bold text-brown-800">{category.name}</h2>
        <div className="flex-1 h-px bg-cream-300" />
      </div>

      {category.description && (
        <p className="mb-4 text-sm text-brown-400">{category.description}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(category.items ?? []).map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedItem(item)}
            className="group flex items-start gap-4 rounded-2xl bg-white border border-cream-200 p-4 text-left shadow-sm transition hover:shadow-md hover:border-gold-400 active:scale-[0.99]"
          >
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={item.name}
                width={80}
                height={80}
                className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="h-20 w-20 flex-shrink-0 rounded-xl bg-cream-200 flex items-center justify-center text-3xl">
                ☕
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-brown-800 group-hover:text-brown-900">{item.name}</p>
              {item.description && (
                <p className="mt-1 text-sm text-brown-400 line-clamp-2 leading-relaxed">{item.description}</p>
              )}
              <div className="mt-2 flex items-center justify-between">
                <p className="font-bold text-brown-700">
                  ₱{(item.price / 100).toFixed(2)}
                </p>
                <span className="rounded-full bg-gold-500 px-3 py-0.5 text-xs font-semibold text-brown-800 opacity-0 group-hover:opacity-100 transition">
                  Add +
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedItem && (
        <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </section>
  );
}
