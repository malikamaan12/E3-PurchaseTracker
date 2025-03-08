import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertPurchaseRequestSchema } from "@db/schema";
import { ArrowLeft, Plus, Trash, Upload, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PurchaseRequest, Vendor } from "@db/schema";
import SubPurposeSelect from "@/components/SubPurposeSelect";
import DepartmentSelect from "@/components/DepartmentSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import VendorDialog from "@/components/VendorDialog";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { FilePreview } from "@/components/FilePreview";
import type { File } from "@/types";
import { Badge } from "@/components/ui/badge";
import ToastService from "@/services/toast.service";

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

  const { data: vendors = [], isError: isVendorError } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    staleTime: 30000
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
    if (form.watch("purposeType")) {
      form.setValue("subPurposeId", undefined);
    }
  }, [form.watch("purposeType")]);

  const calculateTotalCost = useCallback(() => {
    const itemsTotal = items.reduce((sum, item) => sum + item.quantity * item.estimatedCost, 0);
    return itemsTotal + freightAmount;
  }, [items, freightAmount]);

  useEffect(() => {
    const totalCost = calculateTotalCost();
    form.setValue("items", items, { shouldValidate: true });
    form.setValue("freightAmount", freightAmount, { shouldValidate: true });
    form.setValue("totalEstimatedCost", totalCost, { shouldValidate: true });
  }, [items, freightAmount, form, calculateTotalCost]);

  const validateFormData = async () => {
    const validationErrors: string[] = [];

    if (!selectedVendor) {
      validationErrors.push("Please select a vendor");
    }

    if (!form.getValues("title")?.trim()) {
      validationErrors.push("Title is required");
    }

    if (!form.getValues("description")?.trim()) {
      validationErrors.push("Description is required and must be at least 10 characters");
    }

    const formItems = form.getValues("items");
    if (!formItems || formItems.length === 0) {
      validationErrors.push("At least one item is required");
    } else {
      formItems.forEach((item, index) => {
        if (!item.name?.trim()) {
          validationErrors.push(`Item ${index + 1} name is required`);
        }
        if (item.quantity < 1) {
          validationErrors.push(`Item ${index + 1} quantity must be at least 1`);
        }
        if (item.estimatedCost < 0) {
          validationErrors.push(`Item ${index + 1} cost cannot be negative`);
        }
      });
    }

    if (validationErrors.length > 0) {
      validationErrors.forEach(error => {
        ToastService.error("Validation Error", error);
      });
      return false;
    }

    return true;
  };

  const onSubmit = async (values: PurchaseRequest) => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      ToastService.loading("Processing Request", "Please wait while we process your request...");

      const isValid = await validateFormData();
      if (!isValid) {
        setIsSubmitting(false);
        return;
      }

      // File validation
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

      const invalidFiles = files.filter(file => {
        if (file.size > maxFileSize) {
          ToastService.error("File Too Large", `${file.name} exceeds 10MB limit`);
          return true;
        }
        if (!allowedTypes.includes(file.type)) {
          ToastService.error("Invalid File Type", `${file.name} is not an allowed file type`);
          return true;
        }
        return false;
      });

      if (invalidFiles.length > 0) {
        setIsSubmitting(false);
        return;
      }

      const formData = new FormData();
      const formattedData = {
        ...values,
        items: items.map(item => ({
          name: item.name.trim(),
          quantity: Number(item.quantity),
          estimatedCost: Number(item.estimatedCost),
          description: item.description?.trim() || ''
        })),
        freightAmount: Number(freightAmount),
        totalEstimatedCost: calculateTotalCost(),
        vendorId: selectedVendor,
        additionalApprovers: selectedDepartments,
        action: values.status
      };

      formData.append('data', JSON.stringify(formattedData));
      files.forEach(file => formData.append('files', file));

      const response = await fetch('/api/requests', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || "Failed to create request");
      }

      const result = await response.json();

      ToastService.success(
        "Request Created",
        `Request ${result.requestNumber} ${values.status === 'draft' ? 'saved as draft' : 'submitted'} successfully`
      );

      setLocation("/");
    } catch (error: any) {
      console.error("Create request error:", error);
      ToastService.error(
        "Error",
        error.message || "Failed to create request. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const maxFileSize = 10 * 1024 * 1024;
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

      const validFiles = newFiles.filter(file => {
        if (file.size > maxFileSize) {
          ToastService.error("File Too Large", `${file.name} exceeds 10MB limit`);
          return false;
        }
        if (!allowedTypes.includes(file.type)) {
          ToastService.error("Invalid File Type", `${file.name} is not an allowed file type`);
          return false;
        }
        return true;
      });

      if (validFiles.length > 0) {
        ToastService.success("Files Added", `${validFiles.length} file(s) added successfully`);
        setFiles(prev => [...prev, ...validFiles]);
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDepartmentChange = (departments: string[]) => {
    setSelectedDepartments(departments);
    form.setValue('additionalApprovers', departments);
  };

  const handleVendorCreated = (vendor: Vendor) => {
    setSelectedVendor(vendor.id);
    setIsAddVendorOpen(false);
    ToastService.success("Success", "Vendor added successfully");
  };

  const addItem = () => {
    setItems([...items, { name: "", quantity: 1, estimatedCost: 0, description: "" }]);
  };

  const updateItem = (index: number, key: string, value: string) => {
    const newItems = [...items];
    newItems[index][key] = value;
    setItems(newItems);
  };


  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleSubmit = (status: 'draft' | 'pending') => {
    form.setValue("status", status);
    form.handleSubmit(onSubmit)();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#7058a3]/5 to-[#3eb6ba]/5 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Button
          variant="ghost"
          className="mb-6 group hover:bg-[#7058a3]/10 transition-all duration-200 rounded-lg"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[#7058a3] font-medium">Back to Dashboard</span>
        </Button>

        <Card className="border-[#3eb6ba]/20 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="border-b border-[#3eb6ba]/20 dark:border-[#3eb6ba]/30 bg-gradient-to-r from-[#7058a3]/5 to-[#3eb6ba]/5 dark:from-[#7058a3]/10 dark:to-[#3eb6ba]/10">
            <CardTitle className="text-[#7058a3] dark:text-[#9f83d5] text-2xl font-bold">
              Create New Purchase Request
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid gap-6">
            <Form {...form}>
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-[#3eb6ba]/20 dark:border-[#3eb6ba]/30 hover:border-[#3eb6ba]/40 dark:hover:border-[#3eb6ba]/50 transition-colors">
                    <h3 className="text-lg font-semibold text-[#7058a3] dark:text-[#9f83d5] mb-4 flex items-center">
                      <span className="w-1.5 h-6 bg-[#7058a3] dark:bg-[#9f83d5] rounded-r mr-2"></span>
                      Purpose Selection
                    </h3>
                    <FormField
                      control={form.control}
                      name="purposeType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#7058a3]">Purpose Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} name="purposeType" id="purposeType">
                            <FormControl>
                              <SelectTrigger className="border-[#7058a3]/20 focus:border-[#7058a3]">
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
                          <FormLabel className="text-[#7058a3]">Sub-purpose</FormLabel>
                          <FormControl>
                            <SubPurposeSelect
                              purposeType={form.watch("purposeType")}
                              value={field.value}
                              onChange={field.onChange}
                              id="subPurposeId"
                              name="subPurposeId"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-6 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-[#3eb6ba]/20 dark:border-[#3eb6ba]/30 hover:border-[#3eb6ba]/40 dark:hover:border-[#3eb6ba]/50 transition-colors">
                    <h3 className="text-lg font-semibold text-[#7058a3] dark:text-[#9f83d5] mb-4 flex items-center">
                      <span className="w-1.5 h-6 bg-[#7058a3] dark:bg-[#9f83d5] rounded-r mr-2"></span>
                      Basic Information
                    </h3>
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#7058a3]">Request Title</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              id="title"
                              name="title"
                              className="border-[#7058a3]/20 focus:border-[#7058a3] form-focus-ring"
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
                          <FormLabel className="text-[#7058a3]">Description</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              id="description"
                              name="description"
                              className="border-[#7058a3]/20 focus:border-[#7058a3] form-focus-ring"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-6 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-[#3eb6ba]/20 dark:border-[#3eb6ba]/30 hover:border-[#3eb6ba]/40 dark:hover:border-[#3eb6ba]/50 transition-colors">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-[#7058a3] dark:text-[#9f83d5] flex items-center">
                      <span className="w-1.5 h-6 bg-[#7058a3] dark:bg-[#9f83d5] rounded-r mr-2"></span>
                      Vendor Information
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddVendorOpen(true)}
                      className="border-[#3eb6ba] text-[#3eb6ba] hover:bg-[#3eb6ba]/10 transition-colors interactive-bounce"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Vendor
                    </Button>
                  </div>

                  <Select
                    value={selectedVendor?.toString()}
                    onValueChange={(value) => setSelectedVendor(Number(value))}
                    name="vendorId"
                    id="vendorId"
                  >
                    <FormControl>
                      <SelectTrigger className="border-[#7058a3]/20 focus:border-[#7058a3]">
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

                <div className="space-y-6 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-[#3eb6ba]/20 dark:border-[#3eb6ba]/30 hover:border-[#3eb6ba]/40 dark:hover:border-[#3eb6ba]/50 transition-colors">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <h3 className="text-lg font-semibold text-[#7058a3] dark:text-[#9f83d5] flex items-center">
                      <span className="w-1.5 h-6 bg-[#7058a3] dark:bg-[#9f83d5] rounded-r mr-2"></span>
                      Items
                    </h3>
                    <div className="flex flex-wrap items-center gap-4">
                      <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} defaultValue={field.value} name="currency" id="currency">
                              <FormControl>
                                <SelectTrigger className="w-[120px] border-[#7058a3]/20 focus:border-[#7058a3]">
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
                        className="border-[#3eb6ba] text-[#3eb6ba] hover:bg-[#3eb6ba]/10 interactive-bounce"
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
                        className="flex flex-col sm:flex-row gap-4 items-start p-4 rounded-lg border border-[#7058a3]/10 hover:border-[#7058a3]/30 transition-colors animate-fade-in"
                      >
                        <div className="flex-1 space-y-2">
                          <Input
                            id={`item-name-${index}`}
                            name={`items[${index}].name`}
                            placeholder="Item name"
                            value={item.name}
                            onChange={(e) => updateItem(index, "name", e.target.value)}
                            className="border-[#7058a3]/20 focus:border-[#7058a3] form-focus-ring"
                          />
                          <Textarea
                            id={`item-description-${index}`}
                            name={`items[${index}].description`}
                            placeholder="Item description (optional)"
                            value={item.description || ''}
                            onChange={(e) => updateItem(index, "description", e.target.value)}
                            className="border-[#7058a3]/20 focus:border-[#7058a3] h-20 resize-none"
                          />
                        </div>
                        <div className="w-full sm:w-24">
                          <Input
                            id={`item-quantity-${index}`}
                            name={`items[${index}].quantity`}
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", e.target.value)}
                            className="border-[#7058a3]/20 focus:border-[#7058a3] form-focus-ring"
                          />
                        </div>
                        <div className="w-full sm:w-32">
                          <Input
                            id={`item-cost-${index}`}
                            name={`items[${index}].estimatedCost`}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Cost"
                            value={item.estimatedCost}
                            onChange={(e) => updateItem(index, "estimatedCost", e.target.value)}
                            className="border-[#7058a3]/20 focus:border-[#7058a3] form-focus-ring"
                          />
                        </div>
                        <div className="w-full sm:w-32 text-right">
                          <p className="text-sm text-[#7058a3]">
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

                  <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-[#7058a3]/5 to-[#3eb6ba]/5">
                    <FormItem>
                      <FormLabel className="text-[#7058a3]">Freight Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={freightAmount}
                          onChange={(e) => setFreightAmount(Number(e.target.value))}
                          id="freightAmount"
                          name="freightAmount"
                          className="border-[#7058a3]/20 focus:border-[#7058a3] form-focus-ring"
                        />
                      </FormControl>
                    </FormItem>

                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-[#7058a3]">
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
                      <div className="flex justify-between text-[#7058a3]">
                        <span>Freight Amount:</span>
                        <span>{form.watch("currency")} {freightAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-[#7058a3]/20">
                        <span className="text-lg font-semibold text-[#7058a3]">
                          Total Estimated Cost:
                        </span>
                        <span className="text-lg font-bold text-[#7058a3]">
                          {form.watch("currency")} {calculateTotalCost().toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-[#3eb6ba]/20 dark:border-[#3eb6ba]/30 hover:border-[#3eb6ba]/40 dark:hover:border-[#3eb6ba]/50 transition-colors">
                  <h3 className="text-lg font-semibold text-[#7058a3] dark:text-[#9f83d5] mb-4 flex items-center">
                    <span className="w-1.5 h-6 bg-[#7058a3] dark:bg-[#9f83d5] rounded-r mr-2"></span>
                    Additional Approvers
                  </h3>
                  <DepartmentSelect
                    label="Select Departments"
                    onChange={handleDepartmentChange}
                    value={selectedDepartments}
                    multiple={true}
                    name="additionalApprovers"
                    id="additionalApprovers"
                  />
                </div>

                {/* New Approval Flow Section */}
                <div className="space-y-6 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-[#3eb6ba]/20 dark:border-[#3eb6ba]/30 hover:border-[#3eb6ba]/40 dark:hover:border-[#3eb6ba]/50 transition-colors">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-[#7058a3] dark:text-[#9f83d5] mb-4 flex items-center">
                      <span className="w-1.5 h-6 bg-[#7058a3] dark:bg-[#9f83d5] rounded-r mr-2"></span>
                      Approval Flow
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {/* Mandatory Approvers */}
                    <div>
                      <h4 className="text-sm font-medium text-[#7058a3] mb-2">Mandatory Approvers</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-2">
                          These departments must approve your request:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {['Finance', 'Management'].map((dept) => (
                            <Badge key={dept} variant="secondary" className="bg-[#7058a3]/10 text-[#7058a3]">
                              {dept}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Optional Approvers */}
                    <div>
                      <h4 className="text-sm font-medium text-[#7058a3] mb-2">Additional Approvers</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        Select additional departments that should review this request:
                      </p>
                      <DepartmentSelect
                        label="Select Departments"
                        onChange={handleDepartmentChange}
                        value={selectedDepartments}
                        multiple={true}
                        excludeDepartments={['Finance', 'Management']} // Exclude mandatory approvers
                        name="additionalApprovers"
                        id="additionalApprovers"
                      />
                    </div>

                    {/* Preview of approval flow */}
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-[#7058a3] mb-2">Approval Flow Preview</h4>
                      <div className="space-y-2">
                        {[...['Finance', 'Management'], ...selectedDepartments].map((dept, index) => (
                          <div
                            key={dept}
                            className="flex items-center gap-2 p-2 bg-white rounded-lg border border-[#7058a3]/10"
                          >
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#7058a3]/10 text-[#7058a3] text-sm">
                              {index + 1}
                            </div>
                            <span className="text-sm font-medium">{dept}</span>
                            {index < 2 && (
                              <Badge variant="outline" className="ml-auto text-xs">
                                Mandatory
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 p-6 bg-white rounded-xl shadow-sm border border-[#3eb6ba]/20 hover:border-[#3eb6ba]/40 transition-colors">
                  <h3 className="text-lg font-semibold text-[#7058a3] mb-4 flex items-center">
                    <span className="w-1.5 h-6 bg-[#7058a3] rounded-r mr-2"></span>
                    Supporting Documents
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-center w-full">
                      <label
                        htmlFor="file-upload"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#7058a3]/20 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="h-8 w-8 text-[#7058a3] mb-2" />
                          <p className="mb-2 text-sm text-[#7058a3]">
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
                          name="files"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        />
                      </label>
                    </div>

                    {files.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {files.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-white rounded-lg border border-[#7058a3]/10 hover:border-[#7058a3]/30 transition-colors"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-[#7058a3]">{file.name}</span>
                              <span className="text-xs text-gray-500">
                                ({(file.size / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <FilePreview file={file} />
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
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6">
                  <Button
                    type="button"
                    onClick={() => handleSubmit("draft")}
                    variant="outline"
                    disabled={isSubmitting}
                    className="border-[#3eb6ba] text-[#3eb6ba] hover:bg-[#3eb6ba]/10 transition-colors"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </div>
                    ) : (
                      "Save as Draft"
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSubmit("pending")}
                    disabled={isSubmitting}
                    className="bg-[#7058a3] hover:bg-[#7058a3]/90 text-white transition-colors"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </div>
                    ) : (
                      "Submit for Approval"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent</Card>
      </div>

      <VendorDialog
        isOpen={isAddVendorOpen}
        onClose={() => setIsAddVendorOpen(false)}
        onVendorCreated={handleVendorCreated}
      />
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Processing request...</span>
          </div>
        </div>
      )}
    </div>
  );
}}