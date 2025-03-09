import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPurchaseRequestSchema, type InsertSubPurpose, type Vendor } from "@db/schema";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Upload, Loader2, Plus, AlertTriangle, Eye } from "lucide-react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { analyzeFormError } from "@/lib/debugUtils";
import { useState as useState2 } from "react";
import VendorDialog from "./VendorDialog";
import DepartmentSelect from "./DepartmentSelect";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FileWithPreview, UploadedFile } from "@/types";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { FileUploadMultiple } from "./FileUploadMultiple";  // Added back the import

interface PurchaseRequestFormProps {
  subPurposes: InsertSubPurpose[];
  vendors: Vendor[];
  onSubmit?: (draft?: boolean) => void;
  onCancel?: () => void;
  initialData?: any;
  onVendorCreated?: (newVendor: Vendor) => void;
}

export default function PurchaseRequestForm({
  subPurposes = [],
  vendors = [],
  onSubmit,
  onCancel,
  initialData,
  onVendorCreated
}: PurchaseRequestFormProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [filteredSubPurposes, setFilteredSubPurposes] = useState<InsertSubPurpose[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState2(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const form = useForm({
    resolver: zodResolver(insertPurchaseRequestSchema),
    defaultValues: initialData || {
      title: "",
      description: "",
      items: [{
        name: "",
        quantity: 1,
        estimatedCost: 0,
        description: ""
      }],
      purposeType: "",
      subPurposeId: undefined,
      priority: "medium",
      currency: "QAR",
      totalEstimatedCost: 0,
      freightAmount: 0,
      vendorId: undefined,
      additionalApprovers: []
    }
  });

  useEffect(() => {
    const purposeType = form.watch("purposeType");
    if (purposeType) {
      const filtered = subPurposes.filter(sp => sp.purpose_type === purposeType);
      setFilteredSubPurposes(filtered);

      const currentSubPurposeId = form.watch("subPurposeId");
      if (currentSubPurposeId && !filtered.some(sp => sp.id === currentSubPurposeId)) {
        form.setValue("subPurposeId", undefined);
      }
    } else {
      setFilteredSubPurposes([]);
    }
  }, [form.watch("purposeType"), subPurposes]);

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Submitting data:', data);
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit request');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Toast notification moved to handleSubmitRequest to avoid duplicates
      navigate('/');
    },
    onError: async (error: Error) => {
      console.error('Form submission error:', error);

      const errorToast = toast({
        title: "Error",
        description: "Analyzing submission error...",
        variant: "destructive",
        duration: null,
      });

      try {
        const formState = {
          values: form.getValues(),
          errors: form.formState.errors,
          isDirty: form.formState.isDirty,
          touchedFields: form.formState.touchedFields,
        };

        const analysisResponse = await fetch('/api/analyze-submission', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            formData: form.getValues(),
            error: error.message,
            formState
          }),
          credentials: 'include'
        });

        if (analysisResponse.ok) {
          const analysis = await analysisResponse.json();

          errorToast.dismiss();

          toast({
            title: "Form Submission Error",
            description: (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">
                  {error.message}
                </p>
                {analysis.suggestion && (
                  <p className="text-sm text-muted-foreground">
                    Suggestion: {analysis.suggestion}
                  </p>
                )}
                {analysis.autofix && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Auto-fix available
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        Object.entries(analysis.autofix).forEach(([field, value]) => {
                          form.setValue(field as any, value);
                        });
                        toast({
                          title: "Changes Applied",
                          description: "Suggested fixes have been applied to the form",
                          variant: "default"
                        });
                      }}
                    >
                      Apply Fix
                    </Button>
                  </div>
                )}
                {analysis.validationErrors?.length > 0 && (
                  <ul className="list-disc pl-4 text-sm text-muted-foreground">
                    {analysis.validationErrors.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            ),
            variant: "destructive",
            duration: 8000,
          });

        } else {
          const localAnalysis = await analyzeFormError(form.getValues(), error);

          toast({
            title: "Error",
            description: (
              <div className="space-y-2">
                <p className="text-sm text-destructive">{error.message}</p>
                <p className="text-sm text-muted-foreground">{localAnalysis}</p>
              </div>
            ),
            variant: "destructive",
            duration: 5000,
          });
        }
      } catch (analysisError) {
        console.error('Error getting analysis:', analysisError);
        toast({
          title: "Error",
          description: error.message || "Failed to submit request",
          variant: "destructive",
          duration: 5000,
        });
      }
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to upload files: ${await response.text()}`);
      }

      return response.json();
    }
  });

  const calculateTotalCost = (items: any[], freightAmount: number) => {
    const itemsTotal = items.reduce(
      (sum, item) => sum + (Number(item.quantity || 0) * Number(item.estimatedCost || 0)),
      0
    );
    return itemsTotal + Number(freightAmount || 0);
  };

  const updateTotalCost = () => {
    const items = form.getValues("items") || [];
    const freightAmount = form.getValues("freightAmount") || 0;
    const total = calculateTotalCost(items, freightAmount);
    form.setValue("totalEstimatedCost", total);
  };

  const handleSubmitRequest = async (data: z.infer<typeof insertPurchaseRequestSchema>, draft: boolean = false) => {
    try {
      if (isSubmitting) return; // Prevent multiple submissions
      setIsSubmitting(true);
      console.log('Form data before submission:', data);

      // Basic validation
      if (!draft) {
        const validationErrors = [];
        if (!data.vendorId) validationErrors.push("Please select a vendor");
        if (!data.title?.trim()) validationErrors.push("Title is required");
        if (!data.description?.trim()) validationErrors.push("Description is required");
        if (!data.purposeType) validationErrors.push("Purpose type is required");
        
        // Only require subPurposeId when purposeType is PROJECT
        if (data.purposeType === 'PROJECT' && !data.subPurposeId) {
          validationErrors.push("Sub-purpose is required for PROJECT type");
        }
        
        if (!data.items?.length || data.items.some(item => !item.name?.trim())) {
          validationErrors.push("At least one item with a name is required");
        }

        if (validationErrors.length > 0) {
          validationErrors.forEach(error => {
            toast({
              title: "Validation Error",
              description: error,
              variant: "destructive"
            });
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Handle file uploads first if there are any files
      const fileAttachments = [];
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach(fileObj => {
          formData.append('files', fileObj.file);
        });

        try {
          const uploadedFiles = await uploadMutation.mutateAsync(formData);
          fileAttachments.push(...uploadedFiles);
        } catch (error) {
          console.error('File upload error:', error);
          toast({
            title: "Error",
            description: "Failed to upload files. Please try again.",
            variant: "destructive"
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Prepare request data
      const requestData = {
        data: {
          ...data,
          attachments: [...fileAttachments, ...uploadedFiles],
          items: data.items.map(item => ({
            ...item,
            quantity: Number(item.quantity || 0),
            estimatedCost: Number(item.estimatedCost || 0)
          })),
          totalEstimatedCost: Number(data.totalEstimatedCost || 0),
          freightAmount: Number(data.freightAmount || 0),
          // Only include non-null/undefined IDs
          ...(data.vendorId ? { vendorId: Number(data.vendorId) } : {}),
          ...(data.subPurposeId ? { subPurposeId: Number(data.subPurposeId) } : {}),
          additionalApprovers: data.additionalApprovers || []
        },
        action: draft ? 'draft' : 'submit'
      };

      console.log('Submitting request data:', JSON.stringify(requestData, null, 2));

      const response = await submitMutation.mutateAsync(requestData);

      if (response) {
        // Single toast notification for success - consolidated here
        toast({
          title: "Success",
          description: `Request ${draft ? "saved as draft" : "submitted"} successfully`,
        });

        if (onSubmit) {
          onSubmit(draft);
        }
      }

    } catch (error) {
      console.error('Error submitting request:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit request",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      const removed = newFiles.splice(index, 1)[0];
      if (removed.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return newFiles;
    });
  };

  const handleFileUploadComplete = (newFiles: UploadedFile[]) => {
    setUploadedFiles(prev => [...prev, ...newFiles]);
    toast({
      title: "Success",
      description: `${newFiles.length} file(s) uploaded successfully`,
    });
  };

  const FilePreview = ({ file, onPreview }: {
    file: { name: string; size: number; type: string; preview?: string; fileUrl?: string };
    onPreview?: () => void;
  }) => {
    const isImage = file.type.startsWith('image/');
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isImage ? (
              <img src={file.preview || file.fileUrl!} alt={file.name} className="w-16 h-16 object-cover rounded-md" />
            ) : (
              <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center">
                <span className="text-xs font-medium text-gray-500">
                  {file.name.split('.').pop()?.toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onPreview}
            className="ml-2"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => handleSubmitRequest(data, false))} className="space-y-6">
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="details">Request Details</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="documents" className="relative">
              Documents
              {(files.length > 0 || uploadedFiles.length > 0) && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground w-5 h-5 rounded-full text-xs flex items-center justify-center">
                  {files.length + uploadedFiles.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter request title" />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter request description"
                        className="min-h-[100px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vendorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger>
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
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-shrink-0"
                        onClick={() => setShowAddVendor(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Vendor
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purposeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select purpose type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="E3 EVENT">E3 EVENT</SelectItem>
                        <SelectItem value="PROJECT">PROJECT</SelectItem>
                        <SelectItem value="MALL">MALL</SelectItem>
                        <SelectItem value="BUSINESS GROWTH">BUSINESS GROWTH</SelectItem>
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
                    <FormLabel>Sub Purpose</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={field.value?.toString()}
                      disabled={!form.watch("purposeType") || filteredSubPurposes.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            !form.watch("purposeType")
                              ? "Select purpose type first"
                              : filteredSubPurposes.length === 0
                                ? "No sub purposes available"
                                : "Select sub purpose"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredSubPurposes.map((subPurpose) => (
                          <SelectItem
                            key={subPurpose.id}
                            value={String(subPurpose.id)}
                          >
                            {subPurpose.name}
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
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="QAR">QAR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="CNY">CNY</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Approval Flow - ONLY on details tab */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-[#7058a3] mb-4 flex items-center">
                  <span className="w-1.5 h-6 bg-[#7058a3] rounded-r mr-2"></span>
                  Approval Flow
                </h2>
              </div>

              <Card className="border-[#35bbba]/20 shadow-sm hover:shadow-md transition-all duration-200">
                <CardContent className="p-6">
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-[#7058a3] mb-2">Mandatory Approvers</h3>
                    <div className="flex flex-wrap gap-2">
                      {['CEO Office', 'Finance', 'Director'].map((dept) => (
                        <Badge
                          key={dept}
                          variant="secondary"
                          className="bg-[#7058a3]/10 text-[#7058a3] flex items-center"
                        >
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {dept}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      These departments must approve your request
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-[#7058a3] mb-2">Additional Approvers</h3>
                    <FormField
                      control={form.control}
                      name="additionalApprovers"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <DepartmentSelect
                              label=""
                              onChange={(departments: string[]) => {
                                field.onChange(departments);
                                setSelectedDepartments(departments);
                              }}
                              value={field.value || []}
                              multiple={true}
                              excludeDepartments={['CEO Office', 'Finance', 'Director']}
                              name="additionalApprovers"
                              id="additionalApprovers"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Next button for request details tab */}
            <div className="flex justify-end mt-4">
              <Button
                type="button"
                className="bg-[#7058a3] hover:bg-[#5d4a89] text-white"
                onClick={() => setActiveTab("items")}
              >
                Next: Items
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="items" className="space-y-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Items</h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const currentItems = form.getValues("items") || [];
                    form.setValue("items", [
                      ...currentItems,
                      { name: "", quantity: 1, estimatedCost: 0, description: "" }
                    ]);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {form.watch("items")?.map((item: any, index: number) => (
                <div key={index} className="flex gap-4 items-start p-4 border rounded-lg">
                  <div className="flex-1 space-y-4">
                    {/* First row: Item Name, Quantity, Cost Per Unit in a single row */}
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-6">
                        <FormField
                          control={form.control}
                          name={`items.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Item Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Item name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="col-span-3">
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  min="1"
                                  placeholder="Quantity"
                                  onChange={(e) => {
                                    field.onChange(Number(e.target.value));
                                    updateTotalCost();
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="col-span-3">
                        <FormField
                          control={form.control}
                          name={`items.${index}.estimatedCost`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cost Per Unit</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="Cost"
                                  onChange={(e) => {
                                    field.onChange(Number(e.target.value));
                                    updateTotalCost();
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    {/* Second row: Item Description */}
                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Item description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end">
                      <div className="text-sm">
                        <span className="font-medium text-muted-foreground">Item Total: </span>
                        <span className="font-semibold text-[#7058a3]">
                          {form.watch(`items.${index}.quantity`, 0) * form.watch(`items.${index}.estimatedCost`, 0)} {form.watch('currency')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const currentItems = form.getValues("items");
                      form.setValue(
                        "items",
                        currentItems.filter((_: any, i: number) => i !== index)
                      );
                      updateTotalCost();
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Freight amount ONLY on items tab */}
            <div className="pt-4 border-t">
              <FormField
                control={form.control}
                name="freightAmount"
                render={({ field }) => (
                  <FormItem className="max-w-sm ml-auto">
                    <div className="flex items-center justify-between">
                      <FormLabel>Freight Amount</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Freight Amount"
                          className="w-32"
                          onChange={(e) => {
                            field.onChange(Number(e.target.value));
                            updateTotalCost();
                          }}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4 text-right">
                <div className="text-sm font-semibold">
                  <span className="text-muted-foreground">Total Estimated Cost: </span>
                  <span className="text-[#7058a2] text-xl">
                    {form.watch('totalEstimatedCost')} {form.watch('currency')}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Navigation buttons for items tab */}
            <div className="flex justify-between mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab("details")}
              >
                Back to Details
              </Button>
              <Button
                type="button"
                className="bg-[#7058a3] hover:bg-[#5d4a89] text-white"
                onClick={() => setActiveTab("documents")}
              >
                Next: Documents
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Upload Documents</h3>
                  <FileUploadMultiple
                    onUploadComplete={handleFileUploadComplete}
                    maxFiles={5}
                    maxSizeInMB={10}
                    uploadedFiles={uploadedFiles}
                  />
                </div>

                {(files.length > 0 || uploadedFiles.length > 0) && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4">Uploaded Documents</h3>
                    <ScrollArea className="h-[400px] rounded-md border p-4">
                      <div className="grid gap-4">
                        {files.map((file, index) => (
                          <div key={`local-${index}`} className="relative group">
                            <FilePreview
                              file={{
                                name: file.file.name,
                                size: file.file.size,
                                type: file.file.type,
                                preview: file.preview,
                              }}
                              onPreview={() => {
                                setPreviewFile({
                                  fileName: file.file.name,
                                  fileSize: file.file.size,
                                  fileType: file.file.type,
                                  fileUrl: file.preview!
                                });
                                setShowPreview(true);
                              }}
                            />
                          </div>
                        ))}
                        {uploadedFiles.map((file, index) => (
                          <div key={`uploaded-${index}`} className="relative">
                            <FilePreview
                              file={{
                                name: file.fileName,
                                size: file.fileSize,
                                type: file.fileType,
                                fileUrl: file.fileUrl,
                              }}
                              onPreview={() => {
                                setPreviewFile(file);
                                setShowPreview(true);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </Card>
            
            {/* Back button for documents tab */}
            <div className="flex justify-start mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab("items")}
              >
                Back to Items
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-6 border-t mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmitRequest(form.getValues(), true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save as Draft
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#7156a2] hover:bg-[#7156a2]/90 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Submit Request
            </Button>
          </div>
        </div>
      </form>

      {showAddVendor && (
        <VendorDialog
          open={showAddVendor}
          onOpenChange={setShowAddVendor}
          onVendorCreated={(newVendor) => {
            form.setValue("vendorId", newVendor.id);
            if (onVendorCreated) {
              onVendorCreated(newVendor);
            }
          }}
        />
      )}

      {previewFile && showPreview && (
        <FilePreviewDialog
          file={previewFile}
          isOpen={showPreview}
          onClose={() => {
            setShowPreview(false);
            setPreviewFile(null);
          }}
        />
      )}
    </Form>
  );
}