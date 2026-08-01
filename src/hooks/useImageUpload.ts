import { useState, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';

interface UseImageUploadOptions {
  bucket?: string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

interface UseImageUploadReturn {
  upload: (file: File, path: string) => Promise<string | null>;
  isUploading: boolean;
  preview: string | null;
  error: string | null;
  setPreview: (url: string | null) => void;
  clearPreview: () => void;
}

/**
 * Compresses an image using Canvas API before upload.
 * Returns a Blob with reduced dimensions and quality.
 */
function compressImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Calculate new dimensions maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

export function useImageUpload(options: UseImageUploadOptions = {}): UseImageUploadReturn {
  const {
    bucket = 'public_assets',
    maxWidth = 1600,
    maxHeight = 1200,
    quality = 0.85,
  } = options;

  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File, path: string): Promise<string | null> => {
      setIsUploading(true);
      setError(null);

      try {
        // Create preview immediately
        const previewUrl = URL.createObjectURL(file);
        setPreview(previewUrl);

        // Compress the image
        const compressed = await compressImage(file, maxWidth, maxHeight, quality);

        // Generate unique filename
        const ext = 'webp';
        const fileName = `${path}_${Date.now()}.${ext}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, compressed, {
            contentType: 'image/webp',
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
        const publicUrl = data.publicUrl;

        // Update preview with final URL
        setPreview(publicUrl);
        URL.revokeObjectURL(previewUrl);

        return publicUrl;
      } catch (err: any) {
        setError(err.message || 'Erro ao fazer upload');
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [bucket, maxWidth, maxHeight, quality]
  );

  const clearPreview = useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  return { upload, isUploading, preview, error, setPreview, clearPreview };
}
