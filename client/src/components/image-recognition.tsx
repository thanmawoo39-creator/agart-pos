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

export function ImageRecognition(props: {
  onRecognized?: (result: RecognizeResult) => void;
  onCaptured?: (dataUrl: string) => void;
  addToCart?: (product: Product) => void;
  products: Product[];
}) {
  const { onRecognized, onCaptured, addToCart, products } = props;
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

  const [isCaptureDisabled, setIsCaptureDisabled] = useState(false);

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
      const response = await fetch('/api/ai/recognize', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorDetails = data.details ? `: ${data.details.join(', ')}` : '';
        throw new Error(data.error || `Failed to recognize image${errorDetails}`);
      }
      
      if (data?.name) {
        // Success - item identified and matched
        onRecognized?.({ name: data.name, category: data.category ?? null });
        setItems([data.name + (data.category ? ` (${data.category})` : '')]);
        setSuccess(`Identified: ${data.name}`);
        
        // Auto-add to cart if addToCart function is provided
        if (addToCart) {
          addToCart(data);
          setSuccess(prev => prev + ` - Added to cart ($${data.price.toFixed(2)})`);
        }
      } else {
        // This case should ideally not be reached if the backend is robust
        setError('Could not identify item. Please try a clearer photo.');
        setItems([]);
      }
    } catch (error: any) {
      console.error('Recognition error:', error);
      setError(error.message || 'Please try a clearer photo or check your camera.');
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
    if (!videoRef.current || isCaptureDisabled) return;
    
    setIsCaptureDisabled(true);
    setTimeout(() => setIsCaptureDisabled(false), 2000);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    if (options?.returnDataUrl) {
      const dataUrl = canvas.toDataURL('image/png');
      onCaptured?.(dataUrl);
      return;
    }
    
    canvas.toBlob(async (blob) => {
      if (blob) {
        await recognizeImage(new File([blob], 'capture.png', { type: 'image/png' }));
      }
    }, 'image/png');
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
          {!useCamera ? (
            <div className="flex gap-2">
              <Button onClick={handleButtonClick} disabled={isRecognizing}>
                <Camera className="mr-2 h-4 w-4" /> {isRecognizing ? 'Recognizing...' : 'Upload Image'}
              </Button>
              <Button variant="outline" onClick={startCamera}>
                Open Camera
              </Button>
            </div>
          ) : (
            <div className="video-container">
              <video ref={videoRef} className="w-full max-h-60 object-contain bg-black rounded-md" playsInline autoPlay muted />
              <div className="flex gap-2 mt-2">
                <Button onClick={() => captureFrame()} disabled={isRecognizing || isCaptureDisabled}>
                  {isRecognizing ? 'Recognizing...' : 'Take Photo'}
                </Button>
                <Button variant="destructive" onClick={stopCamera}>
                  Close Camera
                </Button>
                {devices.length > 1 && (
                  <div className="w-48">
                    <Select onValueChange={(v) => setSelectedDeviceId(v)} defaultValue={selectedDeviceId || undefined}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Camera" />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.map((d) => (
                          <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${devices.indexOf(d) + 1}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}
          <Input
            id="image-upload"
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {cameraError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{cameraError}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
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

