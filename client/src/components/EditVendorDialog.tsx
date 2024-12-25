import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Vendor, insertVendorSchema } from "@db/schema";

const VENDOR_CATEGORIES = [
  { value: "materials_supplier", label: "Materials Supplier" },
  { value: "service_provider", label: "Service Provider" },
  { value: "logistic_partner", label: "Logistic Partner" },
  { value: "equipment_rental", label: "Equipment Rental" },
  { value: "others", label: "Others" },
] as const;

const CURRENCIES = [
  { value: "QAR", label: "QAR - Qatari Riyal" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "CNY", label: "CNY - Chinese Yuan" },
] as const;

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
] as const;

interface EditVendorDialogProps {
  vendor: Vendor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditVendorDialog({
  vendor,
  open,
  onOpenChange,
}: EditVendorDialogProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(insertVendorSchema),
    defaultValues: {
      companyName: vendor?.companyName ?? "",
      registrationNumber: vendor?.registrationNumber ?? "",
      email: vendor?.email ?? "",
      contactNumber: vendor?.contactNumber ?? "",
      accountNumber: vendor?.accountNumber ?? "",
      ibanNumber: vendor?.ibanNumber ?? "",
      contactPerson: vendor?.contactPerson ?? "",
      bankName: vendor?.bankName ?? "",
      category: vendor?.category ?? "materials_supplier",
      paymentCurrency: vendor?.paymentCurrency ?? "QAR",
      status: vendor?.status ?? "active",
      address: vendor?.address ?? ""
    },
    mode: "onChange"
  });

  const updateVendor = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/vendors/${vendor?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      onOpenChange(false);
      form.reset();
      setCurrentSlide(0);
      toast({
        title: "Success",
        description: "Vendor updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });

  const validateCurrentSlide = async () => {
    const fieldsToValidate = {
      0: ['companyName', 'registrationNumber', 'category'] as const,
      1: ['email', 'contactNumber', 'contactPerson', 'address'] as const,
      2: ['bankName', 'accountNumber', 'ibanNumber', 'paymentCurrency', 'status'] as const
    }[currentSlide];

    const isValid = await form.trigger(fieldsToValidate);
    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields before proceeding",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const onSubmit = async (data: any) => {
    if (currentSlide !== 2) {
      toast({
        title: "Error",
        description: "Please complete all steps before submitting",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await updateVendor.mutateAsync(data);
    } catch (error) {
      console.error("Error updating vendor:", error);
    }
  };

  const handleNext = async () => {
    const isValid = await validateCurrentSlide();
    if (isValid) {
      setCurrentSlide(Math.min(2, currentSlide + 1));
    }
  };

  const handleBack = () => {
    setCurrentSlide(Math.max(0, currentSlide - 1));
  };

  const formSlides = [
    // Slide 1: Basic Information
    <>
      <div className="space-y-4">
        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="registrationNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Registration Number</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_CATEGORIES.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>,
    // Slide 2: Contact Information
    <>
      <div className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
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
              <FormLabel>Contact Number</FormLabel>
              <FormControl>
                <Input type="tel" {...field} />
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
              <FormLabel>Contact Person</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>,
    // Slide 3: Banking Information
    <>
      <div className="space-y-4">
        <FormField
          control={form.control}
          name="bankName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bank Name</FormLabel>
              <FormControl>
                <Input {...field} />
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
              <FormLabel>Account Number</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ibanNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>IBAN Number</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="paymentCurrency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Currency</FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>,
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Edit Vendor - Step {currentSlide + 1} of {formSlides.length}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit(onSubmit)(e);
          }} className="space-y-4">
            {/* Carousel content */}
            <div className="relative">
              <div className="overflow-hidden">
                <div
                  className="transition-transform duration-300 ease-in-out flex"
                  style={{
                    transform: `translateX(-${currentSlide * 100}%)`,
                  }}
                >
                  {formSlides.map((slide, index) => (
                    <div
                      key={index}
                      className="min-w-full"
                      style={{ opacity: currentSlide === index ? 1 : 0 }}
                    >
                      {slide}
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentSlide === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                {currentSlide === formSlides.length - 1 ? (
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || !form.formState.isValid}
                  >
                    {isSubmitting ? "Updating..." : "Update Vendor"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleNext}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>

            {/* Progress indicators */}
            <div className="flex justify-center gap-2 mt-4">
              {formSlides.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`w-2 h-2 rounded-full transition-colors ${
                    currentSlide === index ? "bg-primary" : "bg-gray-300"
                  }`}
                  onClick={() => validateCurrentSlide().then(isValid => {
                    if (isValid || index < currentSlide) {
                      setCurrentSlide(index);
                    }
                  })}
                />
              ))}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
