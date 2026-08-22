import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';
import getCroppedImg from '../utils/canvasUtils';

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedFile: File) => void;
  aspect?: number;
  shape?: 'rect' | 'round';
  title?: string;
}

export function ImageCropperModal({
  isOpen,
  onClose,
  imageSrc,
  onCropComplete,
  aspect = 1,
  shape = 'round',
  title = 'Ajustar Imagem',
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropCompleteHandler = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    try {
      setIsProcessing(true);
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedFile) {
        onCropComplete(croppedFile);
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao cortar a imagem. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-[#222] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#222] shrink-0">
          <h3 className="text-white font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative w-full h-[60vh] sm:h-[500px] bg-black/50 shrink">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={shape}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropCompleteHandler}
            showGrid={shape === 'rect'}
          />
        </div>

        <div className="p-5 space-y-5 bg-[#111] shrink-0">
          <div className="flex items-center gap-4">
            <ZoomOut className="w-5 h-5 text-gray-400 shrink-0" />
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"
            />
            <ZoomIn className="w-5 h-5 text-gray-400 shrink-0" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isProcessing}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {isProcessing ? (
                'Processando...'
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Cortar e Salvar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

