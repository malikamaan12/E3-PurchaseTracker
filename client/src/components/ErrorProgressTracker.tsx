import { useState, useEffect } from "react";
import { Check, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import type { ErrorSeverity } from "@/lib/errorUtils";

interface Stage {
  id: number;
  title: string;
  description: string;
  icon: JSX.Element;
  completed: boolean;
}

interface ErrorProgressTrackerProps {
  errorCode: string;
  severity: ErrorSeverity;
  currentStage: number;
  onStageComplete?: (stageId: number) => void;
}

const severityColors = {
  critical: "text-red-600",
  error: "text-orange-600",
  warning: "text-yellow-600",
  info: "text-blue-600"
} as const;

const severityBgColors = {
  critical: "bg-red-100",
  error: "bg-orange-100",
  warning: "bg-yellow-100",
  info: "bg-blue-100"
} as const;

export default function ErrorProgressTracker({
  errorCode,
  severity,
  currentStage,
  onStageComplete
}: ErrorProgressTrackerProps) {
  const [progress, setProgress] = useState(0);
  const [stages, setStages] = useState<Stage[]>([
    {
      id: 1,
      title: "Error Detected",
      description: "System has identified the error and initiated resolution process",
      icon: <AlertCircle className="h-6 w-6" />,
      completed: false
    },
    {
      id: 2,
      title: "Analysis",
      description: "Analyzing error context and potential solutions",
      icon: <Clock className="h-6 w-6" />,
      completed: false
    },
    {
      id: 3,
      title: "Resolution",
      description: "Implementing solution and verifying fixes",
      icon: <ArrowRight className="h-6 w-6" />,
      completed: false
    },
    {
      id: 4,
      title: "Verification",
      description: "Confirming error has been resolved successfully",
      icon: <Check className="h-6 w-6" />,
      completed: false
    }
  ]);

  useEffect(() => {
    // Update progress based on current stage
    const progressValue = (currentStage / stages.length) * 100;
    const animationDuration = 1000; // 1 second
    const steps = 60; // 60 frames for smooth animation
    const increment = progressValue / steps;
    let currentProgress = 0;
    
    const interval = setInterval(() => {
      if (currentProgress < progressValue) {
        currentProgress += increment;
        setProgress(Math.min(currentProgress, progressValue));
      } else {
        clearInterval(interval);
      }
    }, animationDuration / steps);

    // Update stages completion status
    setStages(prevStages => 
      prevStages.map(stage => ({
        ...stage,
        completed: stage.id <= currentStage
      }))
    );

    return () => clearInterval(interval);
  }, [currentStage, stages.length]);

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">
          Error Resolution Progress
          <span className={`ml-2 text-sm ${severityColors[severity]}`}>
            {errorCode}
          </span>
        </h3>
        <Progress 
          value={progress} 
          className="h-2 mb-6"
          indicatorClassName={severityBgColors[severity]}
        />
      </div>

      <div className="space-y-4">
        {stages.map((stage, index) => (
          <div 
            key={stage.id}
            className={`flex items-start space-x-4 p-3 rounded-lg transition-all duration-300 ${
              stage.completed ? `${severityBgColors[severity]} bg-opacity-20` : 'bg-gray-50'
            }`}
          >
            <div className={`
              p-2 rounded-full transition-colors
              ${stage.completed ? severityColors[severity] : 'text-gray-400'}
            `}>
              {stage.icon}
            </div>
            
            <div className="flex-1">
              <h4 className={`font-medium ${
                stage.completed ? severityColors[severity] : 'text-gray-700'
              }`}>
                {stage.title}
              </h4>
              <p className="text-sm text-gray-600 mt-1">{stage.description}</p>
            </div>

            {stage.completed && (
              <Check className={`h-5 w-5 ${severityColors[severity]} animate-fade-in`} />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
