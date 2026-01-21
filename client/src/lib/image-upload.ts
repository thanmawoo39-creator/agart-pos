/**
 * Image Upload Utility
 * Centralized image handling for payment slips and other uploads
 */

export interface ImageValidationResult {
    valid: boolean;
    error?: string;
}

export interface ImageUploadOptions {
    maxSizeMB?: number;
    allowedTypes?: string[];
    maxWidth?: number;
    maxHeight?: number;
}

const DEFAULT_OPTIONS: ImageUploadOptions = {
    maxSizeMB: 5,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxWidth: 4096,
    maxHeight: 4096,
};

/**
 * Validate an image file
 */
export function validateImage(
    file: File,
    options: ImageUploadOptions = {}
): ImageValidationResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Check file type
    if (!opts.allowedTypes!.includes(file.type)) {
        return {
            valid: false,
            error: `Invalid file type. Allowed types: ${opts.allowedTypes!.join(', ')}`,
        };
    }

    // Check file size
    const maxSizeBytes = opts.maxSizeMB! * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        return {
            valid: false,
            error: `File too large. Maximum size: ${opts.maxSizeMB}MB`,
        };
    }

    return { valid: true };
}

/**
 * Convert file to base64 string
 */
export function convertToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            resolve(reader.result as string);
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Validate image dimensions
 */
export async function validateImageDimensions(
    file: File,
    options: ImageUploadOptions = {}
): Promise<ImageValidationResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            if (opts.maxWidth && img.width > opts.maxWidth) {
                resolve({
                    valid: false,
                    error: `Image width too large. Maximum: ${opts.maxWidth}px`,
                });
                return;
            }

            if (opts.maxHeight && img.height > opts.maxHeight) {
                resolve({
                    valid: false,
                    error: `Image height too large. Maximum: ${opts.maxHeight}px`,
                });
                return;
            }

            resolve({ valid: true });
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({
                valid: false,
                error: 'Failed to load image',
            });
        };

        img.src = url;
    });
}

/**
 * Compress image if needed (client-side)
 */
export async function compressImage(
    file: File,
    maxSizeMB: number = 1
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions if needed
                const maxDimension = 2048;
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = (height * maxDimension) / width;
                        width = maxDimension;
                    } else {
                        width = (width * maxDimension) / height;
                        height = maxDimension;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Try different quality levels
                let quality = 0.9;
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to compress image'));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target?.result as string;
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Upload payment slip (full validation and conversion)
 */
export async function uploadPaymentSlip(
    file: File,
    options: ImageUploadOptions = {}
): Promise<string> {
    // Validate file type and size
    const validation = validateImage(file, options);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Validate dimensions
    const dimensionValidation = await validateImageDimensions(file, options);
    if (!dimensionValidation.valid) {
        throw new Error(dimensionValidation.error);
    }

    // Convert to base64
    const base64 = await convertToBase64(file);

    return base64;
}

/**
 * Generate filename for uploaded image
 */
export function generateImageFilename(prefix: string = 'image'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}.jpg`;
}
