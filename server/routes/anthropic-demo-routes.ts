import { Request, Response, NextFunction, Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const CLAUDE_MODEL = 'claude-3-7-sonnet-20250219';

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

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Type for valid image media types in Anthropic API
type AnthropicImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

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
      
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: text }],
      });
      
      res.json({
        success: true,
        result: response.content,
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
        
        // Read image as base64
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        
        // Get file extension and determine mime type
        const fileExt = path.extname(req.file.originalname).toLowerCase();
        let mimeType: AnthropicImageMediaType = 'image/jpeg';
        
        if (fileExt === '.png') {
          mimeType = 'image/png';
        } else if (fileExt === '.gif') {
          mimeType = 'image/gif';
        } else if (fileExt === '.webp') {
          mimeType = 'image/webp';
        }
        
        const response = await anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt || 'Describe this image in detail'
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64Image
                }
              }
            ]
          }]
        });
        
        // Clean up the temporary file
        fs.unlinkSync(imagePath);
        
        res.json({
          success: true,
          result: response.content,
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
      // Simple API check
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Respond with the exact text: "Anthropic API is working correctly."' }],
      });
      
      const contentBlock = response.content[0];
      if (contentBlock.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }
      
      const isWorking = contentBlock.text.includes('Anthropic API is working correctly');
      
      res.json({
        available: true,
        apiWorking: isWorking,
        model: CLAUDE_MODEL
      });
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
