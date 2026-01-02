'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, User } from 'lucide-react';

interface VideoFeedProps {
  isCameraOff: boolean;
  onCameraReady?: (stream: MediaStream) => void;
}

export function VideoFeed({ isCameraOff, onCameraReady }: VideoFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const initCamera = async () => {
      if (isCameraOff) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setHasPermission(true);
        onCameraReady?.(stream);
      } catch {
        setHasPermission(false);
      }
    };

    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCameraOff, onCameraReady]);

  if (isCameraOff || hasPermission === false) {
    return (
      <div className="relative h-full w-full rounded-2xl bg-gradient-to-br from-[#2d4f3e] to-[#1a3028] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }} />
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-[#39634E]/50 flex items-center justify-center border-2 border-[#4a7a5f]">
            {isCameraOff ? (
              <CameraOff className="w-10 h-10 text-white/70" />
            ) : (
              <User className="w-10 h-10 text-white/70" />
            )}
          </div>
          <p className="text-white/60 text-sm font-medium tracking-wide">
            {isCameraOff ? 'Camera Off' : 'Camera access required'}
          </p>
        </div>
        <div className="absolute bottom-4 left-4 flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm">
            <span className="text-white/80 text-xs font-medium">You</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover transform scale-x-[-1]"
      />
      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm flex items-center gap-2">
          <Camera className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-white/90 text-xs font-medium">You</span>
        </div>
      </div>
    </div>
  );
}
