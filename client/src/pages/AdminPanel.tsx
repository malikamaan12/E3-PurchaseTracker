import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import CompanyBrandingForm from "@/components/CompanyBrandingForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Ban, Check, Search, Star } from "lucide-react";
import VendorSelect from "@/components/VendorSelect";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Vendor } from "@db/schema";

export default function AdminPanel() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("branding");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all"); // Changed default value to "all"
  const queryClient = useQueryClient();

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const updateVendorRating = useMutation({
    mutationFn: async ({ id, rating }: { id: number; rating: number }) => {
      const res = await fetch(`/api/vendors/${id}/rating`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({
        title: "Success",
        description: "Vendor rating updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleVendorStatus = useMutation({
    mutationFn: async ({ id, status, blockReason }: { id: number; status: string; blockReason?: string }) => {
      const res = await fetch(`/api/vendors/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, blockReason }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({
        title: "Success",
        description: "Vendor status updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredVendors = vendors.filter((vendor) => {
    const matchesSearch = vendor.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.contactPerson.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || vendor.category === categoryFilter; // Updated condition
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="container mx-auto py-8">
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="vendors">Vendor Management</TabsTrigger>
        </TabsList>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Company Branding</CardTitle>
              <CardDescription>
                Customize company branding, logo, and PDF templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyBrandingForm />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendors Tab */}
        <TabsContent value="vendors">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Management</CardTitle>
              <CardDescription>
                Add and manage vendor information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <VendorSelect
                  onChange={(id, name) => {
                    toast({
                      title: "Vendor Selected",
                      description: `Selected vendor: ${name}`,
                    });
                  }}
                />

                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mt-8">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search vendors..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="materials_supplier">Materials Supplier</SelectItem>
                      <SelectItem value="service_provider">Service Provider</SelectItem>
                      <SelectItem value="logistic_partner">Logistic Partner</SelectItem>
                      <SelectItem value="equipment_rental">Equipment Rental</SelectItem>
                      <SelectItem value="others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Contact Person</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center">
                            Loading vendors...
                          </TableCell>
                        </TableRow>
                      ) : filteredVendors.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center">
                            No vendors found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredVendors.map((vendor) => (
                          <TableRow key={vendor.id}>
                            <TableCell>{vendor.companyName}</TableCell>
                            <TableCell className="capitalize">
                              {vendor.category.replace(/_/g, " ")}
                            </TableCell>
                            <TableCell>{vendor.contactPerson}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-4 w-48">
                                <Slider
                                  defaultValue={[vendor.rating || 0]}
                                  max={5}
                                  step={1}
                                  onValueChange={([value]) => {
                                    updateVendorRating.mutate({
                                      id: vendor.id,
                                      rating: value,
                                    });
                                  }}
                                />
                                <div className="flex items-center">
                                  <Star className="h-4 w-4 text-yellow-400 mr-1" />
                                  <span>{vendor.rating || 0}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  vendor.status === "active"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {vendor.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newStatus = vendor.status === "active" ? "blocked" : "active";
                                  const blockReason = newStatus === "blocked"
                                    ? window.prompt("Please enter the reason for blocking this vendor:")
                                    : undefined;

                                  if (newStatus === "blocked" && !blockReason) {
                                    return; // Cancel if no reason provided
                                  }

                                  toggleVendorStatus.mutate({
                                    id: vendor.id,
                                    status: newStatus,
                                    blockReason,
                                  });
                                }}
                              >
                                {vendor.status === "active" ? (
                                  <Ban className="h-4 w-4 text-red-500" />
                                ) : (
                                  <Check className="h-4 w-4 text-green-500" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}