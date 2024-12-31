import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Loader2, X } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseRequest, Vendor } from "@db/schema";

// Form schema based on database schema
const formSchema = z.object({
  title: z.string()
    .min(1, "Title is required")
    .max(100, "Title cannot exceed 100 characters"),
  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description cannot exceed 500 characters"),
  vendorId: z.number({
    required_error: "Please select a vendor",
    invalid_type_error: "Please select a valid vendor",
  }),
  purposeType: z.enum(["E3 EVENT", "PROJECT", "MALL", "BUSINESS GROWTH"], {
    required_error: "Purpose type is required",
  }),
  items: z.array(z.object({
    name: z.string().min(1, "Item name is required"),
    quantity: z.number().positive("Quantity must be greater than 0"),
    estimatedCost: z.number().min(0, "Cost cannot be negative"),
    description: z.string().optional(),
  })).min(1, "At least one item is required"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  currency: z.enum(["QAR", "USD", "CNY"]).default("QAR"),
  totalEstimatedCost: z.number().min(0),
  freightAmount: z.number().min(0).default(0),
});

type FormData = z.infer<typeof formSchema>;

export default function NewPurchaseRequestForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with default values
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      items: [],
      priority: "medium",
      currency: "QAR",
      freightAmount: 0,
      totalEstimatedCost: 0,
    },
  });

  // Fetch vendors
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  // Add new item to the items array
  const addItem = () => {
    const currentItems = form.getValues("items") || [];
    form.setValue("items", [
      ...currentItems,
      { name: "", quantity: 1, estimatedCost: 0 },
    ]);
  };

  // Remove item from the items array
  const removeItem = (index: number) => {
    const currentItems = form.getValues("items") || [];
    form.setValue("items", currentItems.filter((_, i) => i !== index));
  };

  // Calculate total cost
  const calculateTotalCost = (items: FormData["items"], freightAmount: number) => {
    const itemsTotal = items.reduce(
      (sum, item) => sum + item.quantity * item.estimatedCost,
      0
    );
    return itemsTotal + freightAmount;
  };

  // Handle form submission
  const onSubmit = async (data: FormData, action: "draft" | "submit") => {
    try {
      setIsSubmitting(true);

      const formattedData = {
        ...data,
        status: action === "draft" ? "draft" : "pending",
        isLocked: action !== "draft",
        totalEstimatedCost: calculateTotalCost(data.items, data.freightAmount),
      };

      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          data: formattedData,
          action 
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create request");
      }

      const result = await response.json();

      toast({
        title: "Success",
        description: `Request ${result.requestNumber} ${
          action === "draft" ? "saved as draft" : "submitted"
        } successfully`,
      });

      // Redirect to the dashboard
      setLocation("/");
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#7156a2]/5 to-[#35bbba]/5 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Form {...form}>
          <form className="space-y-8 bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-[#191160] mb-6">
              New Purchase Request
            </h1>

            {/* Basic Information */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} className="border-[#7156a2]/20" />
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
                      <Textarea {...field} className="border-[#7156a2]/20" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vendorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger className="border-[#7156a2]/20">
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vendors.map((vendor) => (
                          <SelectItem
                            key={vendor.id}
                            value={vendor.id.toString()}
                          >
                            {vendor.companyName}
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
                name="purposeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="border-[#7156a2]/20">
                          <SelectValue placeholder="Select purpose type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["E3 EVENT", "PROJECT", "MALL", "BUSINESS GROWTH"].map(
                          (type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          )
                        )}
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
                <h2 className="text-lg font-semibold text-[#191160]">Items</h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addItem}
                  className="border-[#7156a2] text-[#7156a2]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {form.watch("items")?.map((item, index) => (
                <div
                  key={index}
                  className="flex gap-4 items-start p-4 border border-[#7156a2]/20 rounded-lg"
                >
                  <div className="flex-1 space-y-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Item name"
                              className="border-[#7156a2]/20"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                min="1"
                                placeholder="Quantity"
                                className="border-[#7156a2]/20"
                                onChange={(e) =>
                                  field.onChange(Number(e.target.value))
                                }
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
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Cost"
                                className="border-[#7156a2]/20"
                                onChange={(e) =>
                                  field.onChange(Number(e.target.value))
                                }
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
                    onClick={() => removeItem(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-6">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => form.handleSubmit((data) => onSubmit(data, "draft"))()}
                className="border-[#35bbba] text-[#35bbba]"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  "Save as Draft"
                )}
              </Button>

              <Button
                type="button"
                disabled={isSubmitting}
                onClick={() => form.handleSubmit((data) => onSubmit(data, "submit"))()}
                className="bg-[#7156a2] hover:bg-[#7156a2]/90 text-white"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  "Submit Request"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}