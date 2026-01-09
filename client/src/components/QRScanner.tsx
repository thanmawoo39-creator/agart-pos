import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QrCode, Camera, X } from 'lucide-react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  products: any[];
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, products }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const startScanner = () => {
    setIsOpen(true);
    setIsScanning(true);
    
    setTimeout(() => {
      const scannerInstance = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 }, 
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] 
        },
        false
      );
      
      scannerInstance.render(
        (decodedText) => {
          console.log('🔍 QR/Barcode scanned:', decodedText);
          onScanSuccess(decodedText);
          stopScanner();
        },
        (errorMessage) => {
          console.debug('Scan error:', errorMessage);
        }
      );
      
      scannerRef.current = scannerInstance;
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch (error) {
        console.log('Scanner cleanup error:', error);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
    setIsOpen(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (error) {
          console.log('Scanner cleanup error:', error);
        }
      }
    };
  }, []);

  return (
    <>
      <Button
        onClick={startScanner}
        variant="outline"
        className="w-full mb-4"
        disabled={isScanning}
      >
        <QrCode className="w-4 h-4 mr-2" />
        {isScanning ? 'Scanning...' : 'Scan QR/Barcode'}
      </Button>

      <Dialog open={isOpen} onOpenChange={stopScanner}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              QR/Barcode Scanner
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div id="qr-reader" className="w-full" />
            
            <div className="flex justify-center">
              <Button onClick={stopScanner} variant="outline">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
