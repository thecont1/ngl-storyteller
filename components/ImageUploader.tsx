import React, { useRef } from 'react';
import { UploadIcon, MagicIcon, Spinner } from './Icons';
import { fileToBase64 } from '../utils/imageUtils';

interface ImageUploaderProps {
  label: string;
  onUpload: (base64: string) => void;
  isLoading?: boolean;
  accept?: string;
  id: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ label, onUpload, isLoading, accept = "image/*", id }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      try {
        const base64 = await fileToBase64(event.target.files[0]);
        onUpload(base64);
        // Reset value so same file can be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (error) {
        console.error("Error reading file:", error);
      }
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        id={id}
        ref={fileInputRef}
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
        disabled={isLoading}
      />
      <label
        htmlFor={id}
        className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200
          ${isLoading 
            ? 'bg-slate-800 border-slate-600 opacity-50 cursor-not-allowed' 
            : 'bg-slate-800/50 border-slate-600 hover:bg-slate-800 hover:border-slate-400'
          }`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {isLoading ? (
            <Spinner />
          ) : (
            <>
              <UploadIcon />
              <p className="mb-2 text-sm text-slate-400 font-semibold mt-2">{label}</p>
            </>
          )}
        </div>
      </label>
    </div>
  );
};