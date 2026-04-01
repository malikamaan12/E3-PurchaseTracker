import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { conversionService } from "../services/ConversionService";
import { ValidationError, AppError } from "../utils/errors";
import path from "path";
import fs from "fs/promises";

const router = Router();

router.get("/formats", async (req, res, next) => {
  try {
    const { type } = req.query;
    if (!type || typeof type !== "string") {
      throw new ValidationError("Invalid input", { type: ["Source type is required"] });
    }
    const formats = await conversionService.getAvailableFormats(type);
    res.json(formats);
  } catch (error) {
    next(error);
  }
});

router.post("/convert", async (req, res, next) => {
  try {
    const { sourceFormat, targetFormat, filePath } = req.body;
    if (!sourceFormat || !targetFormat || !filePath) {
      throw new ValidationError("Invalid input", { details: "Source format, target format, and file path are required" });
    }

    const absolutePath = path.join(process.cwd(), filePath.replace(/^\/uploads\//, "uploads/"));
    await fs.access(absolutePath);

    const result = await conversionService.convertFile(absolutePath, targetFormat, sourceFormat);
    res.json({
      success: true,
      fileUrl: `/uploads/converted/${path.basename(result.outputPath)}`,
      outputType: result.outputType,
      size: (await fs.stat(result.outputPath)).size,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("ENOENT")) {
      next(new AppError("Source file not found", 404));
    } else {
      next(error);
    }
  }
});

export default router;
