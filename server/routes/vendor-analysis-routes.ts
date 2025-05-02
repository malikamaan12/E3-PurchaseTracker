import { Request, Response, NextFunction, Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { analyzeVendorProfile, analyzeVendorPerformance, analyzeVendorDocument } from '../utils/vendor-analyzer';
import { selectVendorSchema } from '../../db/schema';
import { db } from '../../db';
import { vendors, vendorPerformance } from '../../db/schema';
import { eq } from 'drizzle-orm';

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(process.cwd(), 'uploads/vendor-documents');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const fileExt = path.extname(file.originalname);
    cb(null, `vendor-doc-${uniqueSuffix}${fileExt}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for documents
  },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs (for document analysis)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Only image files and PDFs are allowed'));
    }
    cb(null, true);
  },
});

/**
 * Register vendor analysis routes
 */
export function registerVendorAnalysisRoutes(router: Router): void {
  // Analyze vendor profile
  router.post('/vendor-analysis/profile/:vendorId', async (req: Request, res: Response) => {
    try {
      const vendorId = parseInt(req.params.vendorId);
      
      if (isNaN(vendorId)) {
        return res.status(400).json({ error: 'Invalid vendor ID' });
      }
      
      // Get vendor from database
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, vendorId),
      });
      
      if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found' });
      }
      
      // Get vendor performance data
      const performance = await db.query.vendorPerformance.findMany({
        where: eq(vendorPerformance.vendorId, vendorId),
      });
      
      // Prepare vendor info for analysis
      const vendorInfo = {
        companyName: vendor.companyName,
        industry: vendor.industry || undefined,
        description: vendor.description || undefined,
        performance: performance.length > 0 ? performance : undefined,
        history: vendor.history || undefined,
        contactInfo: {
          contactPerson: vendor.contactPerson,
          contactNumber: vendor.contactNumber,
          email: vendor.email,
        },
      };
      
      const analysisResult = await analyzeVendorProfile(vendorInfo);
      
      res.json({
        success: true,
        vendorId,
        vendorName: vendor.companyName,
        analysis: analysisResult,
      });
    } catch (error) {
      console.error('Error analyzing vendor profile:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  });
  
  // Analyze vendor performance
  router.post('/vendor-analysis/performance/:vendorId', async (req: Request, res: Response) => {
    try {
      const vendorId = parseInt(req.params.vendorId);
      
      if (isNaN(vendorId)) {
        return res.status(400).json({ error: 'Invalid vendor ID' });
      }
      
      // Get vendor from database
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, vendorId),
      });
      
      if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found' });
      }
      
      // Get vendor performance data
      const performance = await db.query.vendorPerformance.findMany({
        where: eq(vendorPerformance.vendorId, vendorId),
      });
      
      if (performance.length === 0) {
        return res.status(404).json({ error: 'No performance data found for this vendor' });
      }
      
      const analysisResult = await analyzeVendorPerformance(performance);
      
      res.json({
        success: true,
        vendorId,
        vendorName: vendor.companyName,
        analysis: analysisResult,
      });
    } catch (error) {
      console.error('Error analyzing vendor performance:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  });
  
  // Analyze vendor document
  router.post(
    '/vendor-analysis/document/:vendorId',
    upload.single('document'),
    async (req: Request, res: Response) => {
      try {
        const vendorId = parseInt(req.params.vendorId);
        
        if (isNaN(vendorId)) {
          return res.status(400).json({ error: 'Invalid vendor ID' });
        }
        
        if (!req.file) {
          return res.status(400).json({ error: 'Document file is required' });
        }
        
        const { documentType } = req.body;
        
        if (!documentType) {
          return res.status(400).json({ error: 'Document type is required' });
        }
        
        // Get vendor from database
        const vendor = await db.query.vendors.findFirst({
          where: eq(vendors.id, vendorId),
        });
        
        if (!vendor) {
          return res.status(404).json({ error: 'Vendor not found' });
        }
        
        const imagePath = req.file.path;
        
        const analysisResult = await analyzeVendorDocument(imagePath, documentType);
        
        // Clean up temporary file
        fs.unlinkSync(imagePath);
        
        res.json({
          success: true,
          vendorId,
          vendorName: vendor.companyName,
          documentType,
          analysis: analysisResult,
        });
      } catch (error) {
        console.error('Error analyzing vendor document:', error);
        
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
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          details: process.env.NODE_ENV === 'development' ? String(error) : undefined
        });
      }
    }
  );
}
