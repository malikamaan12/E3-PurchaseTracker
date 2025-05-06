import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { analyzeText, analyzeImage, analyzeDocument, analyzeVendorPerformance, anthropicErrorHandler } from '../utils/anthropic-client';

// Configure multer for handling file uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'temp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${file.fieldname}-${uniqueSuffix}-${encodeURIComponent(file.originalname)}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

const router = Router();

// Add custom error handler middleware
router.use(anthropicErrorHandler);

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

// Route for text analysis
router.post('/analyze/text', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, options } = req.body;
    
    if (!text) {
      return res.status(400).json({
        error: true,
        message: 'Text is required',
      });
    }
    
    const analysisOptions = options || {};
    const result = await analyzeText(text, analysisOptions);
    
    return res.json({
      success: true,
      result,
    });
  } catch (error) {
    next(error);
  }
});

// Route for image analysis
router.post('/analyze/image', isAuthenticated, upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: true,
        message: 'Image file is required',
      });
    }
    
    const { prompt, options } = req.body;
    const analysisPrompt = prompt || 'Analyze this image in detail and describe what you see.';
    const analysisOptions = options ? JSON.parse(options) : {};
    
    // Read the uploaded file as base64
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    
    // Clean up the temporary file after reading
    fs.unlinkSync(req.file.path);
    
    const result = await analyzeImage(base64Image, analysisPrompt, analysisOptions);
    
    return res.json({
      success: true,
      result,
    });
  } catch (error) {
    next(error);
  }
});

// Route for document analysis
router.post('/analyze/document', isAuthenticated, upload.single('document'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: true,
        message: 'Document file is required',
      });
    }
    
    const { options } = req.body;
    const analysisOptions = options ? JSON.parse(options) : {};
    
    // Read the uploaded file content
    const documentContent = fs.readFileSync(req.file.path, 'utf-8');
    
    // Clean up the temporary file after reading
    fs.unlinkSync(req.file.path);
    
    const result = await analyzeDocument(documentContent, {
      ...analysisOptions,
      documentType: req.file.originalname.split('.').pop()?.toLowerCase() || 'unknown',
    });
    
    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// Route for vendor analysis
router.post('/analyze/vendor', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vendorData } = req.body;
    
    if (!vendorData) {
      return res.status(400).json({
        error: true,
        message: 'Vendor data is required',
      });
    }
    
    const result = await analyzeVendorPerformance(vendorData);
    
    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// Admin-only route for sensitive data analysis
router.post('/analyze/sensitive', isAuthenticated, isAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, options } = req.body;
    
    if (!text) {
      return res.status(400).json({
        error: true,
        message: 'Text is required',
      });
    }
    
    const analysisOptions = options || {};
    const system = "You're an expert at analyzing potentially sensitive business information. Identify any confidential information, PII, or security concerns.";
    
    const result = await analyzeText(text, {
      ...analysisOptions,
      system,
      temperature: 0.2, // Lower temperature for more factual/consistent responses
    });
    
    return res.json({
      success: true,
      result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;