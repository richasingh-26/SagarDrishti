import { useState, useRef } from 'react';
import { Upload, Bot, Loader2, Image as ImageIcon } from 'lucide-react';

export function SpillDetection() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [gemmaReport, setGemmaReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setGemmaReport(null);
      setError(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const analyzeWithGemma = async () => {
    if (!selectedImage) return;
    setIsAnalyzing(true);
    setGemmaReport(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedImage);

    try {
      let response;
      try {
        response = await fetch('/api/gemma-analyze', {
          method: 'POST',
          body: formData,
        });
      } catch {
        response = await fetch('http://127.0.0.1:8001/api/gemma-analyze', {
          method: 'POST',
          body: formData,
        });
      }

      const data = await response.json();
      if (data.status === 'success') {
        setGemmaReport(data.report);
      } else {
        setError(data.message || 'Analysis returned an error.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-4xl mx-auto space-y-6 pb-24">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bot className="text-cyan-400" /> AI Vision Forensic Analysis (Gemma 4)
        </h1>

        {/* Drag and Drop Container */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-cyan-400 bg-cyan-500/15 scale-[1.01] shadow-[0_0_25px_rgba(0,212,255,0.25)]'
              : 'border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/5'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,.tiff,.tif"
            className="hidden"
          />
          {previewUrl ? (
            <div className="space-y-3">
              <img
                src={previewUrl}
                alt="SAR Preview"
                className="max-h-72 mx-auto rounded-lg border border-cyan-500/30 shadow-lg object-contain"
              />
              <div className="flex items-center justify-center gap-2 text-xs text-cyan-400 font-medium">
                <ImageIcon size={14} />
                <span>{selectedImage?.name} (Click or drag another image to replace)</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className={`mx-auto transition-transform ${isDragging ? 'scale-125 text-cyan-300' : 'text-cyan-400'}`} size={44} />
              <p className="text-white font-medium text-base">Drag & Drop Sentinel-1 SAR Image Here</p>
              <p className="text-sm text-gray-400">or click to browse from your computer (PNG, JPG, TIFF, GeoTIFF)</p>
            </div>
          )}
        </div>

        {selectedImage && (
          <button
            onClick={analyzeWithGemma}
            disabled={isAnalyzing}
            className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-md cursor-pointer text-sm"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Gemma 4 is analyzing SAR radar patterns...</span>
              </>
            ) : (
              <>
                <Bot size={20} />
                <span>Analyze with Gemma 4</span>
              </>
            )}
          </button>
        )}

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {gemmaReport && (
          <div className="bg-[#0A1628] border border-cyan-500/30 rounded-xl p-6 shadow-[0_0_20px_rgba(0,212,255,0.1)] space-y-4">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <h2 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
                <Bot size={20} /> Forensic Analysis Report
              </h2>
              <span className="text-xs bg-cyan-500/20 text-cyan-300 px-3 py-1 rounded-full border border-cyan-500/30 font-medium">
                Powered by Gemma 4
              </span>
            </div>
            <div className="text-gray-200 leading-relaxed text-sm whitespace-pre-wrap font-sans">
              {gemmaReport}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
