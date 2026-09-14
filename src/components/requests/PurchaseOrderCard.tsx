"use client";

import { useState, useEffect } from "react";
import { 
  FileText, 
  Download, 
  Share2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  Loader2, 
  ExternalLink,
  ShieldCheck,
  Building2,
  Calendar,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { GeneratePoModal } from "./GeneratePoModal";
import { SharePoModal } from "./SharePoModal";

interface PurchaseOrderCardProps {
  request: any;
  user: any;
}

export function PurchaseOrderCard({ request, user }: PurchaseOrderCardProps) {
  const [poData, setPoData] = useState<any>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeRawToken, setActiveRawToken] = useState<string>("");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const isFinanceOrAdmin = 
    user?.role === "admin" || 
    user?.role === "super_admin" || 
    user?.department?.toLowerCase() === "finance";

  const fetchPo = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/requests/${request.id}/po`);
      const data = await res.json();
      if (res.ok) {
        setPoData(data.purchaseOrder);
        setCanCreate(data.canCreate);
      }
    } catch (err) {
      console.error("[PurchaseOrderCard] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPo();
  }, [request.id]);

  const handleDownloadPdf = async () => {
    if (!poData?.id) return;
    setIsDownloadingPdf(true);
    try {
      const res = await fetch(`/api/po/${poData.id}/pdf`);
      if (!res.ok) throw new Error("Failed to download PO PDF");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `E3-${poData.poNumber || "PurchaseOrder"}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Purchase Order PDF downloaded.");
    } catch (err: any) {
      toast.error(err.message || "Failed to download PDF");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-5 rounded-3xl border border-border/50 bg-card/60 backdrop-blur-xl flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading Purchase Order status...
      </div>
    );
  }

  // Case 1: No PO exists yet
  if (!poData) {
    const isApproved = request.status === "approved" || request.status === "partially_paid" || request.status === "fully_paid";

    return (
      <>
        <div className="p-6 rounded-3xl border border-border/50 bg-card/60 backdrop-blur-xl shadow-sm hover:shadow-md transition-all">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground tracking-tight">Purchase Order (PO)</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-secondary px-2 py-0.5 rounded-full text-muted-foreground border border-border">
                    {isApproved ? "Ready to Generate" : "Awaiting Approvals"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isApproved
                    ? "Request is fully approved. Finance can issue the binding Purchase Order for the vendor."
                    : "Purchase Orders unlock automatically once all departmental approvers have signed off."}
                </p>
              </div>
            </div>

            {isApproved && isFinanceOrAdmin ? (
              <Button
                onClick={() => setShowGenerateModal(true)}
                className="rounded-2xl gap-2 bg-primary text-primary-foreground font-bold text-xs px-5 py-2.5 shadow-md hover:shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                Generate Purchase Order
              </Button>
            ) : isApproved ? (
              <div className="text-xs font-semibold text-muted-foreground italic bg-secondary/50 px-3 py-1.5 rounded-xl">
                Pending Finance issuance
              </div>
            ) : null}
          </div>
        </div>

        {showGenerateModal && (
          <GeneratePoModal
            isOpen={showGenerateModal}
            onClose={() => setShowGenerateModal(false)}
            request={request}
            onSuccess={(newPo, rawToken) => {
              setPoData(newPo);
              setActiveRawToken(rawToken);
              setCanCreate(false);
              setShowShareModal(true);
            }}
          />
        )}
      </>
    );
  }

  // Case 2: PO exists
  const statusColors: Record<string, string> = {
    draft: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    issued: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    acknowledged: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    fulfilled: "bg-purple-500/10 text-purple-500 border-purple-500/30",
    cancelled: "bg-rose-500/10 text-rose-500 border-rose-500/30",
  };

  const statusBadge = statusColors[poData.status] || "bg-secondary text-muted-foreground border-border";

  return (
    <>
      <div className="p-6 rounded-3xl border border-primary/20 bg-card/80 backdrop-blur-xl shadow-lg relative overflow-hidden">
        {/* Subtle accent glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center shrink-0 border border-primary/30">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono font-bold text-sm text-primary tracking-wide">
                  {poData.poNumber}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${statusBadge}`}>
                  {poData.status}
                </span>
                {poData.acknowledgedBy && (
                  <span className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged by Vendor
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Vendor: <span className="font-semibold text-foreground">{poData.vendor?.companyName}</span> • Issued by {poData.createdBy?.username || "Finance"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="rounded-xl text-xs font-bold gap-1.5 border-border hover:bg-secondary"
            >
              {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-primary" />}
              Download PDF
            </Button>

            {isFinanceOrAdmin && (
              <Button
                size="sm"
                onClick={() => setShowShareModal(true)}
                className="rounded-xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-sm hover:shadow-md"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share with Vendor
              </Button>
            )}
          </div>
        </div>

        {/* PO Metrics Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/40">
            <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-0.5">Order Total</span>
            <span className="font-bold text-foreground text-sm font-mono">
              {poData.currency} {Number(poData.totalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/40">
            <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-0.5">Items Count</span>
            <span className="font-bold text-foreground text-sm">
              {Array.isArray(poData.itemsSnapshot) ? poData.itemsSnapshot.length : 0} items
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/40">
            <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-0.5">Expected Delivery</span>
            <span className="font-bold text-foreground text-sm">
              {poData.expectedDeliveryDate ? new Date(poData.expectedDeliveryDate).toLocaleDateString() : "Pending"}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/40">
            <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-0.5">Payment Terms</span>
            <span className="font-bold text-foreground text-sm truncate block">
              {(poData.paymentTerms || "Standard").replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </div>

      {showShareModal && (
        <SharePoModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          purchaseOrder={poData}
          initialRawToken={activeRawToken}
          onTokenUpdated={(t) => setActiveRawToken(t)}
        />
      )}
    </>
  );
}
