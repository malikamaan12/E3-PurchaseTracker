import { useState } from "react";
import { Check, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Vendor } from "@db/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertVendorSchema } from "@db/schema";

interface VendorSelectProps {
  value?: number;
  onChange: (value: number | undefined, vendorName?: string) => void;
}

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

export default function VendorSelect({ value, onChange }: VendorSelectProps) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(insertVendorSchema),
    defaultValues: {
      companyName: "",
      registrationNumber: "",
      email: "",
      contactNumber: "",
      accountNumber: "",
      ibanNumber: "",
      contactPerson: "",
      bankName: "",
      category: "materials_supplier",
      paymentCurrency: "QAR",
      status: "active",
      address: ""
    },
    mode: "onChange"
  });

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const createVendor = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to create vendor");
      }

      return res.json() as Promise<Vendor>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      onChange(data.id, data.companyName);
      setDialogOpen(false);
      form.reset();
      setCurrentSlide(0);
      toast({
        title: "Success",
        description: "Vendor created successfully",
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

  // Prevent form submission when clicking enter
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

      // Get all form values
      const formData = form.getValues();

      // Check if all required fields are filled
      const requiredFields = [
        'companyName',
        'registrationNumber',
        'contactNumber',
        'contactPerson',
        'bankName',
        'accountNumber',
        'ibanNumber',
        'address'
      ];

      const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]?.trim());

      if (missingFields.length > 0) {
        toast({
          title: "Missing Required Fields",
          description: `Please fill in: ${missingFields.map(f => f.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}`,
          variant: "destructive",
        });
        return;
      }

      // Validate email if provided
      if (formData.email && !formData.email.includes('@')) {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address",
          variant: "destructive",
        });
        return;
      }

      // Validate contact number format (basic validation)
      if (!/^\+?[\d\s-]+$/.test(formData.contactNumber)) {
        toast({
          title: "Invalid Contact Number",
          description: "Please enter a valid contact number",
          variant: "destructive",
        });
        return;
      }

      // Additional validation for bank details
      if (formData.accountNumber.length < 8 || formData.ibanNumber.length < 15) {
        toast({
          title: "Invalid Bank Details",
          description: "Please enter valid account and IBAN numbers",
          variant: "destructive",
        });
        return;
      }

      await createVendor.mutateAsync(formData);
    } catch (error: any) {
      console.error("Error creating vendor:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create vendor",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateCurrentSlide = async () => {
    const fieldsToValidate = {
      0: ['companyName', 'registrationNumber', 'category'] as const,
      1: ['email', 'contactNumber', 'contactPerson', 'address'] as const,
      2: ['bankName', 'accountNumber', 'ibanNumber', 'paymentCurrency', 'status'] as const
    }[currentSlide];

    const isValid = await form.trigger(fieldsToValidate);
    if (!isValid) {
      const errors = form.formState.errors;
      const errorFields = Object.keys(errors)
        .filter(key => fieldsToValidate.includes(key as any))
        .map(key => key.replace(/([A-Z])/g, ' $1').toLowerCase())
        .join(', ');

      toast({
        title: "Validation Error",
        description: `Please check these fields: ${errorFields}`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const selectedVendor = vendors.find((v) => v.id === value);

  const handleSelectVendor = (vendorId: number, vendorName: string) => {
    onChange(vendorId, vendorName);
    setOpen(false);
  };

  const handleNext = async () => {
    const isValid = await validateCurrentSlide();
    if (isValid) {
      setCurrentSlide(Math.min(formSlides.length - 1, currentSlide + 1));
    }
  };

  const handleBack = () => {
    setCurrentSlide(Math.max(0, currentSlide - 1));
  };

  const formSlides = [
    // Slide 1: Basic Information
    <>
      <div className="space-y-4" onKeyPress={handleKeyPress}>
        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name *</FormLabel>
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
              <FormLabel>Registration Number *</FormLabel>
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
              <FormLabel>Category *</FormLabel>
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
      <div className="space-y-4" onKeyPress={handleKeyPress}>
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
              <FormLabel>Contact Number *</FormLabel>
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
              <FormLabel>Contact Person *</FormLabel>
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
              <FormLabel>Address *</FormLabel>
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
      <div className="space-y-4" onKeyPress={handleKeyPress}>
        <FormField
          control={form.control}
          name="bankName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bank Name *</FormLabel>
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
              <FormLabel>Account Number *</FormLabel>
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
              <FormLabel>IBAN Number *</FormLabel>
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
              <FormLabel>Payment Currency *</FormLabel>
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
              <FormLabel>Status *</FormLabel>
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
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {isLoading
              ? "Loading..."
              : value
                ? selectedVendor?.companyName
                : "Select vendor..."}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput placeholder="Search vendors..." />
            <CommandEmpty>No vendor found.</CommandEmpty>
            <CommandGroup>
              {vendors.map((vendor) => (
                <CommandItem
                  key={vendor.id}
                  onSelect={() => handleSelectVendor(vendor.id, vendor.companyName)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === vendor.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {vendor.companyName}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Create New Vendor - Step {currentSlide + 1} of {formSlides.length}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4">
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
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Creating..." : "Create Vendor"}
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
    </div>
  );
}