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
import DepartmentSelect from "@/components/DepartmentSelect";
import SubPurposeSelect from "@/components/SubPurposeSelect";
import VendorSelect from "@/components/VendorSelect";
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
import { analyzeFormError } from "@/lib/debugUtils";

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

export default function NewRequest() {
  const [, setLocation] = useLocation();
  const { createRequest } = usePurchaseRequests();
  const { toast } = useToast();
  const [items, setItems] = useState([{ name: "", quantity: 1, estimatedCost: 0 }]);
  const [freightAmount, setFreightAmount] = useState(0);

  const form = useForm<NewPurchaseRequest>({
    resolver: zodResolver(insertPurchaseRequestSchema),
    defaultValues: {
      title: "",
      description: "",
      items: [{ name: "", quantity: 1, estimatedCost: 0 }],
      vendorId: undefined,
      purpose: "",
      purposeType: "event",
      subPurposeId: undefined,
      priority: "medium",
      currency: "QAR",
      status: "draft",
      totalEstimatedCost: 0,
      freightAmount: 0,
    },
  });

  useEffect(() => {
    const totalCost = calculateTotalCost();
    form.setValue('items', items);
    form.setValue('freightAmount', freightAmount);
    form.setValue('totalEstimatedCost', totalCost);
  }, [items, freightAmount]);

  const calculateTotalCost = () => {
    const itemsTotal = items.reduce(
      (sum, item) => sum + (item.quantity * item.estimatedCost),
      0
    );
    return itemsTotal + freightAmount;
  };

  const onSubmit = async (values: NewPurchaseRequest) => {
    try {
      // Validate vendor
      if (!values.vendorId) {
        toast({
          title: "Error",
          description: "Please select a vendor",
          variant: "destructive",
        });
        return;
      }

      // Validate items
      if (items.some((item) => !item.name)) {
        toast({
          title: "Error",
          description: "All items must have a name",
          variant: "destructive",
        });
        return;
      }

      // Format the data with proper number conversions
      const formattedData = {
        ...values,
        items: items.map(item => ({
          name: item.name,
          quantity: Number(item.quantity),
          estimatedCost: Number(item.estimatedCost)
        })),
        freightAmount: Number(freightAmount),
        totalEstimatedCost: calculateTotalCost(),
        vendorId: Number(values.vendorId)
      };

      console.log('Submitting form data:', formattedData);

      try {
        await createRequest(formattedData);
        toast({
          title: "Success",
          description: "Request created successfully",
        });
        setLocation("/");
      } catch (error: any) {
        console.error("Create request error:", error);
        // Use Anthropic to analyze the error
        const analysis = await analyzeFormError(formattedData, error);
        console.log('Form error analysis:', analysis);

        toast({
          title: "Error",
          description: error.message || "Failed to create request",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Form submission error:", error);
      const analysis = await analyzeFormError(values, error);
      console.log('Validation error analysis:', analysis);

      const errors = form.formState.errors;
      console.log('Form validation errors:', errors);

      const errorMessages = Object.entries(errors)
        .map(([field, error]) => `${field}: ${error?.message}`)
        .join('\n');

      toast({
        title: "Validation Error",
        description: errorMessages || "Please check all required fields",
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

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: field === 'quantity' || field === 'estimatedCost' ? Number(value) : value,
    };
    setItems(newItems);
  };

  const handleSubmit = async (status: "draft" | "pending") => {
    try {
      form.setValue("status", status);
      const isValid = await form.trigger();
      if (!isValid) {
        const errors = form.formState.errors;
        console.log('Form validation errors on submit:', errors);

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

      await form.handleSubmit(onSubmit)();
    } catch (error) {
      console.error("Submit error:", error);
      toast({
        title: "Error",
        description: "Failed to submit form. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <Button variant="ghost" className="mb-4" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Create New Purchase Request</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Request Title</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <h3 className="text-lg font-medium mb-4">Items</h3>
                  <div className="space-y-4">
                    {items.map((item, index) => (
                      <div key={index} className="flex gap-4 items-start">
                        <div className="flex-1">
                          <Input
                            placeholder="Item name"
                            value={item.name}
                            onChange={(e) =>
                              updateItem(index, "name", e.target.value)
                            }
                          />
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(index, "quantity", e.target.value)
                            }
                          />
                        </div>
                        <div className="w-32">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Cost"
                            value={item.estimatedCost}
                            onChange={(e) =>
                              updateItem(index, "estimatedCost", e.target.value)
                            }
                          />
                        </div>
                        <div className="w-32 text-right">
                          <p className="text-sm text-gray-600">
                            Total: {(item.quantity * item.estimatedCost).toFixed(2)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addItem}
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>

                  <div className="mt-4 space-y-4">
                    <FormItem>
                      <FormLabel>Freight Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={freightAmount}
                          onChange={(e) =>
                            setFreightAmount(Number(e.target.value))
                          }
                        />
                      </FormControl>
                    </FormItem>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between font-medium">
                        <span>Items Total:</span>
                        <span>
                          {items
                            .reduce(
                              (sum, item) =>
                                sum + item.quantity * item.estimatedCost,
                              0
                            )
                            .toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between mt-2">
                        <span>Freight Amount:</span>
                        <span>{freightAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between mt-2 text-lg font-bold border-t pt-2">
                        <span>Total Estimated Cost:</span>
                        <span>{calculateTotalCost().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="vendorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor</FormLabel>
                      <FormControl>
                        <VendorSelect
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
                  name="purposeType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purpose Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select purpose type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="project">Project</SelectItem>
                          <SelectItem value="mall">Mall</SelectItem>
                          <SelectItem value="business_growth">
                            Business Growth
                          </SelectItem>
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
                      <FormLabel>Sub-purpose</FormLabel>
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
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purpose Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
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
                      <FormLabel>Priority</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
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

                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DepartmentSelect
                  label="Additional Approvers"
                  onChange={() => {}}
                  multiple
                />

                <div className="flex justify-between pt-6">
                  <Button
                    type="button"
                    onClick={() => handleSubmit("draft")}
                    variant="outline"
                  >
                    Save as Draft
                  </Button>
                  <Button type="button" onClick={() => handleSubmit("pending")}>
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