import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Vendor } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Edit, Lock, Unlock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

interface VendorDetailsProps {
  vendor: Vendor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

export function VendorDetails({ vendor, open, onOpenChange, onEdit }: VendorDetailsProps) {
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<"active" | "blocked" | "frozen" | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateVendorStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/vendors/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({
        title: "Success",
        description: "Vendor status updated successfully",
      });
      setShowStatusConfirm(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update vendor status",
        variant: "destructive",
      });
    },
  });

  const getStatusBadgeVariant = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case "active":
        return "default";
      case "blocked":
        return "destructive";
      case "frozen":
        return "secondary";
      default:
        return "outline";
    }
  };

  const handleStatusChange = (status: "active" | "blocked" | "frozen") => {
    setPendingStatus(status);
    setShowStatusConfirm(true);
  };

  const confirmStatusChange = () => {
    if (pendingStatus) {
      updateVendorStatus.mutate({ id: vendor.id, status: pendingStatus });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Vendor Details</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-[#191160]">Company Information</h3>
              <p><span className="text-gray-500">Company Name:</span> {vendor.companyName}</p>
              <p><span className="text-gray-500">Registration Number:</span> {vendor.registrationNumber || 'N/A'}</p>
              <p><span className="text-gray-500">Status:</span> <Badge variant={getStatusBadgeVariant(vendor.status)}>{vendor.status}</Badge></p>
              <p><span className="text-gray-500">Rating:</span> {vendor.rating || 0}/5</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-[#191160]">Contact Information</h3>
              <p><span className="text-gray-500">Contact Person:</span> {vendor.contactPerson}</p>
              <p><span className="text-gray-500">Contact Number:</span> {vendor.contactNumber}</p>
              <p><span className="text-gray-500">Email:</span> {vendor.email}</p>
              <p><span className="text-gray-500">Address:</span> {vendor.address}</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-[#191160]">Banking Details</h3>
              <p><span className="text-gray-500">Bank Name:</span> {vendor.bankName}</p>
              <p><span className="text-gray-500">Branch Name:</span> {vendor.branchName}</p>
              <p><span className="text-gray-500">Account Number:</span> {vendor.accountNumber}</p>
              <p><span className="text-gray-500">IBAN Number:</span> {vendor.ibanNumber}</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-[#191160]">Additional Information</h3>
              <p><span className="text-gray-500">Category:</span> {vendor.category}</p>
              <p><span className="text-gray-500">Payment Currency:</span> {vendor.payment_currency}</p>
              <p><span className="text-gray-500">Created At:</span> {new Date(vendor.createdAt).toLocaleDateString()}</p>
              <p><span className="text-gray-500">Last Updated:</span> {new Date(vendor.updatedAt).toLocaleDateString()}</p>
            </div>

            {vendor.remarks && (
              <div className="col-span-2 space-y-2">
                <h3 className="font-semibold text-[#191160]">Remarks</h3>
                <p className="text-gray-600">{vendor.remarks}</p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 flex justify-between gap-2">
            <div className="flex gap-2">
              {vendor.status !== "blocked" && (
                <Button
                  variant="destructive"
                  onClick={() => handleStatusChange("blocked")}
                  disabled={updateVendorStatus.isPending}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Block Vendor
                </Button>
              )}
              {vendor.status !== "frozen" && (
                <Button
                  variant="secondary"
                  onClick={() => handleStatusChange("frozen")}
                  disabled={updateVendorStatus.isPending}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Freeze Vendor
                </Button>
              )}
              {vendor.status !== "active" && (
                <Button
                  variant="default"
                  onClick={() => handleStatusChange("active")}
                  disabled={updateVendorStatus.isPending}
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  Activate Vendor
                </Button>
              )}
            </div>
            <Button onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showStatusConfirm} onOpenChange={setShowStatusConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change the vendor status to{" "}
              <span className="font-semibold">{pendingStatus}</span>? This action may affect ongoing
              transactions and relationships with the vendor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}