import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { insertPurchaseRequestSchema } from "@db/schema";
import { ArrowLeft, Plus, Trash, Upload } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PurchaseRequest, Vendor } from "@db/schema";
import SubPurposeSelect from "@/components/SubPurposeSelect";
import DepartmentSelect from "@/components/DepartmentSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VendorForm } from "@/components/VendorForm";
import { useQuery } from "@tanstack/react-query";

const currencies = [
  { label: "QAR", value: "QAR" },
  { label: "USD", value: "USD" },
  { label: "CNY", value: "CNY" },
] as const;

const priorities = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
] as const;

const purposeTypes = [
  { label: "E3 EVENT", value: "E3 EVENT" },
  { label: "PROJECT", value: "PROJECT" },
  { label: "MALL", value: "MALL" },
  { label: "BUSINESS GROWTH", value: "BUSINESS GROWTH" },
] as const;

export default function NewRequest() {
  const [, setLocation] = useLocation();
  const { saveDraft: saveDraftRequest, submitRequest: submitRequestForApproval } = usePurchaseRequests();
  const { toast } = useToast();
  const [items, setItems] = useState([{
    name: "",
    quantity: 1,
    estimatedCost: 0,
    description: ""
  }]);
  const [freightAmount, setFreightAmount] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<number | null>(null);

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    staleTime: 30000,
  });

  const form = useForm<PurchaseRequest>({
    resolver: zodResolver(insertPurchaseRequestSchema),
    defaultValues: {
      title: "",
      description: "",
      items: [{ name: "", quantity: 1, estimatedCost: 0, description: "" }],
      purposeType: "E3 EVENT",
      subPurposeId: undefined,
      priority: "medium",
      currency: "QAR",
      status: "draft",
      totalEstimatedCost: 0,
      freightAmount: 0,
      additionalApprovers: [],
    },
  });

  useEffect(() => {
    form.setValue("subPurposeId", undefined);
  }, [form.watch("purposeType")]);

  const calculateTotalCost = () => {
    const itemsTotal = items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.estimatedCost) || 0),
      0
    );
    return itemsTotal + (Number(freightAmount) || 0);
  };

  useEffect(() => {
    const totalCost = calculateTotalCost();
    form.setValue("items", items);
    form.setValue("freightAmount", freightAmount);
    form.setValue("totalEstimatedCost", totalCost);
  }, [items, freightAmount, form]);

  const validateFormData = (values: PurchaseRequest, status: "draft" | "pending") => {
    if (status === "pending") {
      if (!selectedVendor) {
        throw new Error("Please select a vendor");
      }

      if (!values.title?.trim()) {
        throw new Error("Title is required");
      }

      if (!values.description?.trim()) {
        throw new Error("Description is required");
      }

      if (!values.items?.length) {
        throw new Error("At least one item is required");
      }

      values.items.forEach((item, index) => {
        if (!item.name?.trim()) {
          throw new Error(`Item ${index + 1}: Name is required`);
        }
        if (!item.quantity || item.quantity <= 0) {
          throw new Error(`Item ${index + 1}: Valid quantity is required`);
        }
        if (!item.estimatedCost || item.estimatedCost <= 0) {
          throw new Error(`Item ${index + 1}: Valid cost is required`);
        }
      });
    } else {
      // Draft validation - at least one field should be filled
      const hasContent =
        values.title?.trim() ||
        values.description?.trim() ||
        (values.items && values.items.some(item => item.name?.trim())) ||
        values.purposeType;

      if (!hasContent) {
        throw new Error("Draft must contain at least one field (title, description, items, or purpose)");
      }
    }
  };

  const handleSubmit = async (status: "draft" | "pending") => {
    try {
      setIsSubmitting(true);

      // Clear any previous error toasts
      toast.dismiss();

      // Set the status before validation
      form.setValue("status", status);

      // Run form validation
      const isValid = await form.trigger();
      if (!isValid) {
        const errors = form.formState.errors;
        const errorMessages = Object.entries(errors)
          .map(([field, error]) => `${field}: ${error?.message}`)
          .join('\n');

        toast({
          title: "Validation Error",
          description: errorMessages || "Please check all required fields",
          variant: "destructive",
        });
        return;
      }

      const values = form.getValues();

      try {
        // Additional validation based on status
        validateFormData(values, status);
      } catch (validationError: any) {
        toast({
          title: "Validation Error",
          description: validationError.message,
          variant: "destructive",
        });
        return;
      }

      // Prepare form data
      const formData = new FormData();
      const requestData = {
        ...values,
        items: items.map(item => ({
          name: item.name?.trim() || '',
          quantity: Number(item.quantity) || 0,
          estimatedCost: Number(item.estimatedCost) || 0,
          description: item.description?.trim() || ''
        })),
        freightAmount: Number(freightAmount) || 0,
        totalEstimatedCost: calculateTotalCost(),
        vendorId: selectedVendor,
        additionalApprovers: selectedDepartments,
        status,
        updatedAt: new Date().toISOString()
      };

      console.log('Submitting form data:', {
        requestData,
        filesCount: files.length
      });

      if (status === 'draft') {
        await saveDraftRequest({
          id: values.id || 0,
          data: requestData
        });
      } else {
        await submitRequestForApproval({
          id: values.id || 0,
          data: requestData
        });
      }

      toast({
        title: "Success",
        description: status === 'draft' ? "Draft saved successfully" : "Request submitted successfully",
        className: "animate-success",
      });

      setLocation("/");
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to process request",
        variant: "destructive",
        className: "animate-error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addItem = () => {
    setItems([...items, { name: "", quantity: 1, estimatedCost: 0, description: "" }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
    }
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: field === 'name' || field === 'description' ? value : Number(value),
    };
    setItems(newItems);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDepartmentChange = (departments: string[]) => {
    setSelectedDepartments(departments);
    form.setValue('additionalApprovers', departments);
  };

  const handleAddVendor = async (data: any) => {
    try {
      const response = await fetch("/api/vendors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...data, status: "active" }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const newVendor = await response.json();
      setSelectedVendor(newVendor.id);
      setIsAddVendorOpen(false);
      toast({
        title: "Success",
        description: "Vendor added successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add vendor",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#7156a2]/5 to-[#35bbba]/5 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Button
          variant="ghost"
          className="mb-4 hover:bg-[#7156a2]/10 transition-colors interactive-bounce"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="border-[#35bbba]/20 shadow-lg card-hover">
          <CardHeader className="border-b border-[#35bbba]/20 bg-gradient-to-r from-[#7156a2]/5 to-[#35bbba]/5">
            <CardTitle className="text-[#191160] heading-responsive">
              Create New Purchase Request
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              <form className="space-y-8 animate-fade-in" onSubmit={(e) => e.preventDefault()}>
                {/* Purpose Selection */}
                <div className="space-y-6 p-6 bg-white rounded-lg shadow-sm border border-[#35bbba]/20 animate-slide-in">
                  <h3 className="text-lg font-semibold text-[#191160] mb-4">Purpose Selection</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="purposeType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#191160]">Purpose Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="border-[#7156a2]/20 focus:border-[#7156a2]">
                                <SelectValue placeholder="Select purpose type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {purposeTypes.map(({ label, value }) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="subPurposeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#191160]">Sub-purpose</FormLabel>
                          <FormControl>
                            <SubPurposeSelect
                              purposeType={form.watch("purposeType")}
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Basic Information */}
                <div className="space-y-6 p-6 bg-white rounded-lg shadow-sm border border-[#35bbba]/20 animate-slide-in">
                  <h3 className="text-lg font-semibold text-[#191160] mb-4">Basic Information</h3>
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#191160]">Request Title</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="border-[#7156a2]/20 focus:border-[#7156a2] form-focus-ring"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#191160]">Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            className="border-[#7156a2]/20 focus:border-[#7156a2] form-focus-ring"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Vendor Selection */}
                <div className="space-y-6 p-6 bg-white rounded-lg shadow-sm border border-[#35bbba]/20 animate-slide-in">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-[#191160]">Vendor Information</h3>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddVendorOpen(true)}
                      className="border-[#35bbba] text-[#35bbba] hover:bg-[#35bbba]/10"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Vendor
                    </Button>
                  </div>

                  <Select
                    value={selectedVendor?.toString()}
                    onValueChange={(value) => setSelectedVendor(Number(value))}
                  >
                    <FormControl>
                      <SelectTrigger className="border-[#7156a2]/20 focus:border-[#7156a2]">
                        <SelectValue placeholder="Select a vendor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id.toString()}>
                          {vendor.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Items Section */}
                <div className="space-y-6 p-6 bg-white rounded-lg shadow-sm border border-[#35bbba]/20 animate-slide-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <h3 className="text-lg font-semibold text-[#191160]">Items</h3>
                    <div className="flex flex-wrap items-center gap-4">
                      <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="w-[120px] border-[#7156a2]/20 focus:border-[#7156a2]">
                                  <SelectValue placeholder="Currency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {currencies.map(({ label, value }) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addItem}
                        className="border-[#35bbba] text-[#35bbba] hover:bg-[#35bbba]/10 interactive-bounce"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row gap-4 items-start p-4 rounded-lg border border-[#7156a2]/10 hover:border-[#7156a2]/30 transition-colors animate-fade-in"
                      >
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Item name"
                            value={item.name}
                            onChange={(e) => updateItem(index, "name", e.target.value)}
                            className="border-[#7156a2]/20 focus:border-[#7156a2] form-focus-ring"
                          />
                          <Textarea
                            placeholder="Item description (optional)"
                            value={item.description || ''}
                            onChange={(e) => updateItem(index, "description", e.target.value)}
                            className="border-[#7156a2]/20 focus:border-[#7156a2] h-20 resize-none"
                          />
                        </div>
                        <div className="w-full sm:w-24">
                          <Input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", e.target.value)}
                            className="border-[#7156a2]/20 focus:border-[#7156a2] form-focus-ring"
                          />
                        </div>
                        <div className="w-full sm:w-32">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Cost"
                            value={item.estimatedCost}
                            onChange={(e) => updateItem(index, "estimatedCost", e.target.value)}
                            className="border-[#7156a2]/20 focus:border-[#7156a2] form-focus-ring"
                          />
                        </div>
                        <div className="w-full sm:w-32 text-right">
                          <p className="text-sm text-[#191160]">
                            {form.watch("currency")} {(item.quantity * item.estimatedCost).toFixed(2)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 interactive-bounce"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-[#7156a2]/5 to-[#35bbba]/5">
                    <FormItem>
                      <FormLabel className="text-[#191160]">Freight Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={freightAmount}
                          onChange={(e) => setFreightAmount(Number(e.target.value))}
                          className="border-[#7156a2]/20 focus:border-[#7156a2] form-focus-ring"
                        />
                      </FormControl>
                    </FormItem>

                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-[#191160]">
                        <span>Items Total:</span>
                        <span>
                          {form.watch("currency")} {items
                            .reduce(
                              (sum, item) => sum + item.quantity * item.estimatedCost,
                              0
                            )
                            .toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[#191160]">
                        <span>Freight Amount:</span>
                        <span>{form.watch("currency")} {freightAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-[#7156a2]/20">
                        <span className="text-lg font-semibold text-[#191160]">
                          Total Estimated Cost:
                        </span>
                        <span className="text-lg font-bold text-[#7156a2]">
                          {form.watch("currency")} {calculateTotalCost().toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Approvers */}
                <div className="space-y-6 p-6 bg-white rounded-lg shadow-sm border border-[#35bbba]/20 animate-slide-in">
                  <h3 className="text-lg font-semibold text-[#191160] mb-4">Additional Approvers</h3>
                  <DepartmentSelect
                    label="Select Departments"
                    onChange={handleDepartmentChange}
                    value={selectedDepartments}
                    multiple={true}
                  />
                </div>

                {/* Supporting Documents */}
                <div className="space-y-6 p-6 bg-white rounded-lg shadow-sm border border-[#35bbba]/20 animate-slide-in">
                  <h3 className="text-lg font-semibold text-[#191160] mb-4">Supporting Documents</h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-center w-full">
                      <label
                        htmlFor="file-upload"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#7156a2]/20 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="h-8 w-8 text-[#7156a2] mb-2" />
                          <p className="mb-2 text-sm text-[#191160]">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">
                            PDF, Word, Excel, Images (up to 10MB each)
                          </p>
                        </div>
                        <input
                          id="file-upload"
                          type="file"
                          className="hidden"
                          multiple
                          onChange={handleFileChange}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        />
                      </label>
                    </div>

                    {files.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {files.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-white rounded-lg border border-[#7156a2]/10"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-[#191160]">{file.name}</span>
                              <span className="text-xs text-gray-500">
                                ({(file.size / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFile(index)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 interactive-bounce"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6">
                  <Button
                    type="button"
                    onClick={() => handleSubmit("draft")}
                    variant="outline"
                    disabled={isSubmitting || form.formState.isSubmitting}
                    className="border-[#35bbba] text-[#35bbba] hover:bg-[#35bbba]/10 interactive-bounce btn-hover-effect"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center">
                        <div className="loading-spin mr-2" />
                        Saving...
                      </div>
                    ) : (
                      "Save as Draft"
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSubmit("pending")}
                    disabled={isSubmitting || form.formState.isSubmitting}
                    className="bg-[#7156a2] hover:bg-[#7156a2]/90 text-white interactive-bounce btn-hover-effect"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center">
                        <div className="loading-spin mr-2" />
                        Submitting...
                      </div>
                    ) : (
                      "Submit for Approval"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Add Vendor Dialog */}
      <Dialog open={isAddVendorOpen} onOpenChange={setIsAddVendorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add New Vendor</DialogTitle>
          </DialogHeader>
          <VendorForm onSubmit={handleAddVendor} isLimitedAccess={true} />
        </DialogContent>
      </Dialog>
    </div>
  );
}