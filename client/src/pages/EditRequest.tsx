import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRequest } from "@/hooks/use-request";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Plus, Trash } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  insertPurchaseRequestSchema,
  type PurchaseRequest,
} from "@db/schema";
import { updateRequest } from "@/services/requests";
import SubPurposeSelect from "@/components/SubPurposeSelect";

// Helper function to parse and format decimal numbers
const formatDecimal = (value: number | string): number => {
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(parsed)) return 0;
  return Number(parsed.toFixed(2));
};

type RequestItem = NonNullable<PurchaseRequest['items']>[number];

export default function EditRequest({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [items, setItems] = useState<RequestItem[]>([]);
  const [freightAmount, setFreightAmount] = useState<number>(0);

  const { data: request, isLoading } = useRequest(parseInt(params.id));

  // Memoize form configuration
  const defaultValues = useMemo<Partial<PurchaseRequest>>(() => ({
    title: "",
    description: "",
    items: [],
    purposeType: "E3 EVENT",
    subPurposeId: undefined,
    priority: "medium",
    currency: "QAR",
    status: "draft",
    totalEstimatedCost: 0,
    freightAmount: 0,
  }), []);

  const form = useForm<PurchaseRequest>({
    resolver: zodResolver(insertPurchaseRequestSchema),
    defaultValues,
  });

  // Initialize form with request data
  useEffect(() => {
    if (request) {
      const formattedItems = request.items?.map(item => ({
        name: item.name || "",
        quantity: formatDecimal(item.quantity || 0),
        estimatedCost: formatDecimal(item.estimatedCost || 0),
        description: item.description
      })) || [];

      if (formattedItems.length === 0) {
        formattedItems.push({
          name: "",
          quantity: 1,
          estimatedCost: 0,
          description: undefined
        });
      }

      setItems(formattedItems);
      setFreightAmount(formatDecimal(request.freightAmount || 0));

      form.reset({
        ...request,
        items: formattedItems,
        totalEstimatedCost: formatDecimal(request.totalEstimatedCost || 0),
        freightAmount: formatDecimal(request.freightAmount || 0),
      });
    }
  }, [request, form]);

  // Memoize decimal input validation
  const validateDecimalInput = useMemo(() => (value: string): boolean => {
    return /^\d*\.?\d{0,2}$/.test(value);
  }, []);

  // Memoize the total cost calculation
  const totalCost = useMemo(() => {
    const itemsTotal = items.reduce(
      (sum, item) => sum + (formatDecimal(item.quantity) * formatDecimal(item.estimatedCost)),
      0
    );
    return formatDecimal(itemsTotal + formatDecimal(freightAmount));
  }, [items, freightAmount]);

  // Memoize item update handler
  const updateItem = useCallback((index: number, field: keyof RequestItem, value: string | number) => {
    if ((field === 'quantity' || field === 'estimatedCost') && 
        typeof value === 'string' && 
        !validateDecimalInput(value)) {
      return;
    }

    setItems(prevItems => {
      const newItems = [...prevItems];
      newItems[index] = {
        ...newItems[index],
        [field]: field === "name" || field === "description" 
          ? value 
          : formatDecimal(value),
      };
      return newItems;
    });
  }, [validateDecimalInput]);

  const addItem = useCallback(() => {
    setItems(prev => [...prev, { name: "", quantity: 1, estimatedCost: 0, description: undefined }]);
  }, []);

  const removeItem = useCallback((index: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
      form.setValue('items', items.filter((_, i) => i !== index));
    }
  }, [items, form]);

  // Memoize submit handler
  const onSubmit = useCallback(async (values: PurchaseRequest) => {
    try {
      const submissionData: Partial<PurchaseRequest> = {
        ...values,
        items: items.map(item => ({
          name: item.name,
          quantity: formatDecimal(item.quantity),
          estimatedCost: formatDecimal(item.estimatedCost),
          description: item.description
        })),
        freightAmount: formatDecimal(freightAmount),
        totalEstimatedCost: totalCost,
      };

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
      console.error("Update error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update request",
        variant: "destructive",
      });
    }
  }, [items, freightAmount, totalCost, params.id, setLocation, toast]);

  const handleSubmit = useCallback(async (status: PurchaseRequest['status']) => {
    try {
      const isValid = await form.trigger();
      if (!isValid) {
        toast({
          title: "Validation Error",
          description: "Please check all required fields",
          variant: "destructive",
        });
        return;
      }

      const currentValues = form.getValues();
      await onSubmit({
        ...currentValues,
        status
      });
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        title: "Error",
        description: "Failed to submit form",
        variant: "destructive",
      });
    }
  }, [form, onSubmit, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#7156a2]/5 to-[#35bbba]/5 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Button
          variant="ghost"
          className="mb-6 group hover:bg-[#7156a2]/10 transition-all duration-200 rounded-lg"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[#7156a2] font-medium">Back to Dashboard</span>
        </Button>

        {isLoading ? (
          <Card className="border-[#35bbba]/20 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#7156a2]" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-[#35bbba]/20 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="border-b border-[#35bbba]/20 bg-gradient-to-r from-[#7156a2]/5 to-[#35bbba]/5">
              <CardTitle className="text-[#7156a2] text-2xl font-bold">
                Edit Purchase Request
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid gap-6">
              <Form {...form}>
                <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Information Section */}
                    <div className="space-y-6 p-6 bg-white rounded-xl shadow-sm border border-[#35bbba]/20 hover:border-[#35bbba]/40 transition-colors">
                      <h3 className="text-lg font-semibold text-[#7156a2] mb-4 flex items-center">
                        <span className="w-1.5 h-6 bg-[#7156a2] rounded-r mr-2"></span>
                        Basic Information
                      </h3>
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#7156a2]">Request Title</FormLabel>
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
                            <FormLabel className="text-[#7156a2]">Description</FormLabel>
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

                    {/* Request Type Section */}
                    <div className="space-y-6 p-6 bg-white rounded-xl shadow-sm border border-[#35bbba]/20 hover:border-[#35bbba]/40 transition-colors">
                      <h3 className="text-lg font-semibold text-[#7156a2] mb-4 flex items-center">
                        <span className="w-1.5 h-6 bg-[#7156a2] rounded-r mr-2"></span>
                        Request Type
                      </h3>
                      <div className="grid grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="purposeType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[#7156a2]">Purpose Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="border-[#7156a2]/20 focus:border-[#7156a2] form-focus-ring">
                                    <SelectValue placeholder="Select purpose type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="E3 EVENT">E3 EVENT</SelectItem>
                                  <SelectItem value="PROJECT">Project</SelectItem>
                                  <SelectItem value="MALL">Mall</SelectItem>
                                  <SelectItem value="BUSINESS GROWTH">Business Growth</SelectItem>
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
                              <FormLabel className="text-[#7156a2]">Priority</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="border-[#7156a2]/20 focus:border-[#7156a2] form-focus-ring">
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
                          name="subPurposeId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[#7156a2]">Sub-purpose</FormLabel>
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
                  </div>

                  {/* Items Section */}
                  <div className="space-y-6 p-6 bg-white rounded-xl shadow-sm border border-[#35bbba]/20 hover:border-[#35bbba]/40 transition-colors">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-[#7156a2] flex items-center">
                        <span className="w-1.5 h-6 bg-[#7156a2] rounded-r mr-2"></span>
                        Items
                      </h3>
                      <div className="flex items-center gap-4">
                        <FormField
                          control={form.control}
                          name="currency"
                          render={({ field }) => (
                            <FormItem>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="w-[100px] border-[#7156a2]/20 focus:border-[#7156a2] form-focus-ring">
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
                          className="flex gap-4 items-start p-4 rounded-lg border border-[#7156a2]/10 hover:border-[#7156a2]/30 transition-colors animate-fade-in"
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
                              value={item.description}
                              onChange={(e) => updateItem(index, "description", e.target.value)}
                              className="border-[#7156a2]/20 focus:border-[#7156a2] h-20 form-focus-ring"
                            />
                          </div>
                          <div className="w-24">
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, "quantity", e.target.value)}
                              className="border-[#7156a2]/20 focus:border-[#7156a2] form-focus-ring"
                            />
                          </div>
                          <div className="w-32">
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="Cost"
                              value={item.estimatedCost}
                              onChange={(e) => updateItem(index, "estimatedCost", e.target.value)}
                              className="border-[#7156a2]/20 focus:border-[#7156a2] form-focus-ring"
                            />
                          </div>
                          <div className="w-32 text-right">
                            <p className="text-sm text-[#7156a2]">
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
                        <FormLabel className="text-[#7156a2]">Freight Amount</FormLabel>
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
                        <div className="flex justify-between text-[#7156a2]">
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
                        <div className="flex justify-between text-[#7156a2]">
                          <span>Freight Amount:</span>
                          <span>{form.watch("currency")} {freightAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-[#7156a2]/20">
                          <span className="text-lg font-semibold text-[#7156a2]">
                            Total Estimated Cost:
                          </span>
                          <span className="text-lg font-bold text-[#7156a2]">
                            {form.watch("currency")} {totalCost.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
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
        )}
      </div>
    </div>
  );
}

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