"use client";

import { useState } from "react";
import { 
  FileText, 
  Building2, 
  Truck, 
  Calendar, 
  DollarSign, 
  ShieldCheck, 
  X, 
  Loader2, 
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";

interface GeneratePoModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: any;
  onSuccess: (newPo: any, rawToken: string) => void;
}

export function GeneratePoModal({ isOpen, onClose, request, onSuccess }: GeneratePoModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const defaultCompany = request?.subPurpose?.name || request?.project?.name || "E3 Management Solutions & Logistics W.L.L";
  const [billingCompany, setBillingCompany] = useState(defaultCompany);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [deliveryAddress, setDeliveryAddress] = useState(
    "E3 Headquarters, Logistics & Receiving Department, Doha, Qatar"
  );
  const [billingAddress, setBillingAddress] = useState(
    "E3 Management Solutions & Logistics W.L.L, Finance Department, Doha, Qatar"
  );
  const [specialInstructions, setSpecialInstructions] = useState(
    "Please inspect all packages upon arrival. Official invoice and delivery challan referencing this PO number must accompany delivery."
  );
  const [termsAndConditions, setTermsAndConditions] = useState(
    "Standard E3 Procurement Terms Apply. Payment processed within agreed terms upon delivery inspection."
  );

  if (!isOpen) return null;

  const vendor = request.vendor || {};
  const rawItems = Array.isArray(request.items) ? request.items : [];
  const currency = request.currency || "QAR";
  const subtotal = Number(request.totalEstimatedCost || 0);
  const freight = Number(request.freightAmount || 0);
  const total = subtotal + freight;

  const handleCreate = async (status: "draft" | "issued") => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${request.id}/po`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedDeliveryDate,
          billingCompany,
          deliveryAddress,
          billingAddress,
          specialInstructions,
          termsAndConditions,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create Purchase Order");
      }

      toast.success(
        status === "issued" 
          ? `Purchase Order ${data.purchaseOrder.poNumber} issued successfully!` 
          : `Purchase Order draft saved.`
      );
      onSuccess(data.purchaseOrder, data.rawToken);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create Purchase Order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border/80 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-border/60 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 text-primary flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">Generate Purchase Order (PO)</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                For Approved Request: <span className="font-semibold text-primary font-mono">{request.requestNumber}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Vendor Summary Card */}
          <div className="p-4 rounded-2xl bg-secondary/50 border border-border/60 flex items-start gap-4">
            <div className="w-9 h-9 rounded-xl bg-background flex items-center justify-center border border-border shrink-0 text-muted-foreground">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-bold text-foreground text-sm truncate">{vendor.companyName || "Vendor Name"}</p>
                <span className="text-[11px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                  {currency}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Contact: {vendor.contactPerson || "N/A"} • {vendor.contactNumber || "N/A"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                Email: {vendor.email || "No email on record"}
              </p>
            </div>
          </div>

          {/* Line Items Snapshot Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Order Items Snapshot ({rawItems.length} items)
              </label>
              <span className="text-xs font-bold text-foreground">
                Total: {currency} {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="border border-border/60 rounded-xl overflow-hidden bg-background">
              <div className="max-h-36 overflow-y-auto divide-y divide-border/40 text-xs">
                {rawItems.map((item: any, idx: number) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-muted/30">
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="font-semibold text-foreground truncate">{item.name}</p>
                      {item.description && (
                        <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-foreground">
                        {currency} {Number(item.estimatedCost || 0).toLocaleString()} × {item.quantity || 1}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        = {currency} {(Number(item.estimatedCost || 0) * (item.quantity || 1)).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Delivery & Billing Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" /> Expected Delivery Date
              </label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-primary" /> Payment Terms
              </label>
              <input
                type="text"
                disabled
                value={(request.paymentStructure || "POST_PROJECT").replace(/_/g, " ")}
                className="w-full bg-secondary/50 border border-border/60 rounded-xl px-3 py-2 text-xs text-muted-foreground font-semibold"
              />
            </div>
          </div>

          {/* Billing Entity & Addresses */}
          <div className="space-y-3.5 p-4 rounded-2xl bg-secondary/30 border border-border/70">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" /> Billing Entity / Company Name
                <span className="text-[10px] font-normal text-muted-foreground ml-auto">(Project Dependent)</span>
              </label>
              <input
                type="text"
                value={billingCompany}
                onChange={(e) => setBillingCompany(e.target.value)}
                className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                placeholder="Company Name (e.g. E3 Management Solutions & Logistics W.L.L)"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-primary" /> Ship To / Delivery Location
                </label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Full shipping location..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" /> Official Billing Address
                </label>
                <input
                  type="text"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Full billing address..."
                />
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-2 text-xs text-primary">
              <ShieldCheck className="w-4 h-4 shrink-0 text-primary" />
              <span className="text-[11px] leading-tight">
                <strong>Authorized Officer:</strong> Will be certified and stamped as <strong>Finance Department</strong>.
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Special Instructions & Delivery Conditions
            </label>
            <textarea
              rows={2}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              className="w-full bg-background border border-border/80 rounded-xl p-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Instructions for receiving, packaging, or timing..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Standard Purchase Terms & Conditions
            </label>
            <textarea
              rows={2}
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              className="w-full bg-background border border-border/80 rounded-xl p-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Standard procurement terms..."
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl text-xs font-semibold"
          >
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleCreate("draft")}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold border-border"
            >
              Save as Draft
            </Button>
            <Button
              onClick={() => handleCreate("issued")}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold bg-primary text-primary-foreground gap-1.5 shadow-md hover:shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Issuing PO...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Generate & Issue PO
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
