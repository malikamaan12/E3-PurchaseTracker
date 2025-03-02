import { useState, useEffect } from "react";
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
  FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Star } from "lucide-react";

type VendorFormValues = InsertVendor;

interface VendorFormProps {
  onSubmit: (data: VendorFormValues) => Promise<any>;
  defaultValues?: Partial<VendorFormValues>;
}

export function VendorForm({ onSubmit, defaultValues }: VendorFormProps) {
  const { toast } = useToast();
  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
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
      status: "active",
      rating: 0
    },
  });
  
  // Set default values when they change
  useEffect(() => {
    if (defaultValues) {
      // Process defaultValues to ensure null values are handled correctly
      const processedValues = Object.entries(defaultValues).reduce((acc, [key, value]) => {
        // Convert nulls to empty strings for the form
        acc[key] = value === null ? "" : value;
        return acc;
      }, {} as Record<string, any>);
      
      console.log('Setting form values with processed defaults:', processedValues);
      form.reset(processedValues);
    }
  }, [defaultValues, form]);

  // Enhanced form submission with better handling of loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Direct form handler - simplifying the process
  const handleFormSubmit = async (values: VendorFormValues) => {
    console.log('Form submitted with values:', values);
    console.log('Form state:', form.formState);
    
    // Check if the form has validation errors
    if (Object.keys(form.formState.errors).length > 0) {
      console.error('Form has validation errors:', form.formState.errors);
      toast({
        title: "Validation Error",
        description: "Please check the form for errors",
        variant: "destructive",
      });
      return;
    }
    
    if (isSubmitting) {
      console.log('Preventing double submission');
      return;
    }
    
    setIsSubmitting(true);
    console.log('Starting vendor form submission with values:', values);
    
    try {
      // Process optional fields that can be null and convert types
      const processedData = { ...values };
      
      // Handle optional text fields
      if (processedData.taxNumber === '') processedData.taxNumber = null;
      if (processedData.registrationNumber === '') processedData.registrationNumber = null;
      if (processedData.remarks === '') processedData.remarks = null;
      
      // Ensure rating is properly typed as a number
      processedData.rating = typeof processedData.rating === 'string' 
        ? Number(processedData.rating) || 0
        : processedData.rating || 0;
      
      console.log('Ensuring rating is a number:', processedData.rating, typeof processedData.rating);
      
      // For updates, make sure to include ID from defaultValues
      if (defaultValues?.id) {
        // When updating, we need to send the ID as it's needed by the updateVendor function
        const vendorId = defaultValues.id;
        console.log(`Including vendor ID ${vendorId} in update context`);
      }
      
      console.log('Processed values for submission:', processedData);
      
      // Show loading toast
      const isUpdate = !!defaultValues?.id;
      toast({
        title: isUpdate ? "Updating" : "Creating",
        description: `${isUpdate ? 'Updating' : 'Creating'} vendor information...`,
      });
      
      // Call the parent submission handler
      console.log('Calling parent onSubmit function');
      console.log('Is this an update?', isUpdate);
      
      try {
        const result = await onSubmit(processedData);
        console.log('Parent onSubmit function returned:', result);
        
        // Show success toast
        toast({
          title: "Success",
          description: `Vendor ${isUpdate ? 'updated' : 'created'} successfully`,
        });
        
        // Only reset form for new vendor creation
        if (!isUpdate) {
          form.reset();
        }
      } catch (submitError) {
        console.error("Submit function error:", submitError);
        throw submitError;
      }
    } catch (error) {
      console.error("Form submission error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save vendor",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // We'll just use a manual submit button and avoid the onSubmit handler 
  // to prevent any confusion with duplicate handlers

  return (
    <Form {...form}>
      <form className="space-y-4">
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
                  <Input 
                    {...field} 
                    value={field.value || ''}
                    placeholder="Enter registration number (optional)" 
                  />
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
            name="rating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vendor Rating</FormLabel>
                <FormControl>
                  <div className="flex items-center space-x-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        className="focus:outline-none"
                        onClick={() => {
                          console.log(`Setting rating to ${rating}`);
                          field.onChange(rating);
                        }}
                      >
                        <Star
                          className={`h-5 w-5 ${
                            Number(field.value) >= rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-sm text-gray-600">
                      {field.value ? `${field.value}/5` : "Not rated"}
                    </span>
                  </div>
                </FormControl>
                <FormDescription>Rate this vendor from 1 to 5 stars</FormDescription>
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
                  <Textarea 
                    {...field} 
                    value={field.value || ''}
                    placeholder="Enter additional remarks (optional)" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button 
            type="button" 
            disabled={isSubmitting}
            onClick={() => {
              console.log("Save button clicked manually");
              const formValues = form.getValues();
              console.log("Current form values:", formValues);
              handleFormSubmit(formValues);
            }}
          >
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