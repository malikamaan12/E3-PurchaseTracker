import { PDFCustomizationForm } from "@/components/PDFCustomizationForm";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export function PDFSettings() {
  return (
    <div className="container mx-auto py-8">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>PDF Template Settings</CardTitle>
        </CardHeader>
      </Card>
      <PDFCustomizationForm />
    </div>
  );
}

export default PDFSettings;
