import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { InsertAccountRequest } from "@db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { insertAccountRequestSchema, mandatoryDepartments } from "@db/schema";

export default function AccountRequestForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const form = useForm<InsertAccountRequest>({
    resolver: zodResolver(insertAccountRequestSchema),
    defaultValues: {
      role: "user",
      status: "pending"
    }
  });

  const onSubmit = async (data: InsertAccountRequest) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/request-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to submit account request');
      }

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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          {...form.register("username")}
          className="mt-1"
        />
        {form.formState.errors.username && (
          <p className="text-sm text-red-500 mt-1">
            {form.formState.errors.username.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          {...form.register("password")}
          className="mt-1"
        />
        {form.formState.errors.password && (
          <p className="text-sm text-red-500 mt-1">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...form.register("email")}
          className="mt-1"
        />
        {form.formState.errors.email && (
          <p className="text-sm text-red-500 mt-1">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="contact_number">Contact Number</Label>
        <Input
          id="contact_number"
          {...form.register("contact_number")}
          className="mt-1"
        />
        {form.formState.errors.contact_number && (
          <p className="text-sm text-red-500 mt-1">
            {form.formState.errors.contact_number.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="department">Department</Label>
        <Select
          onValueChange={(value) => form.setValue("department", value)}
          defaultValue={form.getValues("department")}
        >
          <SelectTrigger id="department" className="mt-1">
            <SelectValue placeholder="Select department" />
          </SelectTrigger>
          <SelectContent>
            {mandatoryDepartments.map((dept) => (
              <SelectItem key={dept} value={dept}>
                {dept}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.department && (
          <p className="text-sm text-red-500 mt-1">
            {form.formState.errors.department.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Submitting..." : "Request Account"}
      </Button>
    </form>
  );
}