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
import { insertAccountRequestSchema } from "@db/schema";

export default function AccountRequestForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const form = useForm<InsertAccountRequest>({
    resolver: zodResolver(insertAccountRequestSchema),
    defaultValues: {
      role: "user",
    }
  });

  const onSubmit = async (data: InsertAccountRequest) => {
    setIsLoading(true);
    try {
      console.log("Submitting account request:", data);
      const response = await fetch("/api/auth/request-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const result = await response.json();
      console.log("Account request response:", result);

      toast({
        title: "Success",
        description: result.message,
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
        <Label htmlFor="contactNumber">Contact Number</Label>
        <Input
          id="contactNumber"
          {...form.register("contactNumber")}
          className="mt-1"
        />
        {form.formState.errors.contactNumber && (
          <p className="text-sm text-red-500 mt-1">
            {form.formState.errors.contactNumber.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="department">Department</Label>
        <Input
          id="department"
          {...form.register("department")}
          className="mt-1"
        />
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