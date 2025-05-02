/**
 * API endpoints for UI theme analysis and color scheme recommendations
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { analyzeUiColors, generateAccessibleColorPalette } from '../utils/ui-analyzer';
import { AppError } from '../utils/errors';
import { checkApiKeyConfigured } from '../utils/anthropic-config';

const router = Router();
const upload = multer({ dest: 'uploads/temp/' });

/**
 * Analyze a screenshot and provide UI color improvement suggestions
 * POST /api/ui-analysis/analyze-screenshot
 */
router.post('/analyze-screenshot', upload.single('screenshot'), async (req: Request, res: Response) => {
  try {
    // Check if Claude API key is configured
    if (!checkApiKeyConfigured()) {
      throw new AppError('Claude API key not configured', 'error', 401);
    }

    // Get current color scheme from request body
    const currentColorScheme = req.body.colorScheme ? JSON.parse(req.body.colorScheme) : null;
    if (!currentColorScheme) {
      throw new AppError('Current color scheme is required', 'error', 400);
    }

    // Check for screenshot file
    if (!req.file) {
      throw new AppError('Screenshot file is required', 'error', 400);
    }

    // Read and convert image file to base64
    const filePath = req.file.path;
    const fileData = fs.readFileSync(filePath);
    const base64Image = fileData.toString('base64');

    // Clean up the temporary file
    fs.unlinkSync(filePath);

    // Analyze the screenshot
    const analysis = await analyzeUiColors(base64Image, currentColorScheme);

    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing UI:', error);
    if (error instanceof AppError) {
      res.status(error.status || 500).json({
        message: error.message,
        status: error.status,
        severity: error.severity
      });
    } else {
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Unknown error during UI analysis',
        status: 500,
        severity: 'error'
      });
    }
  }
});

/**
 * Generate an accessible color palette based on specified base colors
 * POST /api/ui-analysis/generate-palette
 */
router.post('/generate-palette', async (req: Request, res: Response) => {
  try {
    // Check if Claude API key is configured
    if (!checkApiKeyConfigured()) {
      throw new AppError('Claude API key not configured', 'error', 401);
    }

    // Get base colors from request body
    const { primary, secondary, background } = req.body;
    if (!primary || !secondary || !background) {
      throw new AppError('Primary, secondary, and background colors are required', 'error', 400);
    }

    // Generate the palette
    const palette = await generateAccessibleColorPalette({
      primary,
      secondary,
      background
    });

    res.json(palette);
  } catch (error) {
    console.error('Error generating color palette:', error);
    if (error instanceof AppError) {
      res.status(error.status || 500).json({
        message: error.message,
        status: error.status,
        severity: error.severity
      });
    } else {
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Unknown error during palette generation',
        status: 500,
        severity: 'error'
      });
    }
  }
});

export default router;