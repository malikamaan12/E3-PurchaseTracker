import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { AlertCircle, Search, ChevronRight, AlertTriangle } from "lucide-react";
import type { ErrorSeverity } from "@/lib/errorUtils";
import ErrorProgressTracker from "./ErrorProgressTracker";
import { ErrorPredictionDisplay } from "./ErrorPredictionDisplay";
import { useToast } from "@/hooks/use-toast";

interface ErrorCode {
  code: string;
  title: string;
  description: string;
  severity: ErrorSeverity;
  possibleCauses: string[];
  solutions: string[];
}

const commonErrorCodes: ErrorCode[] = [
  {
    code: "VALIDATION_ERROR",
    title: "Form Validation Error",
    description: "The submitted form data contains invalid or missing fields.",
    severity: "warning",
    possibleCauses: [
      "Required fields are empty",
      "Invalid data format",
      "Data exceeds maximum length"
    ],
    solutions: [
      "Check all required fields are filled",
      "Ensure data formats match requirements",
      "Verify input lengths are within limits"
    ]
  },
  {
    code: "AUTHENTICATION_ERROR",
    title: "Authentication Failed",
    description: "Unable to authenticate user credentials.",
    severity: "error",
    possibleCauses: [
      "Invalid username or password",
      "Expired session",
      "Missing authentication token"
    ],
    solutions: [
      "Verify login credentials",
      "Try logging out and back in",
      "Clear browser cache and cookies"
    ]
  },
  {
    code: "DATABASE_ERROR",
    title: "Database Operation Failed",
    description: "An error occurred while accessing the database.",
    severity: "critical",
    possibleCauses: [
      "Database connection lost",
      "Query timeout",
      "Data integrity constraint violation"
    ],
    solutions: [
      "Retry the operation",
      "Check your internet connection",
      "Contact support if the issue persists"
    ]
  }
];

const severityColors = {
  critical: "text-red-600 bg-red-50",
  error: "text-orange-600 bg-orange-50",
  warning: "text-yellow-600 bg-yellow-50",
  info: "text-blue-600 bg-blue-50"
} as const;

export default function ErrorLookupGuide() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedError, setSelectedError] = useState<ErrorCode | null>(null);
  const [resolutionStage, setResolutionStage] = useState(1);
  const [predictedSuggestions, setPredictedSuggestions] = useState<string[]>([]);
  const [predictionContext, setPredictionContext] = useState<string>("");
  const { toast } = useToast();

  const filteredErrors = commonErrorCodes.filter(error =>
    error.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    error.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    error.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Generate intelligent suggestions based on selected error
  useEffect(() => {
    if (selectedError) {
      // Set the context for error prediction
      setPredictionContext(selectedError.code);

      // Create more dynamic suggestions using context-aware predictions
      const generateIntelligentSuggestions = () => {
        // Simulate AI-based suggestions - in a real app, this would call the prediction API
        const predictions = [
          `This error commonly occurs during ${new Date().getHours() < 12 ? 'morning' : 'afternoon'} hours`,
          "Similar errors often affect related components",
          selectedError.severity === "critical" ? "This error may impact system stability" : null
        ].filter(Boolean) as string[];

        // Add time-based suggestions
        const currentHour = new Date().getHours();
        const currentDay = new Date().getDay();

        const timeSuggestions = [];
        if (currentHour > 16) {
          timeSuggestions.push("Support team availability may be limited after business hours");
        }

        if (currentDay === 0 || currentDay === 6) {
          timeSuggestions.push("Weekend support response times may be longer");
        }

        const intelligentSuggestions = [
          ...selectedError.solutions,
          ...timeSuggestions,
          "Review recent system changes that might have triggered this error",
          "Check logs for related error patterns"
        ];

        setPredictedSuggestions(intelligentSuggestions);

        // Show a toast notification about the intelligent analysis
        toast({
          title: "Intelligent Analysis",
          description: `Generated predictions and suggestions for ${selectedError.code}`,
          variant: "default"
        });
      };

      generateIntelligentSuggestions();

      // Simulate progress through stages
      const interval = setInterval(() => {
        setResolutionStage(stage => {
          if (stage >= 4) {
            clearInterval(interval);
            return stage;
          }
          return stage + 1;
        });
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [selectedError, toast]);

  // Handle error selection
  const handleErrorSelect = (error: ErrorCode) => {
    setSelectedError(error);
    setResolutionStage(1);
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Error Code Lookup Guide</h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          placeholder="Search error codes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          {filteredErrors.map(error => (
            <Card 
              key={error.code}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedError?.code === error.code ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => handleErrorSelect(error)}
            >
              <CardHeader className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-mono">{error.code}</CardTitle>
                    <CardDescription className="mt-1">{error.title}</CardDescription>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severityColors[error.severity]}`}>
                    {error.severity}
                  </span>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {selectedError ? (
          <div className="space-y-6">
            <Card className="h-fit">
              <CardHeader className="p-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className={`h-5 w-5 ${severityColors[selectedError.severity].split(" ")[0]}`} />
                  <div>
                    <CardTitle className="text-lg">{selectedError.title}</CardTitle>
                    <CardDescription className="font-mono">{selectedError.code}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-sm text-gray-600">{selectedError.description}</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Possible Causes</h3>
                  <ul className="space-y-2">
                    {selectedError.possibleCauses.map((cause, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start">
                        <ChevronRight className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                        {cause}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Intelligent Solutions</h3>
                  <ul className="space-y-2">
                    {predictedSuggestions.map((solution, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start">
                        <ChevronRight className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                        {solution}
                      </li>
                    ))}
                  </ul>
                </div>

                <ErrorPredictionDisplay
                  context={`Error: ${selectedError.code}`}
                  predictions={[
                    `This error tends to occur more frequently during ${new Date().getHours() < 12 ? 'morning' : 'afternoon'} operations`,
                    selectedError.severity === "critical" ? "System stability may be affected" : "Localized component impact only",
                    "Related errors might appear in connected systems"
                  ]}
                  suggestions={predictedSuggestions.slice(0, 3)}
                  warnings={[
                    selectedError.severity === "critical" ? "Requires immediate attention" : null,
                    "May indicate underlying system issues if recurring frequently"
                  ].filter(Boolean) as string[]}
                />
              </CardContent>
            </Card>

            <ErrorProgressTracker
              errorCode={selectedError.code}
              severity={selectedError.severity}
              currentStage={resolutionStage}
            />
          </div>
        ) : (
          <Card className="h-fit">
            <CardContent className="p-8 text-center text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4" />
              <p>Select an error code to view details</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}