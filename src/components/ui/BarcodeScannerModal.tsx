'use client';
import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import Icon from './AppIcon';
import { toast } from 'sonner';

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  subtitle?: string;
}

export default function BarcodeScannerModal({
  open,
  onClose,
  onScan,
  title = 'Scan Retail Product Barcode',
  subtitle = 'Position the barcode within the scanner viewport or use a hardware barcode scanner.',
}: BarcodeScannerModalProps) {
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedSuccess, setScannedSuccess] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Hardware Scanner buffer
  const bufferRef = useRef<{ code: string; lastTime: number }>({ code: '', lastTime: 0 });

  // 1. Hardware Scanner Keyboard Listener
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const timeDiff = now - bufferRef.current.lastTime;
      bufferRef.current.lastTime = now;

      if (e.key === 'Enter') {
        if (bufferRef.current.code.length >= 3) {
          const code = bufferRef.current.code;
          bufferRef.current.code = '';
          handleSuccessScan(code);
        }
      } else if (e.key.length === 1) {
        if (timeDiff > 100) {
          bufferRef.current.code = e.key;
        } else {
          bufferRef.current.code += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // 2. Camera Lifecycle
  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setScannedSuccess(null);
      setCameraError(null);
      setManualCode('');
    }

    return () => {
      stopCamera();
    };
  }, [open]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API is not supported on this browser. Please enter barcode manually.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
        startScanningLoop();
      }
    } catch (err: any) {
      console.warn('Camera access denied or unavailable:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access or use manual barcode entry.'
          : 'Unable to connect to camera device. Please use manual barcode entry.'
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startScanningLoop = () => {
    // Check if window.BarcodeDetector is natively supported
    const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    let detector: any = null;

    if (hasBarcodeDetector) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });
      } catch {
        detector = null;
      }
    }

    const scanFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      if (detector) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const detectedValue = barcodes[0].rawValue;
            if (detectedValue) {
              handleSuccessScan(detectedValue);
              return;
            }
          }
        } catch {
          // Ignore frame decode errors
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  const handleSuccessScan = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    setScannedSuccess(cleanCode);
    toast.success(`Barcode detected: ${cleanCode}`);

    // Play subtle beep sound if AudioContext is available
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // AudioContext unavailable
    }

    setTimeout(() => {
      onScan(cleanCode);
      onClose();
    }, 400);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      toast.error('Please enter a barcode number');
      return;
    }
    handleSuccessScan(manualCode.trim());
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} size="md">
      <div className="space-y-4 py-2">
        {/* Camera Viewport Container */}
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border-2 border-border shadow-inner">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
          />

          {cameraActive && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Target Scan Reticle Box */}
              <div className="w-3/4 h-3/5 border-2 border-primary/90 rounded-xl relative shadow-2xl animate-pulse">
                {/* Corner Markers */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-primary" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-primary" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-primary" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-primary" />

                {/* Animated Laser Scanning Line */}
                <div className="absolute left-0 right-0 h-0.5 bg-danger shadow-[0_0_8px_#ef4444] animate-bounce top-1/2" />
              </div>
            </div>
          )}

          {cameraError && (
            <div className="p-6 text-center text-white space-y-2">
              <Icon name="ExclamationTriangleIcon" size={32} className="mx-auto text-warning" />
              <p className="text-xs font-semibold">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="btn-secondary text-2xs py-1.5 px-3 bg-white/10 hover:bg-white/20 text-white"
              >
                Retry Camera
              </button>
            </div>
          )}

          {!cameraActive && !cameraError && (
            <div className="text-center text-white space-y-2">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-xs font-medium text-gray-300">Initializing Optical Camera Stream...</p>
            </div>
          )}

          {scannedSuccess && (
            <div className="absolute inset-0 bg-success/90 flex flex-col items-center justify-center text-white space-y-1 z-20">
              <Icon name="CheckCircleIcon" size={48} className="animate-bounce" />
              <p className="text-sm font-black uppercase tracking-wider">Barcode Recognized!</p>
              <p className="text-xs font-mono font-bold bg-white/20 px-3 py-1 rounded-full">{scannedSuccess}</p>
            </div>
          )}
        </div>

        {/* Manual Barcode Entry Fallback Form */}
        <form onSubmit={handleManualSubmit} className="space-y-3 pt-2 border-t border-border">
          <label className="text-xs font-bold text-foreground block">
            Manual Barcode Entry / USB Handheld Scanner
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Icon name="QrCodeIcon" size={16} />
              </span>
              <input
                type="text"
                placeholder="Enter or paste EAN-13, UPC, SKU barcode..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="input-field pl-9 py-2 text-xs font-mono"
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary text-xs font-bold px-4 py-2">
              Submit Code
            </button>
          </div>
          <p className="text-3xs text-muted-foreground">
            Compatible with standard USB/Bluetooth handheld barcode scanners (Plug & Scan).
          </p>
        </form>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary text-xs">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
