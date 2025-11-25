import React, { useState } from 'react';
import { Sparkles, Activity, ClipboardList, ArrowRight } from 'lucide-react';

interface SetupScreenProps {
  onStart: (topic: string) => void;
  isGenerating: boolean;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onStart, isGenerating }) => {
  const [topic, setTopic] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim()) {
      onStart(topic);
    }
  };

  return (
    <div className="max-w-4xl mx-auto text-center px-4 py-8 md:py-12">
      <div className="mb-6 md:mb-10 flex justify-center">
        <div className="p-4 md:p-5 bg-gradient-to-br from-brand-orange/20 to-orange-600/10 rounded-3xl border border-brand-orange/30 shadow-[0_0_40px_rgba(255,60,0,0.15)]">
          <Activity className="w-16 h-16 md:w-20 md:h-20 text-brand-orange" />
        </div>
      </div>
      
      <h1 className="text-3xl md:text-5xl font-extrabold mb-4 md:mb-6 text-white leading-tight tracking-tight">
        Breakthrough Assessment
      </h1>
      
      <p className="text-brand-grey text-base md:text-xl mb-8 md:mb-12 max-w-2xl mx-auto leading-relaxed">
        Evaluate your team's performance across key pillars. Collect responses from multiple team members to generate a comprehensive report.
      </p>

      <div className="grid md:grid-cols-2 gap-4 md:gap-6 max-w-3xl mx-auto">
        {/* Option 1: Standard Assessment */}
        <button
            onClick={() => onStart("standard")}
            disabled={isGenerating}
            className="group relative overflow-hidden p-6 md:p-8 bg-neutral-800/50 border border-neutral-700 hover:border-brand-orange/50 rounded-2xl transition-all duration-300 hover:shadow-xl text-left flex flex-col h-full"
        >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <ClipboardList className="w-24 h-24" />
            </div>
            <div className="mb-4 p-3 bg-brand-orange/10 w-fit rounded-lg">
                <ClipboardList className="w-6 h-6 md:w-8 md:h-8 text-brand-orange" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-white mb-2">Start Team Assessment</h3>
            <p className="text-sm md:text-base text-brand-grey mb-6 flex-grow">
                Begin the "Breakthrough Leadership Team Assessment". Ideal for team analysis.
            </p>
            <div className="flex items-center text-brand-orange font-bold group-hover:translate-x-1 transition-transform text-sm md:text-base">
                Start Assessment <ArrowRight className="w-4 h-4 ml-2" />
            </div>
        </button>

        {/* Option 2: AI Generation */}
        <div className="relative p-6 md:p-8 bg-neutral-800/50 border border-neutral-700 rounded-2xl text-left flex flex-col h-full">
            <div className="absolute top-0 right-0 p-4 opacity-5">
                <Sparkles className="w-24 h-24" />
            </div>
            <div className="mb-4 p-3 bg-white/5 w-fit rounded-lg">
                <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-white mb-2">Custom AI Assessment</h3>
            <p className="text-sm md:text-base text-brand-grey mb-6">
                Generate a new assessment framework for any specific domain.
            </p>
            <form onSubmit={handleSubmit} className="mt-auto relative">
                <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Enter topic..."
                    disabled={isGenerating}
                    className="w-full px-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-all pr-12 text-sm md:text-base"
                />
                <button
                    type="submit"
                    disabled={!topic.trim() || isGenerating}
                    className="absolute right-2 top-2 bottom-2 p-2 bg-brand-orange hover:bg-orange-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating ? <Activity className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};

export default SetupScreen;