import { Request, Response, NextFunction, Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { analyzeText, analyzeImage, checkApiStatus } from '../utils/anthropic-analyzer';

// Create multer instance for handling file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(process.cwd(), 'uploads/temp');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const fileExt = path.extname(file.originalname);
    cb(null, `anthropic-${uniqueSuffix}${fileExt}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow images for this demo
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed for this demo'));
    }
    cb(null, true);
  },
});

/**
 * Register Anthropic demo routes
 */
export function registerAnthropicDemoRoutes(router: Router): void {
  // Simple text analysis endpoint
  router.post('/anthropic-demo/analyze-text', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      
      const result = await analyzeText(text);
      
      res.json({
        success: true,
        result,
      });
    } catch (error) {
      console.error('Error in Anthropic text analysis endpoint:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  });
  
  // Multimodal image analysis endpoint
  router.post(
    '/anthropic-demo/analyze-image',
    upload.single('image'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'Image file is required' });
        }
        
        const { prompt } = req.body;
        const imagePath = req.file.path;
        
        const result = await analyzeImage(imagePath, prompt || 'Describe this image in detail');
        
        // Clean up the temporary file
        fs.unlinkSync(imagePath);
        
        res.json({
          success: true,
          result,
        });
      } catch (error) {
        console.error('Error in Anthropic image analysis endpoint:', error);
        
        // Clean up file if it exists
        if (req.file && req.file.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkError) {
            console.error('Error deleting temporary file:', unlinkError);
          }
        }
        
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred during image analysis',
          details: process.env.NODE_ENV === 'development' ? String(error) : undefined
        });
      }
    }
  );
  
  // Debug endpoint to check if Anthropic API is available
  router.get('/anthropic-demo/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await checkApiStatus();
      res.json(status);
    } catch (error) {
      console.error('Error checking Anthropic API status:', error);
      res.status(500).json({
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred while checking API status',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  });
}
