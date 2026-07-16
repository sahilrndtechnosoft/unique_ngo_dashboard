import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { diskStorage } from 'multer';
import { join, normalize } from 'path';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  IMAGE_MIME_TYPE_EXTENSIONS,
  MAX_PROFILE_PICTURE_SIZE,
} from '../../common/constants';

export function createImageUploadOptions(subdir: string): MulterOptions {
  return {
    limits: { fileSize: MAX_PROFILE_PICTURE_SIZE },
    fileFilter: (_req, file, callback) => {
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
        return callback(
          new BadRequestException(
            'Only JPEG, PNG, WEBP, and GIF images are allowed',
          ) as unknown as Error,
          false,
        );
      }
      callback(null, true);
    },
    storage: diskStorage({
      destination: (_req, _file, callback) => {
        const uploadDir = join(process.cwd(), 'uploads', subdir);
        if (!existsSync(uploadDir)) {
          mkdirSync(uploadDir, { recursive: true });
        }
        callback(null, uploadDir);
      },
      filename: (_req, file, callback) => {
        const extension = IMAGE_MIME_TYPE_EXTENSIONS[file.mimetype] ?? '.jpg';
        callback(null, `${randomUUID()}${extension}`);
      },
    }),
  };
}

/** Relative path stored in DB, e.g. `/uploads/banners/uuid.jpg` */
export function buildUploadedFilePath(subdir: string, filename: string): string {
  return `/uploads/${subdir}/${filename}`;
}

/**
 * Deletes a file under /uploads only. Accepts relative `/uploads/...`
 * or a full URL containing `/uploads/...` (legacy rows).
 */
export function deleteUploadedFile(storedPath: string | null | undefined): void {
  if (!storedPath) {
    return;
  }

  const relativePath = extractUploadsRelativePath(storedPath);
  if (!relativePath) {
    return;
  }

  const absolutePath = join(process.cwd(), relativePath);
  const uploadsRoot = join(process.cwd(), 'uploads');
  const normalized = normalize(absolutePath);

  if (!normalized.startsWith(uploadsRoot)) {
    return;
  }

  if (existsSync(normalized)) {
    unlinkSync(normalized);
  }
}

function extractUploadsRelativePath(storedPath: string): string | null {
  const marker = '/uploads/';
  const index = storedPath.indexOf(marker);
  if (index === -1) {
    return null;
  }

  return storedPath.slice(index + 1);
}
