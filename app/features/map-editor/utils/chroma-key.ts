import { PORTRAIT_CHROMA_KEY } from "../portrait-background";

/**
 * Removes a white background from a base64 image via flood-fill from edges.
 * Returns a PNG with transparency where the background was.
 */

function chromaDistance(data: Uint8ClampedArray, idx: number): number {
  return Math.max(
    Math.abs(data[idx] - PORTRAIT_CHROMA_KEY.red),
    Math.abs(data[idx + 1] - PORTRAIT_CHROMA_KEY.green),
    Math.abs(data[idx + 2] - PORTRAIT_CHROMA_KEY.blue)
  );
}

function isChromaBackground(data: Uint8ClampedArray, idx: number): boolean {
  if (data[idx + 3] === 0) return true;

  return chromaDistance(data, idx) <= PORTRAIT_CHROMA_KEY.tolerance;
}

/**
 * Scanline flood-fill from all edge pixels.
 * Uses a Uint8Array mask instead of Set for performance on large images.
 */
function findBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Uint8Array {
  const mask = new Uint8Array(width * height); // 0 = not bg, 1 = background
  const queue: number[] = [];

  // Seed all edge pixels that match the chroma key.
  for (let x = 0; x < width; x++) {
    const top = x;
    const bot = x + (height - 1) * width;
    if (isChromaBackground(data, top * 4)) { mask[top] = 1; queue.push(top); }
    if (isChromaBackground(data, bot * 4)) { mask[bot] = 1; queue.push(bot); }
  }
  for (let y = 1; y < height - 1; y++) {
    const left = y * width;
    const right = (width - 1) + y * width;
    if (isChromaBackground(data, left * 4)) { mask[left] = 1; queue.push(left); }
    if (isChromaBackground(data, right * 4)) { mask[right] = 1; queue.push(right); }
  }

  // BFS flood fill
  let head = 0;
  while (head < queue.length) {
    const pos = queue[head++];
    const x = pos % width;
    const y = (pos - x) / width;

    const neighbors = [
      x > 0 ? pos - 1 : -1,
      x < width - 1 ? pos + 1 : -1,
      y > 0 ? pos - width : -1,
      y < height - 1 ? pos + width : -1,
    ];

    for (const n of neighbors) {
      if (n >= 0 && mask[n] === 0 && isChromaBackground(data, n * 4)) {
        mask[n] = 1;
        queue.push(n);
      }
    }
  }

  return mask;
}

export function removeChromaKey(imageBase64: string, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("No canvas context")); return; }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data, width, height } = imageData;

        const bgMask = findBackground(data, width, height);

        // Apply transparency
        let backgroundPixels = 0;
        for (let i = 0; i < bgMask.length; i++) {
          if (bgMask[i] === 1) {
            data[i * 4 + 3] = 0;
            backgroundPixels++;
          }
        }

        if (backgroundPixels === 0) {
          throw new Error(`No ${PORTRAIT_CHROMA_KEY.hex} chroma-key background detected`);
        }

        // Anti-alias edges next to background
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const pos = y * width + x;
            if (bgMask[pos] === 1) continue; // skip bg pixels

            // Check if this pixel is adjacent to any bg pixel
            const hasAdjacentBg =
              (x > 0 && bgMask[pos - 1] === 1) ||
              (x < width - 1 && bgMask[pos + 1] === 1) ||
              (y > 0 && bgMask[pos - width] === 1) ||
              (y < height - 1 && bgMask[pos + width] === 1);

            if (hasAdjacentBg) {
              const idx = pos * 4;
              const distance = chromaDistance(data, idx);
              if (distance <= PORTRAIT_CHROMA_KEY.featherTolerance) {
                const featherRange =
                  PORTRAIT_CHROMA_KEY.featherTolerance - PORTRAIT_CHROMA_KEY.tolerance;
                const alpha = featherRange > 0
                  ? Math.round(
                      Math.max(0, distance - PORTRAIT_CHROMA_KEY.tolerance) /
                        featherRange * 255
                    )
                  : 255;
                data[idx + 3] = Math.min(data[idx + 3], alpha);
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl.split(",")[1]);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = `data:${mimeType};base64,${imageBase64}`;
  });
}

/**
 * Restores the required chroma-key background before a transparent preview is
 * reused as an image-generation reference.
 */
export function addChromaKeyBackground(imageBase64: string, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("No canvas context")); return; }

        ctx.fillStyle = PORTRAIT_CHROMA_KEY.hex;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png").split(",")[1]);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = `data:${mimeType};base64,${imageBase64}`;
  });
}
