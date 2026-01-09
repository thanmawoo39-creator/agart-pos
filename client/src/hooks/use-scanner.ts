import { useEffect, useRef } from 'react';

interface UseBarcodeScanner {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

/**
 * Global barcode scanner hook that listens to keyboard input
 * and detects barcode scanner input patterns.
 *
 * Barcode scanners typically:
 * - Type very fast (all characters within ~100ms)
 * - End with Enter key
 * - Input length is usually > 2 characters
 *
 * @param onScan - Callback function triggered when a barcode is detected
 * @param enabled - Whether the scanner is active (default: true)
 */
export function useBarcodeScanner({ onScan, enabled = true }: UseBarcodeScanner) {
  const bufferRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isInputField) {
        return;
      }

      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Handle Enter key - this signals end of barcode scan
      if (event.key === 'Enter') {
        const scannedCode = bufferRef.current.trim();

        // Only trigger if we have a valid barcode (length > 2)
        if (scannedCode.length > 2) {
          console.log('🔍 Barcode detected:', scannedCode);
          onScan(scannedCode);
        }

        // Clear buffer after processing
        bufferRef.current = '';
        return;
      }

      // Ignore special keys (Shift, Ctrl, Alt, etc.)
      if (event.key.length > 1) {
        return;
      }

      // Add character to buffer
      bufferRef.current += event.key;

      // Set timeout to clear buffer if no more input (debounce)
      // Barcode scanners type very fast, so 100ms is enough
      timeoutRef.current = setTimeout(() => {
        // If buffer hasn't been used after 100ms, it's likely manual typing
        if (bufferRef.current.length > 0) {
          console.log('⏱️ Scanner timeout - clearing buffer:', bufferRef.current);
          bufferRef.current = '';
        }
      }, 100);
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onScan, enabled]);
}

/**
 * Helper function to determine if a scanned code is a customer ID
 * Customer IDs start with "C-" (e.g., "C-001", "C-123")
 */
export function isCustomerCode(code: string): boolean {
  return code.toUpperCase().startsWith('C-');
}

/**
 * Helper function to determine if a scanned code is a product barcode
 * Products are typically numeric or alphanumeric without "C-" prefix
 */
export function isProductCode(code: string): boolean {
  return !isCustomerCode(code);
}
