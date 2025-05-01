import { Request, Response, NextFunction, Router } from 'express';
import { claudeAIService } from '../services/ClaudeAIService';

class ValidationError extends Error {
  details: any;
  constructor(message: string, details: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * Register all Claude AI-related routes
 */
export function registerClaudeAIRoutes(router: Router): void {
  // Endpoint for analyzing purchase request details
  router.post(
    '/claude-ai/analyze-request',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const { requestDetails } = req.body;
        
        if (!requestDetails) {
          throw new ValidationError('Missing request details', {
            requestDetails: 'Request details are required'
          });
        }

        const analysis = await claudeAIService.analyzeRequest(requestDetails);
        res.json(analysis);
      } catch (error) {
        console.error('Error in analyze-request endpoint:', error);
        next(error);
      }
    }
  );

  // Endpoint for recommending vendors based on request
  router.post(
    '/claude-ai/recommend-vendors',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const { requestDetails, vendorOptions } = req.body;
        
        if (!requestDetails || !vendorOptions) {
          throw new ValidationError('Missing required data', {
            details: 'Request details and vendor options are required'
          });
        }

        const recommendations = await claudeAIService.recommendVendors(requestDetails, vendorOptions);
        res.json(recommendations);
      } catch (error) {
        console.error('Error in recommend-vendors endpoint:', error);
        next(error);
      }
    }
  );

  // Endpoint for validating attachments
  router.post(
    '/claude-ai/validate-attachments',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const { attachmentData } = req.body;
        
        if (!attachmentData) {
          throw new ValidationError('Missing attachment data', {
            attachmentData: 'Attachment data is required'
          });
        }

        const validation = await claudeAIService.validateAttachments(attachmentData);
        res.json(validation);
      } catch (error) {
        console.error('Error in validate-attachments endpoint:', error);
        next(error);
      }
    }
  );

  // Endpoint for generating executive summaries
  router.post(
    '/claude-ai/executive-summary',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const { requestData } = req.body;
        
        if (!requestData) {
          throw new ValidationError('Missing request data', {
            requestData: 'Request data is required'
          });
        }

        const summary = await claudeAIService.generateExecutiveSummary(requestData);
        res.json({ summary });
      } catch (error) {
        console.error('Error in executive-summary endpoint:', error);
        next(error);
      }
    }
  );
}
