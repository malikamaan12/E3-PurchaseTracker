import { DraggableBrandingForm } from "@/components/DraggableBrandingForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BrandingPage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Brand Customization</CardTitle>
        </CardHeader>
        <CardContent>
          <DraggableBrandingForm />
        </CardContent>
      </Card>
    </div>
  );
}
