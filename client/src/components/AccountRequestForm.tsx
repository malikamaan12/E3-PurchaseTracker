import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AccountRequest } from "@db/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { FormErrorTooltip } from "@/components/ui/form-error-tooltip";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { insertAccountRequestSchema, mandatoryDepartments } from "@db/schema";
import { motion } from "framer-motion";

const formItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function AccountRequestForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const form = useForm<AccountRequest>({
    resolver: zodResolver(insertAccountRequestSchema),
    defaultValues: {
      role: "user",
      status: "pending",
      contact_number: "",
    },
    mode: "onBlur",
  });

  const onSubmit = async (data: AccountRequest) => {
    try {
      setIsLoading(true);
      console.log('Submitting form data:', data);

      const formData = {
        ...data,
        contact_number: data.contact_number.trim(),
      };

      console.log('Processed form data:', formData);

      const response = await fetch("/api/auth/request-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        credentials: "include",
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('Form submission error:', responseData);
        throw new Error(responseData.message || 'Failed to submit account request');
      }

      console.log('Form submitted successfully:', responseData);

      toast({
        title: "Success",
        description: "Your account request has been submitted successfully",
      });

      form.reset();
    } catch (error: any) {
      console.error("Account request error:", error);

      toast({
        title: "Error",
        description: error.message || "Failed to submit account request",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Log form errors whenever they change
  console.log('Current form errors:', form.formState.errors);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          className="space-y-6"
        >
          <motion.div variants={formItemVariants}>
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormErrorTooltip message={form.formState.errors.username?.message} />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={formItemVariants}>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormErrorTooltip message={form.formState.errors.password?.message} />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={formItemVariants}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormErrorTooltip message={form.formState.errors.email?.message} />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={formItemVariants}>
            <FormField
              control={form.control}
              name="contact_number"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel>Contact Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter contact number" />
                  </FormControl>
                  <FormErrorTooltip message={form.formState.errors.contact_number?.message} />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={formItemVariants}>
            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel>Department</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {mandatoryDepartments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormErrorTooltip message={form.formState.errors.department?.message} />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={formItemVariants}>
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="approver">Approver</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormErrorTooltip message={form.formState.errors.role?.message} />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div
            variants={formItemVariants}
            className="pt-4"
          >
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full transition-all duration-200 hover:scale-[1.02]"
            >
              {isLoading ? "Submitting..." : "Request Account"}
            </Button>
          </motion.div>
        </motion.div>
      </form>
    </Form>
  );
}