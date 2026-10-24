/**
 * Client-Side Image Compression for AmbiBites
 * Automatically reduces 5MB-10MB mobile camera photos down to ~150KB - 250KB
 * before uploading to Cloudflare R2 CDN.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0 (default 0.8)
  mimeType?: string; // 'image/jpeg' or 'image/webp'
}

export interface CompressionResult {
  file: File;
  originalSizeKb: number;
  compressedSizeKb: number;
  savedPercent: number;
  previewUrl: string;
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.8,
    mimeType = "image/jpeg",
  } = options;

  const originalSizeKb = Math.round(file.size / 1024);

  // If already under 150KB and a standard format, no need to over-compress
  if (file.size <= 150 * 1024 && (file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp")) {
    return {
      file,
      originalSizeKb,
      compressedSizeKb: originalSizeKb,
      savedPercent: 0,
      previewUrl: URL.createObjectURL(file),
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Unable to create canvas context"));
          return;
        }

        // Smooth image downscaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas toBlob failed"));
              return;
            }

            const compressedSizeKb = Math.round(blob.size / 1024);
            const savedPercent = Math.max(
              0,
              Math.round(((file.size - blob.size) / file.size) * 100)
            );

            // Reconstruct clean filename with jpg extension
            const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
            const newFileName = `${baseName}.jpg`;

            const compressedFile = new File([blob], newFileName, {
              type: mimeType,
              lastModified: Date.now(),
            });

            const previewUrl = URL.createObjectURL(blob);

            console.log(
              `⚡ Compressed "${file.name}": ${originalSizeKb} KB ➔ ${compressedSizeKb} KB (${savedPercent}% saved)`
            );

            resolve({
              file: compressedFile,
              originalSizeKb,
              compressedSizeKb,
              savedPercent,
              previewUrl,
            });
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => reject(new Error("Failed to load image for compression"));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
