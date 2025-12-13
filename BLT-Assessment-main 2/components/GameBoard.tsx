import React from 'react';
import { Category, UserAnswers, AssessmentData } from '../types';
import { CheckCircle, Circle, Send } from 'lucide-react';

interface GameBoardProps {
  assessmentData: AssessmentData;
  userAnswers: UserAnswers;
  onCategorySelect: (category: Category) => void;
  onFinish: () => void;
}

const GameBoard: React.FC<GameBoardProps> = ({ 
  assessmentData, 
  userAnswers, 
  onCategorySelect,
  onFinish
}) => {

  const totalQuestions = assessmentData.categories.reduce((acc, cat) => acc + cat.questions.length, 0);
  const answeredCount = Object.keys(userAnswers).length;
  const isComplete = answeredCount === totalQuestions;
  const progress = Math.round((answeredCount / totalQuestions) * 100);

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
      {/* Header Stats - Not sticky anymore to avoid conflict with main header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-10 bg-neutral-900/80 backdrop-blur-md p-4 md:p-6 rounded-3xl border border-neutral-800 shadow-xl">
        <div className="flex items-center gap-4 mb-4 md:mb-0 w-full md:w-auto">
            <div className="relative w-14 h-14 md:w-16 md:h-16 flex items-center justify-center shrink-0">
                <svg className="transform -rotate-90 w-14 h-14 md:w-16 md:h-16">
                    <circle cx="50%" cy="50%" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-neutral-800" />
                    <circle cx="50%" cy="50%" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-brand-orange transition-all duration-1000 ease-out" strokeDasharray={150.8} strokeDashoffset={150.8 - (progress / 100) * 150.8} />
                </svg>
                <span className="absolute text-xs md:text-sm font-bold text-white">{progress}%</span>
            </div>
            <div>
                <h2 className="text-brand-grey text-[10px] md:text-xs uppercase tracking-widest font-bold mb-1">Assessment Progress</h2>
                <div className="text-lg md:text-xl font-bold text-white">{answeredCount} of {totalQuestions} Completed</div>
            </div>
        </div>

        <button 
            onClick={onFinish}
            disabled={!isComplete}
            className={`w-full md:w-auto px-6 py-3 md:px-8 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${isComplete ? 'bg-green-600 hover:bg-green-500 text-white animate-pulse cursor-pointer' : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'}`}
        >
             <Send className="w-5 h-5" />
             Submit Response
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {assessmentData.categories.map((cat) => {
            const catQuestions = cat.questions;
            const catAnswered = catQuestions.filter(q => userAnswers[q.id] !== undefined).length;
            const catTotal = catQuestions.length;
            const isCatComplete = catAnswered === catTotal;

            return (
                <button
                    key={cat.id}
                    onClick={() => onCategorySelect(cat)}
                    className={`relative group p-5 md:p-6 rounded-2xl border-2 text-left transition-all duration-300 hover:-translate-y-1 shadow-lg ${
                        isCatComplete 
                        ? 'bg-neutral-800/40 border-green-900/50 hover:border-green-500/30' 
                        : 'bg-neutral-800 border-neutral-700 hover:border-brand-orange/50 hover:shadow-[0_0_20px_rgba(255,60,0,0.15)]'
                    }`}
                >
                    <div className="flex justify-between items-start mb-3 md:mb-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider ${isCatComplete ? 'bg-green-900/30 text-green-400' : 'bg-neutral-900 text-brand-orange'}`}>
                            Pillar {assessmentData.categories.indexOf(cat) + 1}
                        </span>
                        {isCatComplete ? (
                            <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
                        ) : (
                            <Circle className="w-5 h-5 md:w-6 md:h-6 text-neutral-600 group-hover:text-brand-orange" />
                        )}
                    </div>
                    
                    <h3 className={`text-lg md:text-xl font-bold mb-3 md:mb-4 min-h-[3rem] md:min-h-[3.5rem] ${isCatComplete ? 'text-brand-grey' : 'text-white'}`}>
                        {cat.name}
                    </h3>

                    <div className="w-full bg-neutral-700 rounded-full h-1.5 md:h-2 mb-2 overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${isCatComplete ? 'bg-green-500' : 'bg-brand-orange'}`} 
                            style={{ width: `${(catAnswered / catTotal) * 100}%` }}
                        />
                    </div>
                    <div className="text-right text-[10px] md:text-xs text-neutral-500 font-medium">
                        {catAnswered}/{catTotal} Answered
                    </div>
                </button>
            );
        })}
      </div>
    </div>
  );
};

export default GameBoard;