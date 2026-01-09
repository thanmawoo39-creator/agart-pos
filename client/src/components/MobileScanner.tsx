import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

interface MobileScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

const MobileScanner: React.FC<MobileScannerProps> = ({ isOpen, onClose, onScanSuccess }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Delay rendering to ensure the DOM element is there
      setTimeout(() => {
        if (document.getElementById("qr-reader-modal")) {
            const scanner = new Html5QrcodeScanner(
                "qr-reader-modal",
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
                },
                false
            );

            scanner.render(
                (decodedText, decodedResult) => {
                    onScanSuccess(decodedText);
                    onClose();
                },
                (errorMessage) => {
                    // ignore errors
                }
            );
            scannerRef.current = scanner;
        }
      }, 100);
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear scanner", error);
        });
        scannerRef.current = null;
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear scanner", error);
        });
        scannerRef.current = null;
      }
    };
  }, [isOpen, onScanSuccess, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Scan QR/Barcode
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div id="qr-reader-modal" className="w-full" />
          <p className="text-sm text-muted-foreground text-center">
            Position the barcode or QR code within the frame to scan
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MobileScanner;
