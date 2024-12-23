import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAccountRequestSchema } from "@db/schema";
import type { NewAccountRequest } from "@db/schema";
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

export default function AccountRequestForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const form = useForm<NewAccountRequest>({
    resolver: zodResolver(insertAccountRequestSchema),
    defaultValues: {
      role: "user",
      status: "pending"
    }
  });

  const onSubmit = async (data: NewAccountRequest) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/account-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      toast({
        title: "Success",
        description: result.message,
      });
      form.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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
        <Select
          onValueChange={(value) => form.setValue("department", value)}
          defaultValue={form.getValues("department")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Management">Management</SelectItem>
            <SelectItem value="Business">Business</SelectItem>
            <SelectItem value="Operations">Operations</SelectItem>
            <SelectItem value="Support">Support</SelectItem>
            <SelectItem value="Finance">Finance</SelectItem>
            <SelectItem value="Director">Director</SelectItem>
            <SelectItem value="CEO Office">CEO Office</SelectItem>
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
