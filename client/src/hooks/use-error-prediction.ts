import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { predictPotentialErrors, generateSmartSuggestions } from "@/lib/request-analyzer";

interface ErrorPredictionState {
  isAnalyzing: boolean;
  predictions: string[];
  suggestions: string[];
  error: Error | null;
}

/**
 * Custom hook for intelligent error prediction and preemptive suggestions
 * 
 * @param context The context of the current operation (e.g., 'purchase-request', 'approval-process')
 * @param data The current state/data being processed
 * @param options Additional options for prediction behavior
 */
export function useErrorPrediction(
  context: string,
  data: any,
  options?: {
    autoToast?: boolean;  // Whether to automatically show toasts for critical predictions
    refreshInterval?: number;  // How often to refresh predictions (in ms), 0 to disable
  }
) {
  const [state, setState] = useState<ErrorPredictionState>({
    isAnalyzing: false,
    predictions: [],
    suggestions: [],
    error: null
  });

  const { toast } = useToast();
  const { autoToast = false, refreshInterval = 0 } = options || {};

  // Function to analyze the current data for potential issues
  const analyzeForIssues = async () => {
    if (!data) return;

    try {
      setState(prev => ({ ...prev, isAnalyzing: true }));

      // Get predictions and suggestions
      const predictions = await predictPotentialErrors(context, data);
      const suggestions = await generateSmartSuggestions(context, data);

      setState({
        isAnalyzing: false,
        predictions,
        suggestions,
        error: null
      });

      // Automatically show toast for critical predictions if enabled
      if (autoToast && predictions.length > 0) {
        const criticalPrediction = predictions[0];
        toast({
          title: "Potential Issue Detected",
          description: criticalPrediction,
          // Fix: Use 'destructive' variant instead of 'warning'
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error predicting issues:", error);
      setState({
        isAnalyzing: false,
        predictions: [],
        suggestions: [],
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  };

  // Analyze on data change
  useEffect(() => {
    analyzeForIssues();
  }, [context, data]);

  // Set up interval for refreshing predictions if requested
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(analyzeForIssues, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, context, data]);

  return {
    ...state,
    refresh: analyzeForIssues
  };
}