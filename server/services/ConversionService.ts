import fs from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import mammoth from 'mammoth';
import officeToPdf from 'office-to-pdf';

export class ConversionError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ConversionError';
  }
}

export interface ConversionResult {
  outputPath: string;
  outputType: string;
  success: boolean;
  error?: string;
}

export class ConversionService {
  private readonly supportedConversions = {
    'image/png': ['image/jpeg', 'image/webp', 'application/pdf'],
    'image/jpeg': ['image/png', 'image/webp', 'application/pdf'],
    'image/webp': ['image/png', 'image/jpeg', 'application/pdf'],
    'application/pdf': ['image/png', 'image/jpeg'],
    'application/msword': ['application/pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['application/pdf'],
  };

  constructor(private uploadDir: string = 'uploads') {}

  async getAvailableFormats(inputType: string): Promise<string[]> {
    return this.supportedConversions[inputType as keyof typeof this.supportedConversions] || [];
  }

  async convertFile(
    inputPath: string,
    outputFormat: string,
    originalType: string
  ): Promise<ConversionResult> {
    try {
      const fileName = path.basename(inputPath, path.extname(inputPath));
      const outputPath = path.join(
        this.uploadDir,
        'converted',
        `${fileName}_${Date.now()}${this.getExtensionForType(outputFormat)}`
      );

      // Ensure the converted directory exists
      await fs.mkdir(path.join(this.uploadDir, 'converted'), { recursive: true });

      if (originalType.startsWith('image/')) {
        return await this.convertImage(inputPath, outputPath, outputFormat);
      }

      if (originalType === 'application/pdf' && outputFormat.startsWith('image/')) {
        return await this.convertPdfToImage(inputPath, outputPath, outputFormat);
      }

      if ((originalType === 'application/msword' || 
           originalType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') && 
           outputFormat === 'application/pdf') {
        return await this.convertDocToPdf(inputPath, outputPath);
      }

      throw new ConversionError(`Unsupported conversion from ${originalType} to ${outputFormat}`);
    } catch (error) {
      console.error('Conversion error:', error);
      throw new ConversionError(
        'Failed to convert file',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async convertImage(
    inputPath: string,
    outputPath: string,
    outputFormat: string
  ): Promise<ConversionResult> {
    const image = sharp(await fs.readFile(inputPath));

    if (outputFormat === 'application/pdf') {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();

      // Convert image to PNG for PDF embedding
      const pngBuffer = await image.png().toBuffer();
      const pngImage = await pdfDoc.embedPng(pngBuffer);

      // Calculate dimensions to fit the page
      const { width, height } = pngImage.scale(1);
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width,
        height,
      });

      await fs.writeFile(outputPath, await pdfDoc.save());
    } else {
      const format = outputFormat.split('/')[1];
      await image[format]().toFile(outputPath);
    }

    return {
      outputPath,
      outputType: outputFormat,
      success: true
    };
  }

  private async convertPdfToImage(
    inputPath: string,
    outputPath: string,
    outputFormat: string
  ): Promise<ConversionResult> {
    // Implementation will be added in next iteration
    throw new ConversionError('PDF to image conversion not implemented yet');
  }

  private async convertDocToPdf(
    inputPath: string,
    outputPath: string
  ): Promise<ConversionResult> {
    const docxBuffer = await fs.readFile(inputPath);
    const pdfBuffer = await officeToPdf(docxBuffer);
    await fs.writeFile(outputPath, pdfBuffer);

    return {
      outputPath,
      outputType: 'application/pdf',
      success: true
    };
  }

  private getExtensionForType(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    return extensions[mimeType] || '.bin';
  }
}

export const conversionService = new ConversionService();
