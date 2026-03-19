/**
 * KAIRO - Client-side Image Compression
 *
 * Uses native Canvas API to compress and resize images before upload.
 * No external libraries required.
 *
 * Rules:
 * - Max dimension: 1080px on longest side (maintains aspect ratio)
 * - Min dimension: 200px on both sides
 * - Output: JPEG at 85% quality
 * - Client-side only (uses Image, Canvas, URL.createObjectURL)
 */

export interface CompressImageOptions {
  maxDimension: number;
  quality: number;
  minDimension: number;
}

export interface CompressResult {
  file: File;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

const DEFAULT_OPTIONS: CompressImageOptions = {
  maxDimension: 1080,
  quality: 0.85,
  minDimension: 200,
};

/**
 * Loads an image file and returns its natural dimensions
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen'));
    };

    img.src = url;
  });
}

/**
 * Compresses and resizes an image file using Canvas API
 *
 * @param file - The image file to compress
 * @param options - Compression options (optional)
 * @returns Compressed image as a File with metadata
 * @throws Error if image is too small (< 200x200)
 */
export async function compressImage(
  file: File,
  options?: Partial<CompressImageOptions>
): Promise<CompressResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const img = await loadImage(file);

  const { naturalWidth: origW, naturalHeight: origH } = img;

  // Reject images that are too small
  if (origW < opts.minDimension || origH < opts.minDimension) {
    throw new Error(
      `La imagen debe ser al menos ${opts.minDimension}x${opts.minDimension} pixeles. ` +
      `Actual: ${origW}x${origH}`
    );
  }

  // Calculate new dimensions (max on longest side, maintain ratio)
  let newW = origW;
  let newH = origH;

  if (origW > opts.maxDimension || origH > opts.maxDimension) {
    if (origW >= origH) {
      newW = opts.maxDimension;
      newH = Math.round((origH / origW) * opts.maxDimension);
    } else {
      newH = opts.maxDimension;
      newW = Math.round((origW / origH) * opts.maxDimension);
    }
  }

  // Draw to canvas at new dimensions
  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo crear contexto Canvas');
  }

  ctx.drawImage(img, 0, 0, newW, newH);

  // Convert to JPEG blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('No se pudo comprimir la imagen'));
      },
      'image/jpeg',
      opts.quality
    );
  });

  // Convert blob to File
  const compressedFile = new File(
    [blob],
    file.name.replace(/\.[^.]+$/, '.jpg'),
    { type: 'image/jpeg' }
  );

  return {
    file: compressedFile,
    width: newW,
    height: newH,
    originalSize: file.size,
    compressedSize: compressedFile.size,
  };
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
