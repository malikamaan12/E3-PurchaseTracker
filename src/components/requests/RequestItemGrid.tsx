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
import { Combobox } from "@/components/ui/Combobox";

import { useState, useEffect } from "react";

// Initial fallback catalog items
const FALLBACK_CATALOG = [
  { value: "MacBook Pro 14-inch (M3)", label: "MacBook Pro 14-inch (M3)", defaultCost: 7500 },
  { value: "Dell XPS 15 Laptop", label: "Dell XPS 15 Laptop", defaultCost: 6500 },
  { value: "Lenovo ThinkPad X1 Carbon", label: "Lenovo ThinkPad X1 Carbon", defaultCost: 5500 },
];

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
  exchangeRate: number;
  freightAmount: number;
  onFreightChange: (amount: number) => void;
}

export default function RequestItemGrid({ items, errors, onChange, currency, exchangeRate, freightAmount, onFreightChange }: RequestItemGridProps) {
  const addItem = () => {
    onChange([...items, { name: "", quantity: 1, estimatedCost: 0, description: "" }]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const [catalogItems, setCatalogItems] = useState(FALLBACK_CATALOG);

  useEffect(() => {
    fetch('/api/items/catalog')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCatalogItems(data.map((d: any) => ({
            value: d.name,
            label: d.name,
            defaultCost: d.defaultCost || 0
          })));
        }
      })
      .catch(console.error);
  }, []);

  const updateItem = (index: number, field: keyof RequestItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === "name") {
      const found = catalogItems.find(c => c.value === value);
      if (found && (!newItems[index].estimatedCost || newItems[index].estimatedCost === 0)) {
        newItems[index].estimatedCost = found.defaultCost;
      }
    }
    
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
          <p className="text-xs text-muted-foreground mt-1">Itemized Budget Breakdown</p>
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

      <div className="relative overflow-x-auto custom-scrollbar rounded-xl border border-border bg-card shadow-sm transition-colors">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-secondary/50 text-xs font-medium text-muted-foreground uppercase leading-none">
              <th className="px-4 py-3">Item Details</th>
              <th className="px-4 py-3 w-32 text-center">Qty</th>
              <th className="px-4 py-3 w-40">Unit Price ({currency})</th>
              <th className="px-4 py-3 w-40 text-right">Subtotal (QAR)</th>
              <th className="px-4 py-3 w-12"></th>
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
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                        <Combobox
                          options={catalogItems}
                          value={item.name}
                          onChange={(val) => updateItem(index, "name", val)}
                          placeholder="Search item catalog..."
                          allowCustomValue={true}
                          className={`w-full bg-background border border-input shadow-sm rounded-md px-3 h-10 text-sm font-semibold placeholder:text-muted-foreground/50 focus:ring-ring focus:ring-2 ${rowError?.name ? 'border-rose-500' : ''}`}
                        />
                        <Input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                          placeholder="Additional details..."
                          className="w-full bg-background border border-input shadow-sm rounded-md px-3 h-9 text-xs font-medium text-muted-foreground placeholder:text-muted-foreground/40 focus:ring-ring focus:ring-2 focus:text-foreground transition-colors"
                        />
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top pt-4">
                    <div className="flex items-center justify-center bg-background border border-input shadow-sm rounded-md px-1 h-10 focus-within:ring-1 focus-within:ring-ring">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 0)}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          className="w-14 bg-transparent border-none p-0 text-center text-sm font-medium text-foreground focus-visible:ring-0 shadow-none h-full"
                        />
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top pt-4">
                    <div className="flex items-center gap-2 bg-background border border-input shadow-sm rounded-md px-3 h-10 focus-within:ring-1 focus-within:ring-ring transition-shadow">
                      <span className="text-muted-foreground font-bold text-xs shrink-0">{currency}</span>
                      <Input
                        type="number"
                        min="0"
                        value={item.estimatedCost || ''}
                        onChange={(e) => updateItem(index, "estimatedCost", parseFloat(e.target.value) || 0)}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        className="w-full bg-transparent border-none p-0 text-sm font-medium text-foreground focus-visible:ring-0 shadow-none h-full"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right align-top pt-5">
                    <span className="text-sm font-bold text-foreground tracking-tight">
                      {(item.quantity * item.estimatedCost * exchangeRate).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right align-top pt-4">
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
        <div className="bg-card px-6 py-4 border-t border-border flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Line Items Subtotal (QAR)</span>
          <span className="text-sm font-bold text-foreground transition-colors">{(itemsTotal * exchangeRate).toLocaleString()}</span>
        </div>
        <div className="bg-card px-6 py-4 border-t border-border flex items-center justify-between relative group">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-brand-primary" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest group-focus-within:text-brand-primary transition-colors">Freight Amount</span>
          </div>
          <div className="flex items-center gap-2 bg-background border border-input shadow-sm rounded-md px-3 h-10 focus-within:ring-1 focus-within:ring-ring transition-shadow">
             <span className="text-muted-foreground font-bold text-xs shrink-0">{currency}</span>
             <Input
               type="number"
               min="0"
               value={freightAmount || ''}
               onChange={(e) => onFreightChange(parseFloat(e.target.value) || 0)}
               onWheel={(e) => (e.target as HTMLInputElement).blur()}
               className="w-24 bg-transparent border-none p-0 text-right text-sm font-semibold text-foreground focus-visible:ring-0 shadow-none h-full"
             />
          </div>
        </div>

        {/* Footer / Grand Total */}
        <div className="bg-card px-6 py-5 flex items-center justify-between border-t border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/30">
              <Calculator className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cumulative Budget</p>
              <p className="text-sm font-bold text-foreground transition-colors">Grand Total Estimate</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-medium text-muted-foreground block mb-1">Total ({currency})</span>
            <span className="text-lg font-semibold text-foreground transition-colors">
              {grandTotal.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
