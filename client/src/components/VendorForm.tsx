import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type InsertVendor, vendorFormSchema } from "@db/schema";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type VendorFormValues = InsertVendor;

interface VendorFormProps {
  onSubmit: (data: VendorFormValues) => Promise<void>;
  defaultValues?: Partial<VendorFormValues>;
}

export function VendorForm({ onSubmit, defaultValues }: VendorFormProps) {
  const { toast } = useToast();
  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: defaultValues || {
      companyName: "",
      contactPerson: "",
      contactNumber: "",
      email: "",
      address: "",
      taxNumber: "",
      registrationNumber: "",
      bankName: "",
      accountNumber: "",
      ibanNumber: "",
      branchName: "",
      remarks: "",
      category: "general",
      payment_currency: "QAR",
      status: "active"
    },
  });

  const handleSubmit = async (values: VendorFormValues) => {
    try {
      // Add loading state indicator to improve user feedback
      toast({
        title: "Processing",
        description: "Saving vendor information...",
        variant: "default",
      });
      
      await onSubmit(values);
      
      // Only reset the form if this is an add operation (no defaultValues)
      if (!defaultValues) {
        form.reset();
      }
    } catch (error) {
      console.error("Form submission error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save vendor",
        variant: "destructive",
      });
    }
  };

  // Add form submission state to show loading indicator  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Enhanced submit handler with loading state
  const handleFormSubmit = async (values: VendorFormValues) => {
    setIsSubmitting(true);
    try {
      await handleSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Name*</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter company name" />
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
                <FormLabel>Contact Person*</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter contact person name" />
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
                <FormLabel>Contact Number*</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter contact number" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email*</FormLabel>
                <FormControl>
                  <Input {...field} type="email" placeholder="Enter email address" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Address*</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Enter complete address" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="taxNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax Number</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    value={field.value || ''}
                    placeholder="Enter tax number (optional)" 
                  />
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
                  <Input {...field} placeholder="Enter registration number (optional)" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bankName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bank Name*</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter bank name" />
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
                <FormLabel>Account Number*</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter account number" />
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
                <FormLabel>IBAN Number*</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter IBAN number" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="branchName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch Name*</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter branch name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="remarks"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Remarks</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Enter additional remarks (optional)" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              "Save Vendor"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}