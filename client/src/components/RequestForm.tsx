import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";

const requestSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  purposeType: z.string().min(1, "Purpose type is required"),
  priority: z.string().min(1, "Priority is required"),
  vendorId: z.number().optional(),
  subPurposeId: z.number().optional(),
  items: z.array(z.object({
    name: z.string().min(1, "Item name is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    description: z.string().optional(),
    estimatedCost: z.number().min(0, "Cost cannot be negative")
  })).min(1, "At least one item is required"),
  freightAmount: z.number().min(0, "Freight amount cannot be negative").optional(),
  currency: z.string().default("QAR"),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface RequestFormProps {
  onSubmit: (data: RequestFormData) => void;
  initialData?: Partial<RequestFormData>;
}

export function RequestForm({ onSubmit, initialData = {} }: RequestFormProps) {
  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      title: "",
      description: "",
      purposeType: "",
      priority: "medium",
      items: [],
      freightAmount: 0,
      currency: "QAR",
      ...initialData
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="title" className="required">Title</FormLabel>
              <FormControl>
                <Input 
                  id="title"
                  placeholder="Enter request title"
                  aria-required="true"
                  aria-invalid={!!form.formState.errors.title}
                  {...field} 
                />
              </FormControl>
              <FormDescription>
                A clear and concise title for your request
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="description" className="required">Description</FormLabel>
              <FormControl>
                <Textarea
                  id="description"
                  placeholder="Enter detailed description"
                  aria-required="true"
                  aria-invalid={!!form.formState.errors.description}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Provide detailed information about your request
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="purposeType"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="purposeType" className="required">Purpose Type</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
                aria-required="true"
                aria-invalid={!!form.formState.errors.purposeType}
              >
                <FormControl>
                  <SelectTrigger id="purposeType">
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

        {/* Add more form fields here */}

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            aria-label="Reset form"
          >
            Reset
          </Button>
          <Button 
            type="submit"
            aria-label="Submit request"
          >
            Submit Request
          </Button>
        </div>
      </form>
    </Form>
  );
}