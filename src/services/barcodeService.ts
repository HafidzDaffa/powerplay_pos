// ============================================================
// POS PowerPlay — Barcode Service
// Uses expo-file-system/legacy for SDK 54 compatibility
// ============================================================
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { shareBarcodePNG } from './exportService';

/**
 * Capture a barcode view ref as PNG and share/save it.
 * @param viewRef - React ref to the ViewShot component wrapping BarcodeGenerator
 * @param sku - The SKU string (used for filename)
 */
export async function captureAndShareBarcode(
  viewRef: React.RefObject<any>,
  sku: string
): Promise<void> {
  if (!viewRef.current) {
    throw new Error('Referensi tampilan barcode tidak ditemukan.');
  }

  // ViewShot captures and returns a file:// URI
  const uri: string = await viewRef.current.capture();

  // Convert captured file URI to base64
  const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });

  await shareBarcodePNG(base64, sku);
}
