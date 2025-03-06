import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Search, Star } from "lucide-react";
import type { Vendor } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { VendorForm } from "@/components/VendorForm";
import { VendorDetails } from "@/components/VendorDetails";
import { createVendor, updateVendor } from "@/services/vendors";

export default function VendorManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked" | "frozen">("all");
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vendors = [], isLoading, error } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    retry: false,
    staleTime: 5000
  });

  const addVendorMutation = useMutation({
    mutationFn: async (data: Omit<Vendor, "id" | "createdAt" | "updatedAt">) => {
      // Use our service function
      // Ensure rating is a number
      const formattedData = {
        ...data,
        rating: typeof data.rating === 'string' ? Number(data.rating) || 0 : data.rating || 0
      };
      console.log("Create vendor data with formatted rating:", formattedData);
      return createVendor(formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsAddVendorOpen(false);
      toast({
        title: "Success",
        description: "Vendor added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add vendor",
        variant: "destructive",
      });
    },
  });

  // We're now using the updateVendor function directly from service instead of a mutation

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

  const filteredVendors = vendors?.filter((vendor: Vendor) => {
    const matchesSearch =
      vendor.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.contactPerson.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || vendor.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) ?? [];

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-500">
              <p>Failed to load vendors. Please try again later.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAddVendor = async (data: any) => {
    await addVendorMutation.mutateAsync({
      ...data,
      status: "active",
    });
  };

  const handleUpdateVendor = async (data: any) => {
    console.log('handleUpdateVendor called with data:', data);
    
    if (!selectedVendor) {
      console.error('No vendor selected!');
      toast({
        title: "Error",
        description: "No vendor selected for update",
        variant: "destructive",
      });
      return;
    }
    
    // Process data to ensure nulls are handled correctly
    const processedData = { ...data };
    
    // Handle optional fields that might be empty strings
    if (processedData.taxNumber === '') processedData.taxNumber = null;
    if (processedData.registrationNumber === '') processedData.registrationNumber = null;
    if (processedData.remarks === '') processedData.remarks = null;
    
    // Make sure we maintain the original status
    processedData.status = selectedVendor.status;
    
    // Log the final data being sent with the required vendorId
    console.log(`Updating vendor ID: ${selectedVendor.id} with data:`, processedData);
    
    // Show loading toast
    toast({
      title: "Processing",
      description: "Updating vendor information...",
    });
    
    try {
      // Add debug event listeners to check for network issues
      const originalFetch = window.fetch;
      const fetchSpy = async (...args: Parameters<typeof originalFetch>) => {
        console.log('Network request being made:', args[0]);
        try {
          const response = await originalFetch(...args);
          console.log('Response status:', response.status);
          return response;
        } catch (fetchError) {
          console.error('Fetch error:', fetchError);
          throw fetchError;
        }
      };
      
      // Replace fetch temporarily
      window.fetch = fetchSpy;
      
      try {
        // Use our updateVendor service function with explicit ID
        console.log(`Calling updateVendor function with ID: ${selectedVendor.id}`);
        
        // Make sure ID is explicitly included both as param and in data
        // Also ensure rating is properly cast to a number
        const vendorDataWithId = {
          ...processedData,
          id: selectedVendor.id, // Include ID in the data explicitly
          rating: processedData.rating ? Number(processedData.rating) : 0, // Convert rating to a number
        };
        console.log("Final data with explicit ID and proper types:", vendorDataWithId);
        
        const updatedVendor = await updateVendor(selectedVendor.id, vendorDataWithId);
        console.log('Update vendor service returned:', updatedVendor);
        
        // After a successful update, handle UI state
        queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
        setIsEditMode(false);
        setSelectedVendor(null);
        
        toast({
          title: "Success",
          description: "Vendor has been updated successfully",
        });
        
        return updatedVendor;
      } finally {
        // Restore original fetch
        window.fetch = originalFetch;
      }
    } catch (error) {
      console.error("Error in handleUpdateVendor:", error);
      
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update vendor information",
        variant: "destructive",
      });
    }
  };

  const handleViewDetails = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsEditMode(false);
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Vendor Management</CardTitle>
          <Button onClick={() => setIsAddVendorOpen(true)}>
            <Plus className="h-4 w-4 sm:mr-2" />
            {!isMobile && <span>Add New Vendor</span>}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value: "all" | "active" | "blocked" | "frozen") => setStatusFilter(value)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="frozen">Frozen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  {!isMobile && <TableHead>Contact Person</TableHead>}
                  {!isMobile && <TableHead>Email</TableHead>}
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={isMobile ? 4 : 6} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredVendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isMobile ? 4 : 6} className="text-center py-8">
                      No vendors found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVendors.map((vendor: Vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">
                        {vendor.companyName}
                        {isMobile && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {vendor.contactPerson}
                          </div>
                        )}
                      </TableCell>
                      {!isMobile && <TableCell>{vendor.contactPerson}</TableCell>}
                      {!isMobile && <TableCell>{vendor.email}</TableCell>}
                      <TableCell>
                        <div className="flex items-center">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                          <span>{vendor.rating || 0}/5</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(vendor.status)}>
                          {vendor.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(vendor)}
                        >
                          {isMobile ? "View" : "View Details"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddVendorOpen} onOpenChange={setIsAddVendorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add New Vendor</DialogTitle>
          </DialogHeader>
          <VendorForm onSubmit={handleAddVendor} />
        </DialogContent>
      </Dialog>

      {selectedVendor && !isEditMode && (
        <VendorDetails
          vendor={selectedVendor}
          open={!!selectedVendor}
          onOpenChange={(open) => !open && setSelectedVendor(null)}
          onEdit={handleEdit}
        />
      )}

      {selectedVendor && isEditMode && (
        <Dialog open={isEditMode} onOpenChange={(open) => !open && setIsEditMode(false)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Edit Vendor</DialogTitle>
            </DialogHeader>
            <VendorForm
              onSubmit={handleUpdateVendor}
              defaultValues={selectedVendor}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}