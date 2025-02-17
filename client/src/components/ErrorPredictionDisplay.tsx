import { AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ErrorPredictionDisplayProps {
  context: string;
  error?: Error | null;
  predictions?: string[];
  suggestions?: string[];
  warnings?: string[];
}

export function ErrorPredictionDisplay({
  context,
  error,
  predictions = [],
  suggestions = [],
  warnings = [],
}: ErrorPredictionDisplayProps) {
  if (!error && predictions.length === 0 && suggestions.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error in {context}</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Potential Issues</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {warnings.map((warning, index) => (
                <li key={index} className="text-sm">
                  {warning}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Accordion type="single" collapsible className="w-full">
        {predictions.length > 0 && (
          <AccordionItem value="predictions">
            <AccordionTrigger className="text-yellow-600">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Predicted Issues
                <Badge variant="outline" className="ml-2">
                  {predictions.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc list-inside mt-2 space-y-2">
                {predictions.map((prediction, index) => (
                  <li key={index} className="text-sm text-gray-600">
                    {prediction}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}

        {suggestions.length > 0 && (
          <AccordionItem value="suggestions">
            <AccordionTrigger className="text-green-600">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Suggested Actions
                <Badge variant="outline" className="ml-2">
                  {suggestions.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc list-inside mt-2 space-y-2">
                {suggestions.map((suggestion, index) => (
                  <li key={index} className="text-sm text-gray-600">
                    {suggestion}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}