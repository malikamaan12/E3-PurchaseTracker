import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MoodBoardProps {
  companyName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  onGenerated?: (imageUrls: string[]) => void;
}

export default function BrandMoodBoardGenerator({
  companyName = "",
  primaryColor = "#71569E",
  secondaryColor = "#F0F0FA",
  accentColor = "#191160",
  onGenerated,
}: MoodBoardProps) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);

  const generateMoodboard = useMutation({
    mutationFn: async (data: { prompt: string; colors: string[] }) => {
      const response = await fetch("/api/generate-moodboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: data.prompt,
          colors: [primaryColor, secondaryColor, accentColor],
          companyName,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedImages(data.images);
      onGenerated?.(data.images);
      toast({
        title: "Success",
        description: "Mood board generated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate mood board",
        variant: "destructive",
      });
    },
  });

  const handleGenerateMoodBoard = () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a description for your brand mood",
        variant: "destructive",
      });
      return;
    }

    generateMoodboard.mutate({
      prompt,
      colors: [primaryColor, secondaryColor, accentColor],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand Mood Board Generator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Brand Mood Description</Label>
          <Input
            placeholder="e.g. Modern, minimalistic, tech-focused brand that conveys innovation and trust"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Describe the mood and feel you want for your brand. Our AI will generate a mood board based on your description and brand colors.
          </p>
        </div>

        <Button
          onClick={handleGenerateMoodBoard}
          disabled={generateMoodboard.isPending}
          className="w-full"
        >
          {generateMoodboard.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          Generate Mood Board
        </Button>

        {generatedImages.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mt-6">
            {generatedImages.map((image, index) => (
              <div
                key={index}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden border",
                  index === 0 && "col-span-2 aspect-[2/1]"
                )}
              >
                <img
                  src={image}
                  alt={`Mood board image ${index + 1}`}
                  className="object-cover w-full h-full"
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
