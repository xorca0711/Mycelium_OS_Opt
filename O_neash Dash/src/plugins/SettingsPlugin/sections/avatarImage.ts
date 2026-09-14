const INPUT_LIMIT = 10 * 1024 * 1024;
const OUTPUT_LIMIT = 512 * 1024;

export function avatarDimensions(width: number, height: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width * height > 40_000_000) {
    throw new Error('Choose an image with valid dimensions and no more than 40 million pixels.');
  }
  const scale = Math.min(1, 256 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function isRasterAvatar(bytes: Uint8Array): boolean {
  const matches = (offset: number, expected: readonly number[]) => expected.every((value, index) => bytes[offset + index] === value);
  return matches(0, [137, 80, 78, 71, 13, 10, 26, 10]) || matches(0, [255, 216, 255])
    || matches(0, [71, 73, 70, 56, 55, 97]) || matches(0, [71, 73, 70, 56, 57, 97])
    || (matches(0, [82, 73, 70, 70]) && matches(8, [87, 69, 66, 80]));
}

export async function prepareAvatar(file: File): Promise<string> {
  if (file.size === 0 || file.size > INPUT_LIMIT) throw new Error('Choose a PNG, JPEG, GIF, or WebP image smaller than 10 MB.');
  if (!isRasterAvatar(new Uint8Array(await file.slice(0, 12).arrayBuffer()))) {
    throw new Error('Use a PNG, JPEG, GIF, or WebP image. SVG files are not supported.');
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => { throw new Error('This image could not be opened. Try another image.'); });
    const size = avatarDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image resizing is unavailable. Try reopening Settings.');
    context.drawImage(image, 0, 0, size.width, size.height);
    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length > OUTPUT_LIMIT) throw new Error('The resized image is still too large. Choose a simpler image.');
    return dataUrl;
  } finally { URL.revokeObjectURL(url); }
}
