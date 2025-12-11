
import React from 'react';

export const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

export const MagicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L12 3Z" />
  </svg>
);

export const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16" />
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <path d="M6 6v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6" />
    <line x1="10" y1="10" x2="10" y2="18" />
    <line x1="14" y1="10" x2="14" y2="18" />
  </svg>
);

export const GeminiIcon = ({ spinning = true }: { spinning?: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="url(#geminiGradient)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      animation: spinning ? 'spin 1s linear infinite' : 'none'
    }}
  >
    <defs>
      <linearGradient id="geminiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4285f4" />
        <stop offset="50%" stopColor="#8ab4f8" />
        <stop offset="100%" stopColor="#1967d2" />
      </linearGradient>
      <linearGradient id="geminiFill" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4285f4" stopOpacity="0.2" />
        <stop offset="50%" stopColor="#8ab4f8" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#1967d2" stopOpacity="0.2" />
      </linearGradient>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </defs>
    <path
      d="M12 2L14.4 7.2C14.7 7.9 15.3 8.5 16 8.8L21.2 11.2C21.6 11.4 21.6 12 21.2 12.2L16 14.6C15.3 14.9 14.7 15.5 14.4 16.2L12 21.4C11.8 21.8 11.2 21.8 11 21.4L8.6 16.2C8.3 15.5 7.7 14.9 7 14.6L1.8 12.2C1.4 12 1.4 11.4 1.8 11.2L7 8.8C7.7 8.5 8.3 7.9 8.6 7.2L11 2C11.2 1.6 11.8 1.6 12 2Z"
      fill="url(#geminiFill)"
      stroke="url(#geminiGradient)"
    />
  </svg>
);

export const InvertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
    <path d="M12 20a8 8 0 1 0 0-16v16Z" fill="currentColor" className="opacity-50" />
    <path d="M12 4v16" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const MirrorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 4v16l5-8-5-8z" />
    <path d="M7 20V4l-5 8 5 8z" fill="currentColor" className="opacity-50" />
    <line x1="12" y1="4" x2="12" y2="20" strokeDasharray="2 2" />
  </svg>
);

export const GripVerticalIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="5" r="1" />
    <circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="5" r="1" />
    <circle cx="15" cy="19" r="1" />
  </svg>
);

export const Spinner = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export const SaveDiskIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

export const StyleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 5 7l7 4 7-4L12 3Z" />
    <path d="M5 11l7 4 7-4" />
    <path d="M5 15l7 4 7-4" />
  </svg>
);

export const ScissorsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
);

export const FileJsonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="m10 13-2 2 2 2" />
    <path d="m14 17 2-2-2-2" />
  </svg>
);

export const FileImageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" />
    <polyline points="14 2 14 8 20 8" />
    <circle cx="10" cy="10" r="1.7" />
    <path d="M7 18l3.2-3.2L13 18l2.2-2.2L19 18" />
  </svg>
);

export const FileCodeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M9 12.5c-.8.3-1.2.9-1.2 1.7v1.6c0 .8-.4 1.4-1.2 1.7" />
    <path d="M15 12.5c.8.3 1.2.9 1.2 1.7v1.6c0 .8.4 1.4 1.2 1.7" />
    <line x1="10" y1="13" x2="14" y2="13" />
  </svg>
);

export const MagritteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12h20" />
    <path d="M7 12a5 5 0 0 1 5-5 5 5 0 0 1 5 5" />
    <path d="M12 7V3" />
    <path d="M2 16h20" />
  </svg>
);
