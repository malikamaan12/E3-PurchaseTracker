import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { analyzeText, analyzeImage, analyzeDocument, analyzeVendorPerformance, anthropicErrorHandler } from '../utils/anthropic-client';
import { AppError } from '../utils/errors';

const router = Router();

// Configure storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'ai-analysis');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs
    const fileTypes = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image, PDF, and document files are allowed!'));
    }
  },
});

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: true, message: 'Authentication required' });
  }
  next();
};

// Middleware to check if user is admin
const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: true, message: 'Authentication required' });
  }
  
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: true, message: 'Admin access required' });
  }
  
  next();
};

// Apply error handling middleware
router.use(anthropicErrorHandler);

// Text analysis endpoint 
router.post('/analyze/text', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, options = {} } = req.body;
    
    if (!text) {
      return res.status(400).json({
        error: true,
        message: 'Text is required',
      });
    }
    
    const result = await analyzeText(text, options);
    
    return res.json({
      success: true,
      result,
    });
  } catch (error) {
    next(error);
  }
});

// Image analysis endpoint
router.post('/analyze/image', isAuthenticated, upload.single('image'), async (req, res, next) => {
  try {
    const { prompt } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        error: true,
        message: 'Image file is required',
      });
    }
    
    if (!prompt) {
      return res.status(400).json({
        error: true,
        message: 'Prompt is required for image analysis',
      });
    }
    
    // Read file and convert to base64
    const imageBuffer = fs.readFileSync(file.path);
    const base64Image = imageBuffer.toString('base64');
    
    // Delete file after reading
    fs.unlinkSync(file.path);
    
    const result = await analyzeImage(base64Image, prompt);
    
    return res.json({
      success: true,
      result,
    });
  } catch (error) {
    next(error);
  }
});

// Document analysis endpoint
router.post('/analyze/document', isAuthenticated, upload.single('document'), async (req, res, next) => {
  try {
    const { documentType } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        error: true,
        message: 'Document file is required',
      });
    }
    
    // For simplicity, we'll just read the file as text
    // In a real application, you'd need to parse PDFs, Word docs, etc.
    const document = fs.readFileSync(file.path, 'utf-8');
    
    // Delete file after reading
    fs.unlinkSync(file.path);
    
    const result = await analyzeDocument(document, {
      documentType: documentType || 'business document',
    });
    
    return res.json({
      success: true,
      result,
    });
  } catch (error) {
    next(error);
  }
});

// Vendor analysis endpoint
router.post('/analyze/vendor', isAuthenticated, async (req, res, next) => {
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
      result,
    });
  } catch (error) {
    next(error);
  }
});

// Admin-only endpoint for analyzing sensitive data
router.post('/analyze/sensitive', isAuthenticated, isAdmin, async (req, res, next) => {
  try {
    const { text, context } = req.body;
    
    if (!text) {
      return res.status(400).json({
        error: true,
        message: 'Text is required',
      });
    }
    
    const system = "You're analyzing sensitive business information. Please be thorough but discreet.";
    
    const result = await analyzeText(text, {
      system,
      maxTokens: 2048,
      temperature: 0.3,
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