/**
 * Removes a white background from a base64 image via flood-fill from edges.
 * Returns a PNG with transparency where the background was.
 */

const BG_THRESHOLD = 225; // pixels with R,G,B all >= this are considered "white"

function isWhite(data: Uint8ClampedArray, idx: number): boolean {
  return data[idx] >= BG_THRESHOLD &&
    data[idx + 1] >= BG_THRESHOLD &&
    data[idx + 2] >= BG_THRESHOLD;
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

  // Seed all edge pixels that are white
  for (let x = 0; x < width; x++) {
    const top = x;
    const bot = x + (height - 1) * width;
    if (isWhite(data, top * 4)) { mask[top] = 1; queue.push(top); }
    if (isWhite(data, bot * 4)) { mask[bot] = 1; queue.push(bot); }
  }
  for (let y = 1; y < height - 1; y++) {
    const left = y * width;
    const right = (width - 1) + y * width;
    if (isWhite(data, left * 4)) { mask[left] = 1; queue.push(left); }
    if (isWhite(data, right * 4)) { mask[right] = 1; queue.push(right); }
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
      if (n >= 0 && mask[n] === 0 && isWhite(data, n * 4)) {
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
        for (let i = 0; i < bgMask.length; i++) {
          if (bgMask[i] === 1) {
            data[i * 4 + 3] = 0;
          }
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
              const r = data[idx], g = data[idx + 1], b = data[idx + 2];
              // If this edge pixel is near-white, make it semi-transparent
              if (r >= 200 && g >= 200 && b >= 200) {
                const minChannel = Math.min(255 - r, 255 - g, 255 - b);
                // More white = more transparent
                const alpha = Math.min(255, minChannel * 8);
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
