import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Vendor } from "@db/schema";

interface VendorDetailsProps {
  vendor: Vendor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VendorDetails({ vendor, open, onOpenChange }: VendorDetailsProps) {
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

  return (
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
      </DialogContent>
    </Dialog>
  );
}
