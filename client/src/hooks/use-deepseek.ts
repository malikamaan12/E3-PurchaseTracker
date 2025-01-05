import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { deepseekService } from '@/services/deepseek';

export function useDeepseek() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const generateText = async (prompt: string) => {
    setIsLoading(true);
    try {
      const response = await deepseekService.generateText(prompt);
      return response;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate text',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const generateImage = async (prompt: string) => {
    setIsLoading(true);
    try {
      const response = await deepseekService.generateImage(prompt);
      return response;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate image',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeImage = async (imageUrl: string, prompt: string) => {
    setIsLoading(true);
    try {
      const response = await deepseekService.analyzeImage(imageUrl, prompt);
      return response;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to analyze image',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const generateEmbeddings = async (text: string) => {
    setIsLoading(true);
    try {
      const response = await deepseekService.embeddingGeneration(text);
      return response;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate embeddings',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    generateText,
    generateImage,
    analyzeImage,
    generateEmbeddings,
  };
}
