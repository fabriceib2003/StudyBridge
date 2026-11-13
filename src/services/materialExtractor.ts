import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import Tesseract from 'tesseract.js';
import { pipeline } from '@xenova/transformers';
import { Page } from '../types';

// Initialize PDF.js worker safely
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
try {
  if (typeof window !== 'undefined' && pdfjsLib?.GlobalWorkerOptions) {
    if (typeof pdfWorkerUrl === 'string') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    }
  }
} catch (e) {
  console.warn('PDF worker setup skipped:', e);
}

/**
 * Resizes a canvas if needed to keep memory compact and crisp for diagrams/slides.
 */
function getScaledCanvas(originalCanvas: HTMLCanvasElement, maxDim = 1000): HTMLCanvasElement {
  let { width, height } = originalCanvas;
  if (width <= maxDim && height <= maxDim) return originalCanvas;

  const ratio = Math.min(maxDim / width, maxDim / height);
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = Math.round(width * ratio);
  scaledCanvas.height = Math.round(height * ratio);
  const ctx = scaledCanvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(originalCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
  }
  return scaledCanvas;
}

export async function extractText(file: File, onProgress: (msg: string) => void): Promise<Page[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const pages: Page[] = [];

  // PDF
  if (extension === 'pdf') {
    onProgress('Reading PDF document...');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ 
      data: arrayBuffer,
      verbosity: 0 // VerbosityLevel.ERRORS: silence repetitive internal non-fatal image decoding warnings
    }).promise;
    const totalPages = pdf.numPages;

    for (let i = 1; i <= totalPages; i++) {
      onProgress(`Processing Page ${i} of ${totalPages} (extracting text & visual diagrams)...`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      
      let pageText = content.items
        // @ts-ignore
        .map((item: any) => item.str || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Render page to canvas to capture visual charts, diagrams, and figures
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Ensure all image objects and dependencies in the PDF page are fully resolved before painting
      try {
        await page.getOperatorList();
      } catch (e) {
        // Gracefully proceed if individual operator parsing is complete
      }

      // @ts-ignore
      await page.render({ canvasContext: context!, viewport, canvas }).promise;

      // If page text is very short (e.g. scanned page or diagram-only slide), run OCR on the rendered diagram
      if (pageText.length < 50) {
        onProgress(`Page ${i}: Visual diagram detected, running OCR on labels & charts...`);
        try {
          const ocr = await Tesseract.recognize(canvas, 'eng');
          if (ocr.data.text.trim()) {
            pageText = (pageText ? `${pageText}\n\n[Diagram / Chart Text]:\n` : '[Visual Diagram Text]:\n') + ocr.data.text.trim();
          }
        } catch (e) {
          console.warn(`OCR on page ${i} skipped:`, e);
        }
      }

      // Compact JPEG compression for smooth storage in IndexedDB
      const compactCanvas = getScaledCanvas(canvas, 1000);
      const jpegDataUrl = compactCanvas.toDataURL('image/jpeg', 0.78);

      pages.push({
        pageNumber: i,
        text: pageText || `[Page ${i}: Visual diagram / slide]`,
        image: jpegDataUrl,
        hasVisualDiagrams: true
      });
    }

    return pages;
  }

  // Images (JPG, PNG, WebP, JFIF)
  if (['jpg', 'jpeg', 'png', 'webp', 'jfif'].includes(extension || '')) {
    onProgress('Performing OCR on image / chart...');
    const result = await Tesseract.recognize(file, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          onProgress(`OCR in progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    const base64 = await fileToBase64(file);
    return [{
      pageNumber: 1,
      text: result.data.text.trim() || '[Image / Diagram content]',
      image: base64,
      hasVisualDiagrams: true
    }];
  }

  // PPTX
  if (extension === 'pptx') {
    onProgress('Extracting PPTX presentation slides and diagrams...');
    const zip = await JSZip.loadAsync(file);
    
    // Sort slides numerically: slide1.xml, slide2.xml...
    const slidePaths = Object.keys(zip.files)
      .filter(p => p.startsWith('ppt/slides/slide') && p.endsWith('.xml'))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numA - numB;
      });

    // Check for embedded media images (diagrams, charts, photos)
    const mediaImages: { [name: string]: string } = {};
    for (const [path, zfile] of Object.entries(zip.files)) {
      if (path.startsWith('ppt/media/') && /\.(png|jpe?g|webp)$/i.test(path)) {
        try {
          const blob = await zfile.async('blob');
          const dataUrl = await blobToBase64(blob);
          mediaImages[path] = dataUrl;
        } catch (e) {
          // Ignore individual media read error
        }
      }
    }

    const mediaKeys = Object.keys(mediaImages);

    if (slidePaths.length === 0) {
      throw new Error('No slides found in PPTX file.');
    }

    for (let i = 0; i < slidePaths.length; i++) {
      const path = slidePaths[i];
      const xml = await zip.files[path].async('string');
      // Extract slide text cleaned of XML tags
      const slideText = xml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Associate slide with any corresponding media images if available
      const associatedImage = mediaKeys[i] ? mediaImages[mediaKeys[i]] : undefined;

      pages.push({
        pageNumber: i + 1,
        text: slideText || `[Slide ${i + 1}]`,
        image: associatedImage,
        hasVisualDiagrams: !!associatedImage
      });
    }

    return pages;
  }

  // Raw text / markdown files (.txt, .md)
  if (['txt', 'md', 'text'].includes(extension || '')) {
    onProgress('Reading text file...');
    const text = await file.text();
    return [{
      pageNumber: 1,
      text: text.trim(),
      hasVisualDiagrams: false
    }];
  }

  throw new Error(`Unsupported file type: .${extension}. Please upload a PDF, PPTX, Image, or Text file.`);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function fileToBase64(file: File): Promise<string> {
  return blobToBase64(file);
}

export async function transcribeAudio(file: File, onProgress: (msg: string) => void): Promise<string> {
  onProgress('Initializing Whisper audio transcription model...');
  // @ts-ignore
  const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
  onProgress('Transcribing audio recording...');
  // @ts-ignore
  const result = await transcriber(file);
  return (result as any).text || '';
}
