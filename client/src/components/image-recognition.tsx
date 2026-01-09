import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './ui/select';
import { Camera, AlertCircle, CheckCircle } from 'lucide-react';

type RecognizeResult = { name: string | null; category: string | null };

import { Product } from "@shared/schema";
import { API_BASE_URL } from '@/lib/api-config';

export function ImageRecognition(props: any) {
  const { onRecognized, onCaptured, addToCart } = props as { 
    onRecognized?: (result: RecognizeResult) => void; 
    onCaptured?: (dataUrl: string) => void;
    addToCart?: (product: Product) => void;
  };
  const [items, setItems] = useState<string[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [useCamera, setUseCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await recognizeImage(file);
    }
  };

  const recognizeImage = async (file: File) => {
    setIsRecognizing(true);
    setError(null);
    setSuccess(null);
    setItems([]);
    
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/identify-item', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to recognize image');
      }

      const data = await response.json();
      
      if (data?.name) {
        // Success - item identified
        onRecognized?.({ name: data.name, category: data.category ?? null });
        setItems([data.name + (data.category ? ` (${data.category})` : '')]);
        setSuccess(`Identified: ${data.name}`);
        
        // Auto-add to cart if addToCart function is provided
        if (addToCart && data.name) {
          // Fetch the product details to get price and other info
          try {
            const productsResponse = await fetch(`${API_BASE_URL}/api/products`);
            const products = await productsResponse.json();
            const matchedProduct = products.find((p: Product) => p.name === data.name);
            
            if (matchedProduct) {
              addToCart(matchedProduct);
              setSuccess(prev => prev + ` - Added to cart ($${matchedProduct.price.toFixed(2)})`);
            } else {
              setError(`Product "${data.name}" found in AI but not in inventory`);
            }
          } catch (productError) {
            console.error('Error fetching products:', productError);
            setError(`Identified "${data.name}" but could not add to cart`);
          }
        }
      } else {
        // No identification
        setError('Could not identify item. Please try a clearer photo.');
        setItems([]);
      }
    } catch (error) {
      console.error('Recognition error:', error);
      setError('Please try a clearer photo or check your camera.');
      setItems([]);
    } finally {
      setIsRecognizing(false);
    }
  };

  // Start/stop camera via lifecycle effect for strict management
  useEffect(() => {
    let mounted = true;
    if (!useCamera) return;

    const start = async () => {
      setCameraError(null);
      // Attempt environment-facing first, but fall back to simple constraint if that fails
      const tryConstraints = async (constraints: MediaStreamConstraints) => {
        return await navigator.mediaDevices.getUserMedia(constraints);
      };

      let stream: MediaStream | null = null;
      try {
        // If a specific deviceId is selected, prefer it
        if (selectedDeviceId) {
          try {
            stream = await tryConstraints({ video: { deviceId: { exact: selectedDeviceId } }, audio: false });
          } catch (err: any) {
            console.warn('getUserMedia with deviceId failed, falling back:', err?.message || err);
            stream = null;
          }
        }

        if (!stream) {
          try {
            stream = await tryConstraints({ video: { facingMode: 'environment' }, audio: false });
          } catch (err: any) {
            console.error('Primary getUserMedia failed (environment):', err?.name, err?.message || err);
            if (err?.name === 'NotReadableError') {
              setCameraError('Camera is being used by another application');
            }
            // fallback to simpler constraint to avoid OverconstrainedError
            try {
              stream = await tryConstraints({ video: true, audio: false });
            } catch (err2: any) {
              console.error('Fallback getUserMedia failed:', err2?.name, err2?.message || err2);
              if (mounted) setCameraError(err2?.message || 'Failed to access camera');
              return;
            }
          }
        }

        if (!mounted || !stream) return;
        streamRef.current = stream;

        if (videoRef.current) {
          try {
            videoRef.current.srcObject = stream;
            videoRef.current.muted = true;
            videoRef.current.playsInline = true;
            // explicit autoplay attribute as well as programmatic play
            (videoRef.current as HTMLVideoElement).autoplay = true as any;
            await (videoRef.current as HTMLVideoElement).play();
          } catch (playErr: any) {
            console.error('Video play() failed after attaching stream:', playErr?.name, playErr?.message || playErr);
          }
        } else {
          console.error('videoRef.current is null after stream obtained');
        }
      } catch (e: any) {
        console.error('Unexpected camera initialization error in ImageRecognition:', e?.name, e?.message || e);
        if (mounted) setCameraError(e?.message || 'Failed to start camera');
      }
    };

    start();

    // enumerate devices and set defaults when camera is active
    (async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        const cams = list.filter((d) => d.kind === 'videoinput');
        setDevices(cams);
        if (cams.length > 0 && !selectedDeviceId) setSelectedDeviceId(cams[0].deviceId);
      } catch (e) {
        console.warn('Failed to enumerate devices', e);
      }
    })();

    return () => {
      mounted = false;
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch (e) {
        console.error('Error stopping camera tracks (cleanup):', (e as any)?.name || e);
      }
      streamRef.current = null;
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.srcObject = null;
        } catch (e) {
          console.error('Error clearing video element during cleanup:', (e as any)?.name || e);
        }
      }
      setUseCamera(false);
    };
  }, [useCamera, selectedDeviceId]);

  const startCamera = () => setUseCamera(true);
  const stopCamera = () => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch (e) {
      console.error('Error stopping camera tracks on stopCamera:', (e as any)?.name || e);
    }
    streamRef.current = null;
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch (e) {
        console.error('Error clearing video element in stopCamera:', (e as any)?.name || e);
      }
    }
    setUseCamera(false);
  };
  

  // Capture current frame and either recognize it or return data URL
  const captureFrame = async (options?: { returnDataUrl?: boolean }) => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    if (options?.returnDataUrl) {
      onCaptured?.(dataUrl);
      return;
    }
    // convert to blob and file
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
    if (!blob) return;
    const file = new File([blob], 'capture.png', { type: 'image/png' });
    await recognizeImage(file);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Image Recognition</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div>
            <Label>Image input</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="image-upload"
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <Button onClick={handleButtonClick} disabled={isRecognizing}>
                {isRecognizing ? 'Recognizing...' : 'Upload'}
              </Button>
              {!useCamera ? (
                <Button variant="outline" onClick={startCamera}>Use Camera</Button>
              ) : (
                <Button variant="destructive" onClick={stopCamera}>Stop Camera</Button>
              )}
              {useCamera && (
                <>
                  <Button onClick={() => captureFrame()}>Take Photo</Button>
                  {devices.length > 0 && (
                    <div className="w-48">
                      <Select onValueChange={(v) => setSelectedDeviceId(v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Camera" />
                        </SelectTrigger>
                        <SelectContent>
                          {devices.map((d) => (
                            <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </div>
            {useCamera && (
                  <div className="mt-2">
                  <video ref={videoRef} className="w-full max-h-60 object-contain bg-black" playsInline autoPlay muted />
                </div>
              )}
            {cameraError && (
              <div className="text-sm text-destructive mt-2">{cameraError}</div>
            )}
          </div>
          {items.length > 0 && (
            <div>
              <h3 className="text-lg font-medium">Recognized Items:</h3>
              <ul className="list-disc list-inside">
                {items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


export function AIImageRecognition({
  onIdentified,
}: {
  onIdentified: (product: Product) => void;
}) {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const handleRecognize = async () => {
    setIsRecognizing(true);
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/jpeg");

    try {
      const res = await fetch("/api/identify-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData }),
      });

      if (res.ok) {
        const product = await res.json();
        // Allow parent to handle adding to cart and optionally signal
        // whether the modal should close. Parent may return a boolean
        // or a Promise<boolean>. If the handler returns false, keep
        // the modal open; otherwise close it.
        try {
          const result = onIdentified ? onIdentified(product) : true;
          const shouldClose = (await Promise.resolve(result)) !== false;
          if (shouldClose) setModalOpen(false);
        } catch (err) {
          // If parent handler throws, keep modal open so user can retry
          console.error('onIdentified handler error:', err);
        }
      } else {
        console.error("Failed to identify item");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRecognizing(false);
    }
  };

  // Start/stop camera when modal opens/closes
  useEffect(() => {
    let mounted = true;
    if (!modalOpen) {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      streamRef.current = null;
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.srcObject = null;
        } catch (e) {}
      }
      return;
    }

    const start = async () => {
      try {
        const constraints: MediaStreamConstraints = selectedDeviceId ? { video: { deviceId: { exact: selectedDeviceId } }, audio: false } : { video: { facingMode: 'environment' }, audio: false };
        const stream = await navigator.mediaDevices.getUserMedia(constraints as MediaStreamConstraints);
        if (!mounted) return;
        streamRef.current = stream;
        if (videoRef.current) {
          try {
            videoRef.current.srcObject = stream;
            videoRef.current.muted = true;
            videoRef.current.playsInline = true;
            await videoRef.current.play();
          } catch (e) {
            console.error('Video play failed in AIImageRecognition:', e);
          }
        }
      } catch (e) {
        console.error('Failed to access camera in AIImageRecognition:', e);
      }
    };

    start();

    // enumerate devices when modal opens
    (async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        const cams = list.filter((d) => d.kind === 'videoinput');
        setDevices(cams);
        if (cams.length > 0 && !selectedDeviceId) setSelectedDeviceId(cams[0].deviceId);
      } catch (e) {
        console.warn('Failed to enumerate devices', e);
      }
    })();

    return () => {
      mounted = false;
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      streamRef.current = null;
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.srcObject = null;
        } catch (e) {}
      }
    };
  }, [modalOpen, selectedDeviceId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Camera</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Error Alert */}
        {error && (
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Success Alert */}
        {success && (
          <Alert className="mb-4 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {success}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex gap-2 items-center">
          <Button onClick={() => setModalOpen(true)} disabled={isRecognizing}>
            {isRecognizing ? 'Recognizing...' : 'Open Camera'}
          </Button>
          {modalOpen && (
            <div className="w-full">
              <div className="flex items-center gap-2 mb-2">
                {devices.length > 0 && (
                  <div className="w-48">
                    <Select onValueChange={(v) => setSelectedDeviceId(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Camera" />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.map((d) => (
                          <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <video ref={videoRef} className="w-full max-h-60 object-contain bg-black" playsInline muted />
              <div className="mt-2 flex gap-2">
                <Button onClick={handleRecognize} disabled={isRecognizing}>Capture & Identify</Button>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}