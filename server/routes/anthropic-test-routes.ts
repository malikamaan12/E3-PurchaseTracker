import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { testTextAnalysis, testImageAnalysis, testVendorAnalysis } from '../utils/anthropic-test';

const router = Router();

// Middleware to check if the user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: 'Not authenticated' });
};

// Middleware to check if the user is an admin
const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && (req.user as any).role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden - Admin only access' });
};

// Test endpoint for text analysis
router.post('/test/text', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        error: true,
        message: 'Text is required',
      });
    }
    
    const result = await testTextAnalysis(text);
    
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

// Test endpoint for image analysis
router.post('/test/image', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { imageBase64, prompt } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({
        error: true,
        message: 'Image base64 data is required',
      });
    }
    
    const analysisPrompt = prompt || 'Analyze this image in detail and describe what you see.';
    
    const result = await testImageAnalysis(imageBase64, analysisPrompt);
    
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

// Test endpoint for vendor analysis
router.post('/test/vendor', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vendorData } = req.body;
    
    if (!vendorData) {
      return res.status(400).json({
        error: true,
        message: 'Vendor data is required',
      });
    }
    
    const result = await testVendorAnalysis(vendorData);
    
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;