import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const vendorFormSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  contactPerson: z.string().min(2, "Contact person name must be at least 2 characters"),
  contactNumber: z.string()
    .min(8, "Contact number must be at least 8 digits")
    .max(15, "Contact number cannot exceed 15 digits")
    .regex(/^[+]?[\d\s-]+$/, "Invalid contact number format"),
  email: z.string().email("Invalid email format"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  taxNumber: z.string().optional(),
  registrationNumber: z.string().optional(),
  bankName: z.string().min(2, "Bank name must be at least 2 characters"),
  accountNumber: z.string()
    .min(5, "Account number must be at least 5 characters")
    .regex(/^[\w-]+$/, "Account number can only contain letters, numbers, and hyphens"),
  ibanNumber: z.string()
    .min(15, "IBAN must be at least 15 characters")
    .regex(/^[A-Z0-9]+$/, "IBAN must contain only uppercase letters and numbers"),
  branchName: z.string().min(2, "Branch name must be at least 2 characters"),
  remarks: z.string().optional(),
});

type VendorFormValues = z.infer<typeof vendorFormSchema>;

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
    },
  });

  const handleSubmit = async (values: VendorFormValues) => {
    try {
      // Add default values for fields not in the form
      const enrichedValues = {
        ...values,
        category: "general",
        payment_currency: "QAR",
        status: "active"
      };
      await onSubmit(enrichedValues);
      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save vendor",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                  <Input {...field} placeholder="Enter tax number (optional)" />
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
          <Button type="submit">Save Vendor</Button>
        </div>
      </form>
    </Form>
  );
}