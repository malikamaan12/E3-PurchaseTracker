import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPurchaseRequestSchema, type InsertSubPurpose, type Vendor } from "@db/schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { X, Upload, Loader2, Plus } from "lucide-react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";

// File validation schema with improved error messages
const fileSchema = z.object({
  name: z.string(),
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

interface PurchaseRequestFormProps {
  subPurposes: InsertSubPurpose[];
  onSubmit?: (draft?: boolean) => void;
  onCancel?: () => void;
  initialData?: any;
  vendors?: Vendor[];
}

export default function PurchaseRequestForm({
  subPurposes,
  onSubmit,
  onCancel,
  initialData,
  vendors = []
}: PurchaseRequestFormProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { saveDraft, submitRequest } = usePurchaseRequests();

  const form = useForm({
    resolver: zodResolver(insertPurchaseRequestSchema),
    defaultValues: initialData || {
      title: "",
      description: "",
      items: [],
      purposeType: "E3 EVENT",
      priority: "medium",
      currency: "QAR",
      totalEstimatedCost: 0,
      freightAmount: 0,
      vendorId: undefined,
      subPurposeId: undefined
    }
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);

    try {
      // Validate each file
      await Promise.all(
        selectedFiles.map(async (file) => {
          try {
            await fileSchema.parseAsync({
              name: file.name,
              size: file.size,
              type: file.type
            });
          } catch (error) {
            if (error instanceof z.ZodError) {
              throw new Error(`${file.name}: ${error.errors[0].message}`);
            }
            throw error;
          }
        })
      );

      // Create preview for images
      const filesWithPreviews = await Promise.all(
        selectedFiles.map(async (file) => {
          const fileWithPreview: FileWithPreview = { file };
          if (file.type.startsWith('image/')) {
            fileWithPreview.preview = URL.createObjectURL(file);
          }
          return fileWithPreview;
        })
      );

      setFiles((prev) => [...prev, ...filesWithPreviews]);
    } catch (error) {
      toast({
        title: "Error adding file",
        description: error instanceof Error ? error.message : "Failed to add file",
        variant: "destructive"
      });
    }

    // Clear the input value to allow uploading the same file again
    event.target.value = '';
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

  // Calculate total cost
  const calculateTotalCost = (items: any[], freightAmount: number) => {
    const itemsTotal = items.reduce(
      (sum, item) => sum + (item.quantity * item.estimatedCost),
      0
    );
    return itemsTotal + freightAmount;
  };

  // Update total cost when items or freight amount changes
  const updateTotalCost = () => {
    const items = form.getValues("items");
    const freightAmount = form.getValues("freightAmount") || 0;
    const total = calculateTotalCost(items, freightAmount);
    form.setValue("totalEstimatedCost", total);
  };

  const handleSubmitRequest = async (data: z.infer<typeof insertPurchaseRequestSchema>, draft: boolean = false) => {
    try {
      setUploading(true);

      // Create FormData for file upload
      const formData = new FormData();
      files.forEach((fileObj) => {
        formData.append(`files`, fileObj.file);
      });

      // Upload files first
      const uploadResponse = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload files');
      }

      const uploadedFiles = await uploadResponse.json();

      // Add file data to request data
      const requestData = {
        ...data,
        attachments: uploadedFiles,
        status: draft ? 'draft' : 'pending'
      };

      // Save request
      if (draft) {
        await saveDraft(requestData);
      } else {
        await submitRequest(requestData);
      }

      onSubmit?.(draft);

      toast({
        title: "Success",
        description: `Request ${draft ? 'saved as draft' : 'submitted'} successfully`,
      });
    } catch (error) {
      console.error('Error submitting request:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit request",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => handleSubmitRequest(data, false))} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          {/* Title */}
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

          {/* Description */}
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

        {/* Vendor and Purpose Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vendor Selection */}
          <FormField
            control={form.control}
            name="vendorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vendor</FormLabel>
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
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Purpose Type */}
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

          {/* Priority */}
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

          {/* Currency */}
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

          {form.watch("items")?.map((item, index) => (
            <div key={index} className="flex gap-4 items-start p-4 border rounded-lg">
              <div className="flex-1 space-y-4">
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

                <div className="grid grid-cols-2 gap-4">
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

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  const currentItems = form.getValues("items") || [];
                  form.setValue("items", currentItems.filter((_, i) => i !== index));
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
                    disabled={uploading}
                  />
                </label>
              </CardContent>
            </Card>

            {/* File Preview List */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {file.preview ? (
                        <img
                          src={file.preview}
                          alt="preview"
                          className="w-10 h-10 object-cover rounded-md"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-500">
                            {file.file.name.split('.').pop()?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(file.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
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
              <FormLabel>Freight Amount</FormLabel>
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
                />
              </FormControl>
              <FormMessage />
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

        {/* Form Actions */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 mt-8">
          {onCancel && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              className="w-full sm:w-auto order-3 sm:order-1"
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => form.handleSubmit((data) => handleSubmitRequest(data, true))()}
            disabled={uploading}
            className="w-full sm:w-auto order-2"
          >
            Save as Draft
          </Button>
          <Button 
            type="submit" 
            disabled={uploading}
            className="w-full sm:w-auto order-1 sm:order-3"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              'Submit Request'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}