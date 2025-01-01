import { useState, useEffect, useCallback } from "react";
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
import { X, Upload, Loader2, Plus, AlertTriangle, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { analyzeFormError, useErrorHandler } from "@/lib/debugUtils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import FilePreviewCarousel from "@/components/FilePreviewCarousel";

// File validation schema
const fileSchema = z.object({
  name: z.string().min(1, "File name is required"),
  size: z.number().max(5 * 1024 * 1024, "File must be smaller than 5MB"),
  type: z.string().refine(
    (type) => [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ].includes(type),
    "Only PDF, Word documents, and images (JPEG, PNG) are allowed"
  )
});

type FileWithPreview = {
  file: File;
  preview?: string;
};

interface FileWithMetadata extends FileWithPreview {
  id?: number;
  fileName?: string;
  fileType?: string;
  fileUrl?: string;
}

interface PurchaseRequestFormProps {
  subPurposes: InsertSubPurpose[];
  vendors: Vendor[];
  onSubmit?: (requestId: number, draft?: boolean) => void;
  onCancel?: () => void;
  initialData?: any;
}

const FilePreview = ({ file }: { file: FileWithMetadata }) => {
  return (
    <div className="flex flex-col gap-2 p-4 border rounded-lg bg-white">
      {file.preview || (file.fileType?.startsWith('image/') && file.fileUrl) ? (
        <img
          src={file.preview || file.fileUrl}
          alt={file.fileName || file.file?.name}
          className="w-full h-48 object-contain rounded-md"
        />
      ) : (
        <div className="w-full h-48 flex items-center justify-center bg-gray-50 rounded-md">
          <span className="text-lg font-medium text-gray-500">
            {file.fileName?.split('.').pop()?.toUpperCase() || file.file?.name.split('.').pop()?.toUpperCase()}
          </span>
        </div>
      )}
      <p className="text-sm font-medium truncate">{file.fileName || file.file?.name}</p>
      <p className="text-xs text-gray-500">
        {file.file ? `${(file.file.size / 1024 / 1024).toFixed(2)} MB` : ''}
      </p>
    </div>
  );
};

export default function PurchaseRequestForm({
  subPurposes = [],
  vendors = [],
  onSubmit,
  onCancel,
  initialData
}: PurchaseRequestFormProps) {
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [filteredSubPurposes, setFilteredSubPurposes] = useState<InsertSubPurpose[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileWithMetadata[]>([]);
  const handleError = useErrorHandler();

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
      vendorId: undefined
    }
  });

  // Filter sub-purposes based on selected purpose type
  useEffect(() => {
    const purposeType = form.watch("purposeType");
    if (purposeType) {
      const filtered = subPurposes.filter(sp => sp.purpose_type === purposeType);
      setFilteredSubPurposes(filtered);

      // Reset sub-purpose if not valid for new purpose type
      const currentSubPurposeId = form.watch("subPurposeId");
      if (currentSubPurposeId && !filtered.some(sp => sp.id === currentSubPurposeId)) {
        form.setValue("subPurposeId", undefined);
      }
    } else {
      setFilteredSubPurposes([]);
    }
  }, [form.watch("purposeType"), subPurposes]);

  // Enhanced submit mutation with intelligent error handling
  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Submitting data:', data);
      try {
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
      } catch (error) {
        handleError(error, 'Request Submission');
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Request submitted successfully",
        variant: "default",
        duration: 3000,
      });

      if (data?.id) {
        onSubmit?.(data.id, false);
      }
    }
  });

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      try {
        const response = await fetch('/api/attachments', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to upload files: ${await response.text()}`);
        }

        return response.json();
      } catch (error) {
        handleError(error, 'File Upload');
        throw error;
      }
    }
  });

  // Calculate total cost
  const calculateTotalCost = useCallback((items: any[], freightAmount: number) => {
    const itemsTotal = items.reduce(
      (sum, item) => sum + (Number(item.quantity || 0) * Number(item.estimatedCost || 0)),
      0
    );
    return itemsTotal + Number(freightAmount || 0);
  }, []);

  // Update total cost
  const updateTotalCost = useCallback(() => {
    const items = form.getValues("items") || [];
    const freightAmount = form.getValues("freightAmount") || 0;
    const total = calculateTotalCost(items, freightAmount);
    form.setValue("totalEstimatedCost", total);
  }, [form, calculateTotalCost]);

  const handleSubmitRequest = async (data: z.infer<typeof insertPurchaseRequestSchema>, draft: boolean = false) => {
    try {
      console.log('Form data before submission:', data);

      // Client-side validation for non-draft submissions
      if (!draft) {
        const validationErrors = [];
        if (!data.vendorId) validationErrors.push("Please select a vendor");
        if (!data.title?.trim()) validationErrors.push("Title is required");
        if (!data.description?.trim()) validationErrors.push("Description is required");
        if (!data.purposeType) validationErrors.push("Purpose type is required");
        if (!data.subPurposeId) validationErrors.push("Sub purpose is required");
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
          return;
        }
      }

      // Handle file uploads if any
      let attachments = [];
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach(fileObj => {
          if (fileObj.file) {
            formData.append('files', fileObj.file);
          }
        });

        try {
          const uploadResponse = await uploadMutation.mutateAsync(formData);
          if (Array.isArray(uploadResponse)) {
            attachments = uploadResponse;
          } else {
            console.error('Invalid upload response:', uploadResponse);
            throw new Error('Failed to upload files');
          }
        } catch (error) {
          console.error('File upload error:', error);
          handleError(error, 'File Upload');
          return;
        }
      }

      // Prepare request data with proper number conversions
      const requestData = {
        data: {
          ...data,
          attachments,
          items: data.items.map(item => ({
            ...item,
            quantity: Number(item.quantity),
            estimatedCost: Number(item.estimatedCost)
          })),
          totalEstimatedCost: Number(data.totalEstimatedCost),
          freightAmount: Number(data.freightAmount || 0),
          vendorId: Number(data.vendorId)
        },
        action: draft ? 'draft' : 'submit'
      };

      console.log('Submitting request data:', JSON.stringify(requestData, null, 2));
      const response = await submitMutation.mutateAsync(requestData);

      if (response?.id) {
        toast({
          title: "Success",
          description: `Request ${draft ? 'saved as draft' : 'submitted'} successfully`,
          variant: "default"
        });
        onSubmit?.(response.id, draft);
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      handleError(error, 'Form Submission');
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const selectedFiles = Array.from(event.target.files || []);

      // Validate each file
      await Promise.all(selectedFiles.map(async (file) => {
        try {
          await fileSchema.parseAsync({
            name: file.name,
            size: file.size,
            type: file.type
          });
        } catch (error) {
          throw new Error(`${file.name}: ${error instanceof z.ZodError ? error.errors[0].message : 'Invalid file'}`);
        }
      }));

      // Create previews for images
      const filesWithPreviews = await Promise.all(
        selectedFiles.map(async (file) => {
          const fileWithPreview: FileWithMetadata = { file };
          if (file.type.startsWith('image/')) {
            fileWithPreview.preview = URL.createObjectURL(file);
          }
          return fileWithPreview;
        })
      );

      setFiles(prev => [...prev, ...filesWithPreviews]);
    } catch (error) {
      toast({
        title: "Error adding file",
        description: error instanceof Error ? error.message : "Failed to add file",
        variant: "destructive"
      });
    }

    // Clear input value to allow uploading the same file again
    event.target.value = '';
  };


  useEffect(() => {
    if (initialData?.attachments) {
      setFiles(initialData.attachments.map((attachment: any) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        fileUrl: `/api/attachments/${attachment.id}`,
        preview: attachment.fileType.startsWith('image/') ? `/api/attachments/${attachment.id}` : undefined,
        file: new File([], attachment.fileName) // Dummy file for size/type
      })));
    }
  }, [initialData]);

  const handlePreviewFiles = (files: FileWithMetadata[]) => {
    setSelectedFiles(files);
    setPreviewOpen(true);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => handleSubmitRequest(data, false))} className="space-y-6">
        {/* Back Button */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="text-[#7058a3] hover:text-[#3eb6ba] transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Basic Information */}
        <div className="space-y-4">
          {/* Title */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#7058a3] font-medium">Title</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Enter request title"
                    className="border-[#7058a3]/20 focus:border-[#3eb6ba] focus:ring-[#3eb6ba]"
                  />
                </FormControl>
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#7058a3] font-medium">Description</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Enter request description"
                    className="min-h-[100px] border-[#7058a3]/20 focus:border-[#3eb6ba] focus:ring-[#3eb6ba]"
                  />
                </FormControl>
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />
        </div>

        {/* Vendor and Purpose Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vendor Selection */}
          <FormField
            control={form.control}
            name="vendorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#7058a3] font-medium">Vendor</FormLabel>
                <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
                  <FormControl>
                    <SelectTrigger className="border-[#7058a3]/20 focus:ring-[#3eb6ba]">
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
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />

          {/* Purpose Type */}
          <FormField
            control={form.control}
            name="purposeType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#7058a3] font-medium">Purpose Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="border-[#7058a3]/20 focus:ring-[#3eb6ba]">
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
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />
          {/* Sub Purpose */}
          <FormField
            control={form.control}
            name="subPurposeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#7058a3] font-medium">Sub Purpose</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(Number(value))}
                  value={field.value?.toString()}
                  disabled={!form.watch("purposeType") || filteredSubPurposes.length === 0}
                >
                  <FormControl>
                    <SelectTrigger className="border-[#7058a3]/20 focus:ring-[#3eb6ba]">
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
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />

          {/* Priority */}
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#7058a3] font-medium">Priority</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="border-[#7058a3]/20 focus:ring-[#3eb6ba]">
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
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />

          {/* Currency */}
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#7058a3] font-medium">Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="border-[#7058a3]/20 focus:ring-[#3eb6ba]">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="QAR">QAR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />
        </div>

        {/* Items Section */}
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
                <FormField
                  control={form.control}
                  name={`items.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#7058a3] font-medium">Item Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Item name" className="border-[#7058a3]/20 focus:border-[#3eb6ba] focus:ring-[#3eb6ba]" />
                      </FormControl>
                      <FormMessage className="text-red-500" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`items.${index}.description`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#7058a3] font-medium">Item Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Item description" className="border-[#7058a3]/20 focus:border-[#3eb6ba] focus:ring-[#3eb6ba]" />
                      </FormControl>
                      <FormMessage className="text-red-500" />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#7058a3] font-medium">Quantity</FormLabel>
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
                            className="border-[#7058a3]/20 focus:border-[#3eb6ba] focus:ring-[#3eb6ba]"
                          />
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`items.${index}.estimatedCost`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#7058a3] font-medium">Cost Per Unit</FormLabel>
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
                            className="border-[#7058a3]/20 focus:border-[#3eb6ba] focus:ring-[#3eb6ba]"
                          />
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />
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

        {/* File Upload Section */}
        <div className="space-y-4">
          <FormLabel className="block text-lg font-medium">Attachments</FormLabel>
          <div className="grid gap-4">
            <Card className="relative overflow-hidden">
              <CardContent className="p-4">
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors duration-200 ease-in-out">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                    <Upload className="w-12 h-12 mb-3 text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500 sm:text-base">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 sm:text-sm">
                      PDF, Word documents, or images up to 5MB
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    disabled={submitMutation.isPending || uploadMutation.isPending}
                  />
                </label>
              </CardContent>
            </Card>

            {/* File Preview Grid */}
            {files.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {files.map((file, index) => (
                  <div key={index} className="relative">
                    <FilePreview file={file} />
                    {!file.id && ( // Only show remove button for new files
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeFile(index)}
                        disabled={submitMutation.isPending || uploadMutation.isPending}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Freight Amount */}
        <FormField
          control={form.control}
          name="freightAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[#7058a3] font-medium">Freight Amount</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter freight amount"
                  onChange={(e) => {
                    field.onChange(Number(e.target.value));
                    updateTotalCost();
                  }}
                  className="border-[#7058a3]/20 focus:border-[#3eb6ba] focus:ring-[#3eb6ba]"
                />
              </FormControl>
              <FormMessage className="text-red-500" />
            </FormItem>
          )}
        />

        {/* Total Cost Display */}
        <div className="pt-4 border-t">
          <p className="text-lg font-semibold">
            Total Estimated Cost:{" "}
            <span className="text-green-600">
              {form.watch("currency")} {form.watch("totalEstimatedCost").toFixed(2)}
            </span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 mt-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSubmitRequest(form.getValues(), true)}
            disabled={submitMutation.isPending}
            className="border-[#7058a3] text-[#7058a3] hover:bg-[#7058a3]/10"
          >
            {submitMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save as Draft
          </Button>
          <Button
            type="submit"
            disabled={submitMutation.isPending}
            className="bg-[#3eb6ba] hover:bg-[#3eb6ba]/90 text-white"
          >
            {submitMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Submit Request
          </Button>
        </div>
      </form>

      {/* File Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <FilePreviewCarousel
            files={selectedFiles}
            onClose={() => setPreviewOpen(false)}
            onBack={() => setSelectedFiles([])}
          />
        </DialogContent>
      </Dialog>
    </Form>
  );
}