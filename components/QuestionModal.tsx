import React, { useState } from 'react';
import { Question, Category, UserAnswers, SCALE_LABELS } from '../types';
import { Check, ChevronRight, X } from 'lucide-react';

interface QuestionModalProps {
  category: Category;
  startingIndex: number;
  existingAnswers: UserAnswers;
  onSave: (answers: UserAnswers) => void;
  onClose: () => void;
}

const QuestionModal: React.FC<QuestionModalProps> = ({ category, startingIndex, existingAnswers, onSave, onClose }) => {
  const [answers, setAnswers] = useState<UserAnswers>(existingAnswers);

  const handleRate = (questionId: string, value: number | string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const isComplete = category.questions.every(q => {
      const val = answers[q.id];
      // For text, check for non-empty string. For number, check undefined.
      if (q.type === 'text') return typeof val === 'string' && val.trim().length > 0;
      return val !== undefined;
  });

  const handleSubmit = () => {
    if (isComplete) {
      onSave(answers);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-brand-black/95 backdrop-blur-sm">
      <div className="w-full h-full md:h-auto md:max-h-[95vh] md:max-w-7xl bg-brand-black border-0 md:border border-neutral-700 md:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-neutral-900 px-4 py-3 md:px-6 md:py-4 border-b border-neutral-800 flex justify-between items-center sticky top-0 z-20 shrink-0">
            <div>
                <span className="text-brand-orange text-[10px] md:text-xs font-bold tracking-wider uppercase mb-0.5 block">Assessment Pillar</span>
                <h2 className="text-white text-lg md:text-xl font-bold truncate max-w-[200px] md:max-w-none">{category.name}</h2>
            </div>
            <button onClick={onClose} className="p-2 -mr-2 text-neutral-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
            </button>
        </div>

        {/* Legend - Only show if there are RATING questions in this category */}
        {category.questions.some(q => !q.type || q.type === 'rating') && (
            <>
                <div className="md:hidden flex justify-between px-4 py-2 bg-neutral-900/95 backdrop-blur text-[10px] text-neutral-400 border-b border-neutral-800 sticky top-0 z-10 shrink-0">
                    <span>0 = Strongly Disagree</span>
                    <span className="text-center">2 = Neutral</span>
                    <span>4 = Strongly Agree</span>
                </div>
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-neutral-900/50 border-b border-neutral-800 text-[10px] uppercase tracking-wider font-bold text-neutral-500 shrink-0">
                    <div className="col-span-6 pl-12">Statement</div>
                    <div className="col-span-6 grid grid-cols-5 text-center">
                        <div className="text-red-400">Strongly Disagree</div>
                        <div className="text-red-300">Disagree</div>
                        <div className="text-yellow-400">Neutral</div>
                        <div className="text-green-300">Agree</div>
                        <div className="text-green-400">Strongly Agree</div>
                    </div>
                </div>
            </>
        )}

        {/* Questions List */}
        <div className="flex-1 overflow-y-auto p-3 md:px-6 md:py-4 space-y-4 md:space-y-2 bg-brand-black scroll-smooth">
          {category.questions.map((q, idx) => {
            const questionNumber = startingIndex + idx + 1;
            const isTextQuestion = q.type === 'text';
            
            return (
            <div 
                key={q.id} 
                className="bg-neutral-900/40 rounded-xl p-3 border border-neutral-800 flex flex-col md:grid md:grid-cols-12 md:gap-4 animate-in fade-in duration-300"
            >
                {/* Question Text Section */}
                <div className={`flex gap-3 mb-3 md:mb-0 ${isTextQuestion ? 'md:col-span-12' : 'md:col-span-6 md:items-center'}`}>
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-800 text-brand-orange border border-brand-orange/30 flex items-center justify-center text-xs font-bold mt-0.5 shadow-sm">
                        {questionNumber}
                    </span>
                    <h3 className="text-sm md:text-base text-gray-200 font-medium leading-snug pt-0.5">
                        {q.text}
                    </h3>
                </div>

                {/* Input Area */}
                <div className={`md:col-span-12 ${isTextQuestion ? 'mt-2' : 'md:col-span-6'}`}>
                    {isTextQuestion ? (
                        <textarea
                            value={answers[q.id] as string || ''}
                            onChange={(e) => handleRate(q.id, e.target.value)}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-white focus:ring-1 focus:ring-brand-orange outline-none resize-y min-h-[100px]"
                            placeholder="Enter your response here..."
                        />
                    ) : (
                        <div className="grid grid-cols-5 gap-2">
                            {[0, 1, 2, 3, 4].map((val) => {
                                const isSelected = answers[q.id] === val;
                                const label = SCALE_LABELS[val as keyof typeof SCALE_LABELS];
                                
                                let colorClass = "border-neutral-700 bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:border-neutral-600";
                                if (isSelected) {
                                    if (val < 2) colorClass = "border-red-500/50 bg-red-500/20 text-red-300 ring-1 ring-red-500/50";
                                    else if (val < 3) colorClass = "border-yellow-500/50 bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/50";
                                    else colorClass = "border-green-500/50 bg-green-500/20 text-green-300 ring-1 ring-green-500/50";
                                }

                                return (
                                    <button
                                        key={val}
                                        onClick={() => handleRate(q.id, val)}
                                        className={`relative flex flex-col items-center justify-center py-2 md:py-2 rounded-lg border transition-all duration-150 ${colorClass} group`}
                                    >
                                        <div className={`w-6 h-6 md:w-5 md:h-5 rounded-full border flex items-center justify-center text-sm md:text-xs font-bold flex-shrink-0 mb-0 md:mb-1 ${isSelected ? 'border-current bg-current/10' : 'border-neutral-600'}`}>
                                            {val}
                                        </div>
                                        <span className="hidden md:block text-[9px] leading-none text-center opacity-50 group-hover:opacity-100">{label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
          )})}
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-900 border-t border-neutral-800 flex justify-between md:justify-end items-center gap-4 shrink-0 pb-safe">
            <div className="text-brand-grey text-xs md:text-sm">
                {Object.keys(answers).filter(k => category.questions.find(q => q.id === k)).length} of {category.questions.length} answered
            </div>
            <button 
                onClick={handleSubmit}
                disabled={!isComplete}
                className="px-6 py-3 md:py-2.5 bg-brand-orange hover:bg-orange-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg disabled:shadow-none text-sm w-full md:w-auto justify-center"
            >
                <span>Complete Pillar</span>
                {isComplete ? <Check className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionModal;
