"use client";

import { 
  Plus, 
  Trash2, 
  DollarSign, 
  Package, 
  Hash,
  Calculator
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface RequestItem {
  name: string;
  quantity: number;
  estimatedCost: number;
  description?: string;
}

interface RequestItemGridProps {
  items: RequestItem[];
  onChange: (items: RequestItem[]) => void;
}

export default function RequestItemGrid({ items, onChange }: RequestItemGridProps) {
  const addItem = () => {
    onChange([...items, { name: "", quantity: 1, estimatedCost: 0, description: "" }]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof RequestItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const total = items.reduce((sum, item) => sum + (item.quantity * item.estimatedCost), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-brand-primary" />
            Purchase Items
          </h3>
          <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mt-1">Itemized Budget Breakdown</p>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-xl text-[10px] font-bold hover:bg-brand-primary/20 transition-all uppercase tracking-widest"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Item
        </button>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">
              <th className="px-6 py-4">Item Details</th>
              <th className="px-6 py-4 w-32 text-center">Qty</th>
              <th className="px-6 py-4 w-40">Unit Price (QAR)</th>
              <th className="px-6 py-4 w-40 text-right">Subtotal</th>
              <th className="px-6 py-4 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <AnimatePresence mode="popLayout">
              {items.map((item, index) => (
                <motion.tr
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="group hover:bg-white/[0.01] transition-colors"
                >
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(index, "name", e.target.value)}
                      placeholder="Item name / specification..."
                      className="w-full bg-transparent border-none p-0 text-sm font-semibold text-white placeholder:text-zinc-700 focus:ring-0"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2 bg-white/5 rounded-lg border border-white/5 p-1">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 0)}
                        className="w-12 bg-transparent border-none p-0 text-center text-sm font-bold text-brand-primary focus:ring-0"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 font-bold text-xs">QAR</span>
                      <input
                        type="number"
                        value={item.estimatedCost}
                        onChange={(e) => updateItem(index, "estimatedCost", parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-white focus:ring-0"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-bold text-white tracking-tight">
                      {(item.quantity * item.estimatedCost).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2 rounded-lg text-zinc-700 hover:text-rose-500 hover:bg-rose-500/5 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center">
                      <Hash className="w-6 h-6 text-zinc-700" />
                    </div>
                    <p className="text-xs text-zinc-600 font-medium">No items added yet. Click "Add Item" to begin.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Footer / Total */}
        <div className="bg-white/5 px-8 py-6 flex items-center justify-between border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
              <Calculator className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Cumulative Budget</p>
              <p className="text-sm font-bold text-white">Grand Total Estimate</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em] block mb-1">Total (QAR)</span>
            <span className="text-3xl font-serif font-bold text-white tracking-tighter">
              {total.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
