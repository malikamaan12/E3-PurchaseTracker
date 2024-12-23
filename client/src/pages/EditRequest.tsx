import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePurchaseRequests } from "@/hooks/use-purchase-requests";
import { useToast } from "@/hooks/use-toast";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DepartmentSelect from "@/components/DepartmentSelect";
import SubPurposeSelect from "@/components/SubPurposeSelect";
import { insertPurchaseRequestSchema } from "@db/schema";
import { ArrowLeft, Plus, Trash } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NewPurchaseRequest } from "@db/schema";
import type { PurchaseRequest } from "@db/schema";
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

export default function EditRequest({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const { updateRequest } = usePurchaseRequests();
  const { toast } = useToast();
  const [items, setItems] = useState([{ name: "", quantity: 1, estimatedCost: 0 }]);
  const [freightAmount, setFreightAmount] = useState(0);

  // Fetch the request data
  const { data: request, isLoading } = useQuery<PurchaseRequest>({
    queryKey: [`/api/requests/${params.id}`],
    enabled: !!params.id,
  });

  const form = useForm<NewPurchaseRequest>({
    resolver: zodResolver(insertPurchaseRequestSchema),
    defaultValues: {
      title: "",
      description: "",
      items: [{ name: "", quantity: 1, estimatedCost: 0 }],
      companyName: "",
      contactPerson: "",
      contactNumber: "",
      accountNumber: "",
      purpose: "",
      purposeType: "event",
      subPurposeId: undefined,
      priority: "medium",
      currency: "QAR",
      status: "draft",
      totalEstimatedCost: "0",
      freightAmount: "0",
    },
  });

  // Effect to populate form data when request is loaded
  useEffect(() => {
    if (request) {
      console.log("Loading request data:", request);

      // Ensure items array is properly formatted
      const formattedItems = Array.isArray(request.items) ? request.items.map(item => ({
        name: item.name || "",
        quantity: Number(item.quantity) || 1,
        estimatedCost: Number(item.estimatedCost) || 0
      })) : [{ name: "", quantity: 1, estimatedCost: 0 }];

      // Set the form values
      form.reset({
        title: request.title || "",
        description: request.description || "",
        items: formattedItems,
        companyName: request.companyName || "",
        contactPerson: request.contactPerson || "",
        contactNumber: request.contactNumber || "",
        accountNumber: request.accountNumber || "",
        purpose: request.purpose || "",
        purposeType: request.purposeType || "event",
        subPurposeId: request.subPurposeId,
        priority: request.priority || "medium",
        currency: request.currency || "QAR",
        status: request.status || "draft",
        totalEstimatedCost: request.totalEstimatedCost?.toString() || "0",
        freightAmount: request.freightAmount?.toString() || "0",
      });

      // Set the items state
      setItems(formattedItems);

      // Set freight amount
      setFreightAmount(Number(request.freightAmount) || 0);
    }
  }, [request, form]);

  const calculateTotalCost = () => {
    const itemsTotal = items.reduce(
      (sum, item) => sum + (Number(item.quantity) * Number(item.estimatedCost)),
      0
    );
    return itemsTotal + freightAmount;
  };

  const onSubmit = async (values: NewPurchaseRequest) => {
    try {
      const submissionData = {
        ...values,
        items: items.map((item) => ({
          name: item.name,
          quantity: Number(item.quantity),
          estimatedCost: Number(item.estimatedCost),
        })),
        freightAmount: freightAmount.toString(),
        totalEstimatedCost: calculateTotalCost().toString(),
      };

      console.log("Submitting request with data:", submissionData);

      try {
        await updateRequest({
          id: parseInt(params.id),
          data: submissionData,
        });
        toast({
          title: "Success",
          description: "Request updated successfully",
        });
        setLocation("/");
      } catch (error: any) {
        console.error("Update request error:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to update request",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Form validation error:", error);
      toast({
        title: "Validation Error",
        description: "Please check all required fields",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (status: "draft" | "pending") => {
    try {
      form.setValue("status", status);
      const isValid = await form.trigger();
      if (!isValid) {
        const errors = form.formState.errors;
        console.error("Form validation errors:", errors);
        toast({
          title: "Validation Error",
          description: "Please check all required fields and try again",
          variant: "destructive",
        });
        return;
      }

      await form.handleSubmit(onSubmit)();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        title: "Error",
        description: "Failed to submit form. Please check your input and try again.",
        variant: "destructive",
      });
    }
  };

  const addItem = () => {
    setItems([...items, { name: "", quantity: 1, estimatedCost: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
    }
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: field === "name" ? value : Number(value),
    };
    setItems(newItems);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-center">
                <p>Loading request data...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#7156a2]/5 to-[#35bbba]/5 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Button
          variant="ghost"
          className="mb-4 hover:bg-[#7156a2]/10 transition-colors"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="border-[#35bbba]/20 shadow-lg">
          <CardHeader className="border-b border-[#35bbba]/20 bg-gradient-to-r from-[#7156a2]/5 to-[#35bbba]/5">
            <CardTitle className="text-[#191160] text-2xl font-semibold">
              Edit Purchase Request
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
                {/* Purpose Type, Sub-purpose, and Priority Section */}
                <div className="space-y-6 p-6 bg-white rounded-lg shadow-sm border border-[#35bbba]/20">
                  <h3 className="text-lg font-semibold text-[#191160] mb-4">Request Type</h3>
                  <div className="grid grid-cols-2 gap-6">
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
                              <SelectItem value="event">Event</SelectItem>
                              <SelectItem value="project">Project</SelectItem>
                              <SelectItem value="mall">Mall</SelectItem>
                              <SelectItem value="business_growth">Business Growth</SelectItem>
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
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#191160]">Priority</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="border-[#7156a2]/20 focus:border-[#7156a2]">
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {priorities.map(({ label, value }) => (
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
                  </div>
                </div>

                {/* Basic Information Section */}
                <div className="space-y-6 p-6 bg-white rounded-lg shadow-sm border border-[#35bbba]/20">
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
                            className="border-[#7156a2]/20 focus:border-[#7156a2] transition-colors"
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
                            className="border-[#7156a2]/20 focus:border-[#7156a2] transition-colors"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Items Section with Currency */}
                <div className="space-y-6 p-6 bg-white rounded-lg shadow-sm border border-[#35bbba]/20">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-[#191160]">Items</h3>
                    <div className="flex items-center gap-4">
                      <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2">
                            <FormLabel className="text-[#191160] whitespace-nowrap mb-0">Currency:</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="w-[100px] border-[#7156a2]/20 focus:border-[#7156a2]">
                                  <SelectValue />
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
                        className="border-[#35bbba] text-[#35bbba] hover:bg-[#35bbba]/10 transition-colors"
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
                        className="flex gap-4 items-start p-4 rounded-lg border border-[#7156a2]/10 hover:border-[#7156a2]/30 transition-colors"
                      >
                        <div className="flex-1">
                          <Input
                            placeholder="Item name"
                            value={item.name}
                            onChange={(e) => updateItem(index, "name", e.target.value)}
                            className="border-[#7156a2]/20 focus:border-[#7156a2]"
                          />
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", e.target.value)}
                            className="border-[#7156a2]/20 focus:border-[#7156a2]"
                          />
                        </div>
                        <div className="w-32">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Cost"
                            value={item.estimatedCost}
                            onChange={(e) => updateItem(index, "estimatedCost", e.target.value)}
                            className="border-[#7156a2]/20 focus:border-[#7156a2]"
                          />
                        </div>
                        <div className="w-32 text-right">
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
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
                          className="border-[#7156a2]/20 focus:border-[#7156a2]"
                        />
                      </FormControl>
                    </FormItem>

                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-[#191160]">
                        <span>Items Total:</span>
                        <span className="font-medium">
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

                {/* Vendor Information Section */}
                <div className="space-y-6 p-6 bg-white rounded-lg shadow-sm border border-[#35bbba]/20">
                  <h3 className="text-lg font-semibold text-[#191160] mb-4">Vendor Information</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#191160]">Company Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter company name"
                              className="border-[#7156a2]/20 focus:border-[#7156a2]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contactPerson"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#191160]">Contact Person</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter contact person name"
                              className="border-[#7156a2]/20 focus:border-[#7156a2]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contactNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#191160]">Contact Number</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="tel"
                              placeholder="Enter contact number"
                              className="border-[#7156a2]/20 focus:border-[#7156a2]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="accountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#191160]">Account Details</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter account number"
                              className="border-[#7156a2]/20 focus:border-[#7156a2]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-6">
                  <Button
                    type="button"
                    onClick={() => handleSubmit("draft")}
                    variant="outline"
                    className="border-[#35bbba] text-[#35bbba] hover:bg-[#35bbba]/10 transition-colors"
                  >
                    Save as Draft
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSubmit("pending")}
                    className="bg-[#7156a2] hover:bg-[#7156a2]/90 text-white transition-colors"
                  >
                    Submit for Approval
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Placeholder for analyzeFormError function.  This needs to be defined elsewhere in your project.
const analyzeFormError = async (values: any, errors: any) => {
    // Your implementation to analyze form errors here.
    return "";
}