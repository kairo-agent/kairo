/**
 * Extract a thumbnail from a video using Canvas API.
 * Works with both File objects and URLs.
 */

/**
 * Extracts a thumbnail from a video file at a given time offset.
 * Returns a data URL (base64 JPEG) for immediate display.
 */
export function extractThumbnailFromFile(file: File, timeSeconds = 0.5): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;

    video.onloadedmetadata = () => {
      // Seek to the desired time (or end if video is shorter)
      video.currentTime = Math.min(timeSeconds, video.duration * 0.1 || timeSeconds);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video'));
    };
  });
}

/**
 * Extracts a thumbnail from a video URL.
 * Uses crossOrigin="anonymous" for CORS - requires proper headers from storage.
 * Falls back gracefully if CORS blocks the canvas read.
 */
export function extractThumbnailFromUrl(videoUrl: string, timeSeconds = 0.5): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;

    const timeout = setTimeout(() => {
      resolve(null); // Timeout fallback
    }, 8000);

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(timeSeconds, video.duration * 0.1 || timeSeconds);
    };

    video.onseeked = () => {
      try {
        clearTimeout(timeout);
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      } catch {
        // CORS tainted canvas - fall back to null
        resolve(null);
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
  });
}
