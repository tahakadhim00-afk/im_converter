const sharp = require('sharp');
const heicConvert = require('heic-convert');
const path = require('path');
const fs = require('fs');

const HEIC_EXTENSIONS = ['.heic', '.heif'];

const OUTPUT_FORMATS = [
  { id: 'jpeg', label: 'JPG', ext: '.jpg', lossy: true },
  { id: 'png', label: 'PNG', ext: '.png', lossy: false },
  { id: 'webp', label: 'WebP', ext: '.webp', lossy: true },
  { id: 'avif', label: 'AVIF', ext: '.avif', lossy: true },
  { id: 'tiff', label: 'TIFF', ext: '.tiff', lossy: false },
  { id: 'gif', label: 'GIF', ext: '.gif', lossy: false },
  { id: 'bmp', label: 'BMP', ext: '.bmp', lossy: false },
];

function getSupportedOutputFormats() {
  return OUTPUT_FORMATS;
}

/**
 * Convert a single image file.
 * @param {string} inputPath - Absolute path to source image
 * @param {string} outputFormat - Format id (jpeg, png, webp, etc.)
 * @param {string} outputDir - Directory to write output (null = same as input)
 * @param {object} options - { quality, width, height, keepMetadata }
 * @returns {string} outputPath
 */
async function convertBatch(inputPath, outputFormat, outputDir, options = {}) {
  const format = OUTPUT_FORMATS.find((f) => f.id === outputFormat);
  if (!format) throw new Error(`Unsupported output format: ${outputFormat}`);

  const dir = outputDir || path.dirname(inputPath);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  let outputPath = path.join(dir, baseName + format.ext);

  // Avoid overwriting: append (1), (2), etc.
  let counter = 1;
  while (fs.existsSync(outputPath)) {
    outputPath = path.join(dir, `${baseName} (${counter})${format.ext}`);
    counter++;
  }

  // HEIC/HEIF: decode with heic-convert first, then feed buffer to sharp
  const ext = path.extname(inputPath).toLowerCase();
  let inputBuffer;
  if (HEIC_EXTENSIONS.includes(ext)) {
    const fileBuffer = fs.readFileSync(inputPath);
    const converted = await heicConvert({
      buffer: fileBuffer,
      format: 'PNG',
    });
    inputBuffer = Buffer.from(converted);
  }

  let pipeline = sharp(inputBuffer || inputPath, { failOn: 'none' });

  // Resize if requested
  if (options.width || options.height) {
    pipeline = pipeline.resize({
      width: options.width || undefined,
      height: options.height || undefined,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Metadata
  if (options.keepMetadata) {
    pipeline = pipeline.keepMetadata();
  }

  // Format-specific options
  const formatOpts = {};
  if (format.lossy && options.quality) {
    formatOpts.quality = options.quality;
  }

  pipeline = pipeline.toFormat(format.id, formatOpts);

  await pipeline.toFile(outputPath);
  return outputPath;
}

module.exports = { convertBatch, getSupportedOutputFormats };
