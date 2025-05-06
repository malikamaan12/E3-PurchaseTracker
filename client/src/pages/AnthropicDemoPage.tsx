import { useState, useRef, FormEvent } from "react";
import axios from "axios";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, FileImage, Send, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

/**
 * AnthropicDemoPage - A demo UI for testing Anthropic Claude AI capabilities
 * Features text and image analysis through the Anthropic API endpoints
 */
export default function AnthropicDemoPage() {
  // Text analysis state
  const [textInput, setTextInput] = useState("");
  const [textResult, setTextResult] = useState<string>("");
  const [isTextLoading, setIsTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  // Image analysis state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePrompt, setImagePrompt] = useState("Describe this image in detail");
  const [imageResult, setImageResult] = useState<string>("");
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // API status state
  const [apiStatus, setApiStatus] = useState<{
    available?: boolean;
    apiWorking?: boolean;
    model?: string;
    error?: string;
  } | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check API status
  const checkApiStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const response = await axios.get("/api/anthropic-demo/status");
      setApiStatus(response.data);
    } catch (error) {
      setApiStatus({
        available: false,
        error: error instanceof Error ? error.message : "Failed to check API status"
      });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Handle text analysis
  const handleTextAnalysis = async (e: FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    setIsTextLoading(true);
    setTextError(null);

    try {
      const response = await axios.post("/api/anthropic-demo/analyze-text", {
        text: textInput
      });

      if (response.data.success) {
        // Convert content array to display string
        const content = response.data.result;
        let resultText = "";
        
        if (Array.isArray(content)) {
          content.forEach(item => {
            if (item.type === "text") {
              resultText += item.text;
            }
          });
        }
        
        setTextResult(resultText);
      } else {
        setTextError(response.data.error || "Failed to analyze text");
      }
    } catch (error) {
      setTextError(error instanceof Error ? error.message : "An unknown error occurred");
    } finally {
      setIsTextLoading(false);
    }
  };

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setImageError(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Handle image analysis
  const handleImageAnalysis = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedImage) {
      setImageError("Please select an image first");
      return;
    }

    setIsImageLoading(true);
    setImageError(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedImage);
      formData.append("prompt", imagePrompt);

      const response = await axios.post("/api/anthropic-demo/analyze-image", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      if (response.data.success) {
        // Convert content array to display string
        const content = response.data.result;
        let resultText = "";
        
        if (Array.isArray(content)) {
          content.forEach(item => {
            if (item.type === "text") {
              resultText += item.text;
            }
          });
        }
        
        setImageResult(resultText);
      } else {
        setImageError(response.data.error || "Failed to analyze image");
      }
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "An unknown error occurred");
    } finally {
      setIsImageLoading(false);
    }
  };

  return (
    <div className="container py-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Anthropic Claude AI Demo</h1>
          <p className="text-muted-foreground mb-6">
            Experiment with Claude's capabilities for text and image analysis
          </p>

          {/* API Status Section */}
          <Card className="mb-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">API Status</CardTitle>
              <CardDescription>
                Check if the Anthropic API is available and working
              </CardDescription>
            </CardHeader>
            <CardContent>
              {apiStatus ? (
                <div className="space-y-2">
                  {apiStatus.error ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{apiStatus.error}</AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${apiStatus.available ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span>API Available: {apiStatus.available ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${apiStatus.apiWorking ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span>API Working Correctly: {apiStatus.apiWorking ? 'Yes' : 'No'}</span>
                      </div>
                      {apiStatus.model && (
                        <div className="pt-1">
                          <span className="text-sm font-medium">Model: </span>
                          <span className="text-sm">{apiStatus.model}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Click the button below to check API status</p>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                onClick={checkApiStatus}
                disabled={isCheckingStatus}
              >
                {isCheckingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Check API Status
              </Button>
            </CardFooter>
          </Card>

          {/* Tabs for Text and Image Analysis */}
          <Tabs defaultValue="text" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text">Text Analysis</TabsTrigger>
              <TabsTrigger value="image">Image Analysis</TabsTrigger>
            </TabsList>

            {/* Text Analysis Tab */}
            <TabsContent value="text" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Claude Text Analysis</CardTitle>
                  <CardDescription>
                    Ask Claude to analyze or respond to text prompts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleTextAnalysis} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="text-input">Enter your prompt</Label>
                      <Textarea
                        id="text-input"
                        placeholder="E.g., Explain the benefits of vendor management systems in 3 bullet points"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        rows={5}
                        required
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isTextLoading || !textInput.trim()}
                    >
                      {isTextLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Analyze Text
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>

                {textError && (
                  <Alert variant="destructive" className="mx-6 mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{textError}</AlertDescription>
                  </Alert>
                )}

                {textResult && (
                  <div className="mx-6 mb-6">
                    <Separator className="my-4" />
                    <h3 className="font-medium mb-2">Results:</h3>
                    <div className="bg-muted rounded-lg p-4 whitespace-pre-wrap">
                      {textResult}
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Image Analysis Tab */}
            <TabsContent value="image" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Claude Image Analysis</CardTitle>
                  <CardDescription>
                    Upload an image for Claude to analyze and describe
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleImageAnalysis} className="space-y-4">
                    <div className="space-y-2">
                      {/* Image selection */}
                      <Label htmlFor="image-upload">Upload an image</Label>
                      <div 
                        onClick={triggerFileInput}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-muted transition-colors"
                      >
                        <input
                          ref={fileInputRef}
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                        
                        {imagePreview ? (
                          <div className="text-center">
                            <img 
                              src={imagePreview} 
                              alt="Preview" 
                              className="max-h-40 mx-auto object-contain mb-2"
                            />
                            <p className="text-sm text-muted-foreground">
                              Click to change image
                            </p>
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <FileImage className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">
                              Click to select an image (max 5MB)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Prompt for image */}
                    <div className="space-y-2">
                      <Label htmlFor="image-prompt">Analysis prompt (optional)</Label>
                      <Input
                        id="image-prompt"
                        placeholder="Describe this image in detail"
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Customize what you want Claude to focus on when analyzing the image
                      </p>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isImageLoading || !selectedImage}
                    >
                      {isImageLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing Image...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Analyze Image
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>

                {imageError && (
                  <Alert variant="destructive" className="mx-6 mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{imageError}</AlertDescription>
                  </Alert>
                )}

                {imageResult && (
                  <div className="mx-6 mb-6">
                    <Separator className="my-4" />
                    <h3 className="font-medium mb-2">Analysis Results:</h3>
                    <div className="bg-muted rounded-lg p-4 whitespace-pre-wrap">
                      {imageResult}
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}