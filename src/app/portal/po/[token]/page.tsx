"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  Building2, 
  Truck, 
  Calendar, 
  DollarSign, 
  ShieldCheck, 
  Loader2, 
  AlertCircle,
  HelpCircle,
  Clock,
  Printer
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";

export default function VendorPoPortalPage() {
  const params = useParams();
  const rawToken = params?.token as string;

  const [poData, setPoData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Acknowledgment Modal State
  const [showAckModal, setShowAckModal] = useState(false);
  const [representativeName, setRepresentativeName] = useState("");
  const [ackNotes, setAckNotes] = useState("");
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    if (!rawToken) return;

    const fetchPo = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/portal/po/${rawToken}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to load Purchase Order");
        }
        setPoData(json.data);
      } catch (err: any) {
        setError(err.message || "Invalid or expired link");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPo();
  }, [rawToken]);

  const handleDownloadPdf = async () => {
    if (!rawToken) return;
    setIsDownloadingPdf(true);
    try {
      const res = await fetch(`/api/portal/po/${rawToken}/pdf`);
      if (!res.ok) throw new Error("Failed to download PO PDF");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `E3-${poData?.poNumber || "PurchaseOrder"}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Purchase Order PDF downloaded successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to download PDF");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleAcknowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!representativeName.trim()) {
      toast.error("Please enter your name as authorized representative.");
      return;
    }

    setIsSubmittingAck(true);
    try {
      const res = await fetch(`/api/portal/po/${rawToken}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acknowledgedBy: representativeName.trim(),
          acknowledgmentNotes: ackNotes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit acknowledgment");

      toast.success("Purchase Order acknowledged and accepted!");
      setPoData((prev: any) => ({
        ...prev,
        status: "acknowledged",
        acknowledgedAt: json.acknowledgedAt || new Date().toISOString(),
        acknowledgedBy: representativeName.trim(),
      }));
      setShowAckModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to acknowledge");
    } finally {
      setIsSubmittingAck(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <h1 className="text-white text-lg font-bold">Accessing Secure Procurement Portal...</h1>
        <p className="text-slate-400 text-xs mt-1">Verifying encrypted access token</p>
      </div>
    );
  }

  if (error || !poData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-white text-xl font-black">Link Expired or Invalid</h1>
        <p className="text-slate-400 text-sm max-w-md mt-2">
          {error || "This Purchase Order link is no longer active. Please contact the E3 Finance & Procurement department for an updated link."}
        </p>
        <div className="mt-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 max-w-sm">
          <p className="font-semibold text-slate-300">Need assistance?</p>
          <p className="mt-1">Contact: procurement@e3.qa • +974 4444 0000</p>
        </div>
      </div>
    );
  }

  const items = Array.isArray(poData.itemsSnapshot) ? poData.itemsSnapshot : [];
  const currency = poData.currency || "QAR";
  const isAcknowledged = poData.status === "acknowledged";

  return (
    <div className="dark min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Branding & Status Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="h-12 flex items-center px-1">
              <img
                src={poData.companyLogo || "/images/e3-white-logo.png"}
                alt="E3 Logo"
                className="h-8 sm:h-9 max-h-10 w-auto object-contain drop-shadow"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">
                  Official Purchase Order
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isAcknowledged 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                    : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                }`}>
                  {poData.status}
                </span>
              </div>
              <h1 className="text-xl font-black text-white tracking-tight mt-0.5">{poData.poNumber}</h1>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <a
              href={`/api/portal/po/${rawToken}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              download={`E3-${poData.poNumber || "PurchaseOrder"}.pdf`}
              onClick={() => {
                toast.info("Downloading Purchase Order PDF...");
              }}
              className="rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600 px-4 py-2.5 gap-2 flex items-center justify-center shadow-lg hover:shadow-indigo-500/10 transition-all flex-1 sm:flex-none cursor-pointer group"
              title="Download and view Official Purchase Order PDF"
            >
              <Download className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
              <span className="text-white font-bold tracking-tight">Download Official PDF</span>
            </a>

            {!isAcknowledged && (
              <Button
                size="sm"
                onClick={() => setShowAckModal(true)}
                className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-lg shadow-emerald-950 px-4 py-2.5 flex-1 sm:flex-none"
              >
                <CheckCircle2 className="w-4 h-4" />
                Acknowledge Receipt
              </Button>
            )}
          </div>
        </div>

        {/* Acknowledgment Alert Banner (if acknowledged) */}
        {isAcknowledged && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold text-sm text-emerald-300">Order Formally Acknowledged & Accepted</p>
                <p className="text-[11px] text-emerald-400/80 mt-0.5">
                  Confirmed by <span className="font-semibold text-white">{poData.acknowledgedBy}</span>
                  {poData.acknowledgedAt && ` on ${new Date(poData.acknowledgedAt).toLocaleDateString()} at ${new Date(poData.acknowledgedAt).toLocaleTimeString()}`}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider bg-emerald-500/20 px-2 py-1 rounded border border-emerald-500/30 font-bold">
              Authenticated
            </span>
          </div>
        )}

        {/* PO Key Metadata Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Issue Date</span>
            <span className="font-bold text-white text-sm">
              {poData.issuedAt ? new Date(poData.issuedAt).toLocaleDateString() : "Pending"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Expected Delivery</span>
            <span className="font-bold text-white text-sm">
              {poData.expectedDeliveryDate ? new Date(poData.expectedDeliveryDate).toLocaleDateString() : "Per Agreement"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Payment Structure</span>
            <span className="font-bold text-white text-sm truncate block">
              {(poData.paymentTerms || "Standard").replace(/_/g, " ")}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Reference PR</span>
            <span className="font-mono font-bold text-indigo-400 text-sm truncate block">
              {poData.request?.requestNumber || "Internal PR"}
            </span>
          </div>
        </div>

        {/* Vendor & Shipping Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Vendor Card */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Vendor / Supplier</h2>
            </div>
            <p className="font-bold text-white text-sm pt-1">{poData.vendor?.companyName}</p>
            <p className="text-xs text-slate-400">
              Attn: {poData.vendor?.contactPerson || "Procurement Department"} • {poData.vendor?.contactNumber || ""}
            </p>
            <p className="text-xs text-slate-400">Email: {poData.vendor?.email || "N/A"}</p>
            <p className="text-xs text-slate-400">Address: {poData.vendor?.address || "Doha, Qatar"}</p>
            {poData.vendor?.registrationNumber && (
              <p className="text-[11px] text-slate-500">CR / Tax ID: {poData.vendor.registrationNumber}</p>
            )}
          </div>

          {/* Delivery & Billing Card */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Truck className="w-4 h-4 text-indigo-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Shipping & Receiving</h2>
            </div>
            <p className="font-bold text-white text-sm pt-1">{poData.billingCompany || "E3 Management Solutions & Logistics W.L.L"}</p>
            <p className="text-xs text-slate-400">Delivery: {poData.deliveryAddress}</p>
            <p className="text-xs text-slate-400">Billing: {poData.billingAddress}</p>
            <p className="text-xs text-slate-400">Authorized: Finance Department</p>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white tracking-tight">Order Line Items ({items.length})</h2>
            <span className="text-xs font-mono font-bold text-slate-400">Currency: {currency}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-12">#</th>
                  <th className="py-3 px-4">Item & Specifications</th>
                  <th className="py-3 px-4 text-center w-20">Qty</th>
                  <th className="py-3 px-4 text-right w-32">Unit Price</th>
                  <th className="py-3 px-4 text-right w-36">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-white">{item.name}</p>
                      {item.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{item.description}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                      {item.quantity}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                      {Number(item.unitPrice || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                      {Number(item.totalPrice || item.quantity * item.unitPrice || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="p-6 bg-slate-950/40 border-t border-slate-800 flex flex-col sm:flex-row items-end justify-between gap-4">
            <div className="text-xs text-slate-400 max-w-md">
              <p className="font-semibold text-slate-300">Special Instructions:</p>
              <p className="mt-1 text-slate-400 leading-relaxed">{poData.specialInstructions || "No special instructions provided."}</p>
            </div>

            <div className="w-full sm:w-64 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono text-white">
                  {currency} {Number(poData.subtotalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Freight / Shipping:</span>
                <span className="font-mono text-white">
                  {currency} {Number(poData.freightAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-sm font-bold text-white">
                <span>Total Amount:</span>
                <span className="text-indigo-400 font-mono text-base">
                  {currency} {Number(poData.totalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Standard Terms & Sign-off Box */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
          <h3 className="font-bold text-white text-sm">Terms & Legal Conditions</h3>
          <p className="text-slate-400 leading-relaxed">{poData.termsAndConditions}</p>
          <div className="border-t border-slate-800 pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between text-slate-500 text-[11px] gap-2">
            <span>Electronically verified and signed by E3 Holdings Corporate Finance.</span>
            <span>Document ID: {poData.poNumber}</span>
          </div>
        </div>
      </div>

      {/* Acknowledgment Modal */}
      {showAckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Order Acknowledgment</h3>
                <p className="text-xs text-slate-400">{poData.poNumber}</p>
              </div>
            </div>

            <form onSubmit={handleAcknowledge} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Authorized Representative Name *</label>
                <input
                  type="text"
                  required
                  value={representativeName}
                  onChange={(e) => setRepresentativeName(e.target.value)}
                  placeholder="e.g. John Doe (Operations Manager)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Confirmation Notes / Estimated Dispatch (Optional)</label>
                <textarea
                  rows={2}
                  value={ackNotes}
                  onChange={(e) => setAckNotes(e.target.value)}
                  placeholder="e.g. Order received. Production underway, scheduled dispatch by..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAckModal(false)}
                  disabled={isSubmittingAck}
                  className="rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingAck}
                  className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                >
                  {isSubmittingAck ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Confirm & Submit
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
