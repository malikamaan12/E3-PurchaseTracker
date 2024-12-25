import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import CompanyBrandingForm from "@/components/CompanyBrandingForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import VendorSelect from "@/components/VendorSelect";
import { insertUserSchema } from "@db/schema";

export default function AdminPanel() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("branding");

  return (
    <div className="container mx-auto py-8">
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="vendors">Vendor Management</TabsTrigger>
        </TabsList>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Company Branding</CardTitle>
              <CardDescription>
                Customize company branding, logo, and PDF templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyBrandingForm />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendors Tab */}
        <TabsContent value="vendors">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Management</CardTitle>
              <CardDescription>
                Add and manage vendor information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VendorSelect
                onChange={(id, name) => {
                  // Handle vendor selection
                  toast({
                    title: "Vendor Selected",
                    description: `Selected vendor: ${name}`,
                  });
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}