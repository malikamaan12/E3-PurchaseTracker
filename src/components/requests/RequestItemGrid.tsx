"use client";

import { 
  Plus, 
  Trash2, 
  DollarSign, 
  Package, 
  Hash,
  Calculator,
  Truck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export interface RequestItem {
  name: string;
  quantity: number;
  estimatedCost: number;
  description?: string;
}

interface RequestItemGridProps {
  items: RequestItem[];
  errors?: any;
  onChange: (items: RequestItem[]) => void;
  currency: string;
  freightAmount: number;
  onFreightChange: (amount: number) => void;
}

export default function RequestItemGrid({ items, errors, onChange, currency, freightAmount, onFreightChange }: RequestItemGridProps) {
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

  const itemsTotal = items.reduce((sum, item) => sum + (item.quantity * item.estimatedCost), 0);
  const grandTotal = itemsTotal + freightAmount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-brand-primary" />
            Purchase Items
          </h3>
          <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mt-1">Itemized Budget Breakdown</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={addItem}
          className="flex items-center gap-2 h-10 px-6"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Item
        </Button>
      </div>

      <div className="relative overflow-x-auto custom-scrollbar rounded-2xl border border-border bg-card shadow-sm transition-colors">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-secondary/50 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
              <th className="px-6 py-4">Item Details</th>
              <th className="px-6 py-4 w-32 text-center">Qty</th>
              <th className="px-6 py-4 w-40">Unit Price (QAR)</th>
              <th className="px-6 py-4 w-40 text-right">Subtotal</th>
              <th className="px-6 py-4 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item, index) => {
              const rowError = errors?.[index];
              return (
                <tr
                  key={`item-row-${index}`}
                  className={`group transition-colors ${rowError ? 'bg-rose-500/5' : 'hover:bg-white/[0.01]'}`}
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                        <Input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(index, "name", e.target.value)}
                          placeholder="Item name / specification..."
                          className={`w-full bg-transparent border-none p-0 text-sm font-semibold placeholder:text-muted-foreground/30 focus:ring-0 h-auto ${rowError?.name ? 'text-rose-500' : 'text-foreground'}`}
                        />
                        <Input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                          placeholder="Additional details..."
                          className="w-full bg-transparent border-none p-0 text-xs font-medium text-muted-foreground placeholder:text-muted-foreground/20 focus:ring-0 focus:text-foreground transition-colors h-auto"
                        />
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top pt-5">
                    <div className="flex items-center justify-center gap-2 bg-secondary/50 rounded-lg border border-border p-0.5">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 0)}
                        className="w-12 bg-transparent border-none p-0 text-center text-sm font-bold text-primary focus:ring-0 h-8"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top pt-5">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-bold text-xs">{currency}</span>
                      <Input
                        type="number"
                        min="0"
                        value={item.estimatedCost}
                        onChange={(e) => updateItem(index, "estimatedCost", parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-foreground focus:ring-0 h-auto"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right align-top pt-5">
                    <span className="text-sm font-bold text-foreground tracking-tight">
                      {(item.quantity * item.estimatedCost).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right align-top pt-5">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center border border-border">
                      <Hash className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium italic">No items added yet. Click "Add Item" to begin.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Items Subtotal & Freight */}
        <div className="bg-secondary/30 px-8 py-5 border-t border-border flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Line Items Subtotal</span>
          <span className="text-sm font-bold text-foreground transition-colors">{itemsTotal.toLocaleString()}</span>
        </div>
        <div className="bg-secondary/30 px-8 py-5 border-t border-border flex items-center justify-between relative group">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-brand-primary" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest group-focus-within:text-brand-primary transition-colors">Freight Amount</span>
          </div>
          <div className="flex items-center gap-3">
             <span className="text-muted-foreground font-bold text-xs">{currency}</span>
             <Input
               type="number"
               min="0"
               value={freightAmount}
               onChange={(e) => onFreightChange(parseFloat(e.target.value) || 0)}
               className="w-32 h-10 text-right font-extrabold"
             />
          </div>
        </div>

        {/* Footer / Grand Total */}
        <div className="bg-gradient-to-r from-primary/10 via-card to-transparent px-8 py-6 flex items-center justify-between border-t border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <Calculator className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Cumulative Budget</p>
              <p className="text-sm font-bold text-foreground transition-colors">Grand Total Estimate</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] block mb-1">Total ({currency})</span>
            <span className="text-3xl font-serif font-bold text-foreground tracking-tighter transition-colors">
              {grandTotal.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
