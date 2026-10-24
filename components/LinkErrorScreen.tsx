import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface LinkErrorScreenProps {
  // 'network': the database couldn't be reached. 'inactive': it was reached and
  // the company this link points to doesn't exist.
  kind: 'network' | 'inactive';
}

const LinkErrorScreen: React.FC<LinkErrorScreenProps> = ({ kind }) => (
  <div className="min-h-screen bg-brand-black flex items-center justify-center p-4">
    <div className="bg-neutral-900 max-w-md w-full p-8 rounded-3xl border border-red-800 text-center shadow-2xl">
      <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
        <AlertCircle className="w-8 h-8" />
      </div>
      {kind === 'network' ? (
        <>
          <h2 className="text-2xl font-bold text-white mb-3">We couldn't load your assessment</h2>
          <p className="text-brand-grey mb-4">
            This is usually a temporary connection problem, or a company network filter blocking part of the page. Your link is fine.
          </p>
          <p className="text-brand-grey mb-6 text-sm">
            If it keeps happening, try a different network — for example, your phone with Wi-Fi turned off.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Try Again
          </button>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-white mb-3">This assessment link isn't active</h2>
          <p className="text-brand-grey">Please contact the person who sent you this link.</p>
        </>
      )}
    </div>
  </div>
);

export default LinkErrorScreen;
