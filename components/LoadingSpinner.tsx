import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner: React.FC<{ message?: string }> = ({ message = "Loading..." }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-6">
      <div className="relative">
        <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
        <Loader2 className="w-16 h-16 text-cyan-400 animate-spin relative z-10" />
      </div>
      <p className="text-xl font-medium text-slate-300 animate-pulse">{message}</p>
    </div>
  );
};

export default LoadingSpinner;