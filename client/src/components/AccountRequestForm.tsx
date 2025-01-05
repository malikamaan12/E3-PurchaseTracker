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
  FormMessage,
} from "@/components/ui/form";
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
import type { z } from "zod";

const formItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

type FormData = z.infer<typeof insertAccountRequestSchema>;

export default function AccountRequestForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const form = useForm<FormData>({
    resolver: zodResolver(insertAccountRequestSchema),
    defaultValues: {
      role: "user",
      status: "pending",
      contact_number: "",
    },
    mode: "onBlur",
  });

  const onSubmit = async (data: FormData) => {
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

      if (!response.ok) {
        const responseData = await response.text();
        console.error('Form submission error:', responseData);
        throw new Error(responseData || 'Failed to submit account request');
      }

      console.log('Form submitted successfully');

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
                <FormItem>
                  <FormLabel htmlFor={field.name}>Username</FormLabel>
                  <FormControl>
                    <Input id={field.name} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={formItemVariants}>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor={field.name}>Password</FormLabel>
                  <FormControl>
                    <Input id={field.name} type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={formItemVariants}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor={field.name}>Email</FormLabel>
                  <FormControl>
                    <Input id={field.name} type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={formItemVariants}>
            <FormField
              control={form.control}
              name="contact_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor={field.name}>Contact Number</FormLabel>
                  <FormControl>
                    <Input id={field.name} {...field} placeholder="Enter contact number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={formItemVariants}>
            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger id="department-select">
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
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={formItemVariants}>
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger id="role-select">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="approver">Approver</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
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