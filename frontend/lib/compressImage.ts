/** Client-side image compression before upload (listings + avatars). */

export type CompressOptions = {
  /** Longest edge in pixels */
  maxEdge?: number;
  quality?: number;
};

const LISTING_DEFAULTS: Required<CompressOptions> = { maxEdge: 1280, quality: 0.8 };
const AVATAR_DEFAULTS: Required<CompressOptions> = { maxEdge: 400, quality: 0.72 };

export function compressImageForListing(file: File): Promise<string> {
  return compressImage(file, LISTING_DEFAULTS);
}

export function compressImageForAvatar(file: File): Promise<string> {
  return compressImage(file, AVATAR_DEFAULTS);
}

export function compressImage(
  file: File,
  options: CompressOptions = LISTING_DEFAULTS,
): Promise<string> {
  const maxEdge = options.maxEdge ?? LISTING_DEFAULTS.maxEdge;
  const quality = options.quality ?? LISTING_DEFAULTS.quality;

  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file"));
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not process image"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}
