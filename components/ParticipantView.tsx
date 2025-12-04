import React, { useState, useEffect } from 'react';
import { AssessmentData, Category, UserAnswers, ParticipantResponse } from '../types';
import GameBoard from './GameBoard';
import QuestionModal from './QuestionModal';
import { encodeResponse, addResponseToCompany, createCompany, getSettings } from '../services/storage'; 
import { triggerAutomationWebhook } from '../services/webhookService';
import { Check, Copy, User, ArrowRight, Loader2, AlertCircle, Send, Mail, Building, Eye } from 'lucide-react';

interface ParticipantViewProps {
  companyName: string;
  companyId?: string; 
  assessmentData: AssessmentData;
  onSubmit?: (response: ParticipantResponse) => void; 
}

const ParticipantView: React.FC<ParticipantViewProps> = ({ companyName, companyId, assessmentData, onSubmit }) => {
  const [step, setStep] = useState<'WELCOME' | 'ASSESSMENT' | 'FINISHED'>('WELCOME');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [publicCompanyName, setPublicCompanyName] = useState(''); 
  
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Store the generated view link to show on the success screen
  const [resultViewLink, setResultViewLink] = useState('');

  const isPublicMode = companyId === 'PUBLIC_NEW';

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (firstName.trim() && lastName.trim() && email.trim()) {
      if (isPublicMode && !publicCompanyName.trim()) return;
      setStep('ASSESSMENT');
    }
  };

  const handleCategorySelect = (category: Category) => {
    setActiveCategory(category);
  };

  const handleCategorySave = (answers: UserAnswers) => {
    setUserAnswers(prev => ({ ...prev, ...answers }));
    setActiveCategory(null);
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    const response: ParticipantResponse = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        timestamp: Date.now(),
        answers: userAnswers
    };

    if (onSubmit) {
        onSubmit(response);
    } else {
        let finalCompanyId = companyId;
        let finalCompanyName = companyName;

        if (isPublicMode) {
            try {
                const newComp = await createCompany(publicCompanyName.trim(), 'default-strategy', ['From Website']);
                finalCompanyId = newComp.id;
                finalCompanyName = newComp.name;
            } catch (e) {
                console.error("Error creating public company", e);
            }
        }

        if (finalCompanyId) {
            await addResponseToCompany(finalCompanyId, response);
        }

        // Generate Links
        const reportLink = `${window.location.origin}/?mode=view_result&company=${encodeURIComponent(finalCompanyName)}`;
        setResultViewLink(reportLink);

        // ONLY Trigger Webhook if Public Mode (From Website)
        if (isPublicMode) {
            try {
                const settings = await getSettings();
                if (settings.webhookUrl && finalCompanyId) {
                    
                    let typeParam = 'BLT';
                    if (assessmentData.topic.includes('Pre-Planning')) typeParam = 'Pre-Planning';
                    else if (assessmentData.topic.includes('35')) typeParam = 'BLT-Extended';
                    
                    const shareLink = `${window.location.origin}/?company=${encodeURIComponent(finalCompanyName)}&type=${typeParam}`;

                    await triggerAutomationWebhook(settings.webhookUrl, {
                        participant: response,
                        companyName: finalCompanyName,
                        reportLink: reportLink,
                        assessmentName: assessmentData.topic,
                        shareLink: shareLink
                    });
                }
            } catch (e) {
                console.error("Webhook trigger error", e);
            }
        }

        setStep('FINISHED');
    }
    setIsSubmitting(false);
  };

  // Calculate start index for continuous numbering (1-30)
  const getStartingIndex = (category: Category): number => {
      if (!assessmentData || !assessmentData.categories) return 0;
      
      const catIndex = assessmentData.categories.findIndex(c => c.id === category.id);
      if (catIndex === -1) return 0;
      
      let count = 0;
      for (let i = 0; i < catIndex; i++) {
          count += assessmentData.categories[i].questions.length;
      }
      return count;
  };

  // --- Progress Calculation ---
  const totalQuestions = assessmentData.categories.reduce((acc, cat) => acc + cat.questions.length, 0);
  const answeredCount = Object.keys(userAnswers).length;
  const progressPercentage = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const isOverallComplete = answeredCount === totalQuestions && totalQuestions > 0;

  const categoriesStatus = assessmentData.categories.map(cat => {
      const answeredInCat = cat.questions.filter(q => userAnswers[q.id] !== undefined).length;
      const totalInCat = cat.questions.length;
      return {
          id: cat.id,
          name: cat.name,
          isComplete: answeredInCat === totalInCat,
          isStarted: answeredInCat > 0 && answeredInCat < totalInCat,
          percentage: totalInCat > 0 ? (answeredInCat / totalInCat) * 100 : 0
      };
  });

  if (step === 'WELCOME') {
      return (
        <div className="min-h-screen bg-brand-black flex items-center justify-center p-4">
            <div className="bg-neutral-900 max-w-md w-full p-8 rounded-3xl border border-neutral-700 shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-white mb-2">Welcome</h1>
                    <p className="text-brand-grey">
                        {isPublicMode ? "Start your free team assessment." : (
                            <>You are taking the assessment for <br/><span className="text-brand-orange font-bold">{companyName}</span></>
                        )}
                    </p>
                </div>

                <form onSubmit={handleStart}>
                    <div className="space-y-4 mb-8">
                        {isPublicMode && (
                            <div>
                                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Company / Team Name</label>
                                <div className="relative"><Building className="absolute left-3 top-3 w-5 h-5 text-neutral-600" /><input type="text" required value={publicCompanyName} onChange={e => setPublicCompanyName(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none" placeholder="Acme Inc." /></div>
                            </div>
                        )}
                        <div><label className="block text-xs font-bold text-neutral-500 uppercase mb-1">First Name</label><div className="relative"><User className="absolute left-3 top-3 w-5 h-5 text-neutral-600" /><input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none" placeholder="Jane" /></div></div>
                        <div><label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Last Name</label><div className="relative"><User className="absolute left-3 top-3 w-5 h-5 text-neutral-600" /><input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none" placeholder="Doe" /></div></div>
                        <div><label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Email Address</label><div className="relative"><Mail className="absolute left-3 top-3 w-5 h-5 text-neutral-600" /><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none" placeholder="jane@company.com" /></div></div>
                    </div>
                    <button type="submit" className="w-full py-4 bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">Start Assessment <ArrowRight className="w-4 h-4" /></button>
                </form>
            </div>
        </div>
      );
  }

  if (step === 'FINISHED') {
    return (
        <div className="min-h-screen bg-brand-black flex items-center justify-center p-4">
            <div className="bg-neutral-900 max-w-2xl w-full p-8 md:p-12 rounded-3xl border border-neutral-700 text-center shadow-2xl">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-green-400">
                    <Check className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-4">Assessment Complete</h1>
                <p className="text-brand-grey mb-8 text-lg">
                    Thank you, <span className="text-white font-bold">{firstName}</span>. Your responses have been recorded.
                </p>
                
                {/* Show View Results Button if Link Generated (Only for Public Mode usually, but safe to show always if link exists) */}
                {resultViewLink && isPublicMode && (
                    <a 
                        href={resultViewLink} 
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-all mb-4"
                    >
                        <Eye className="w-5 h-5" /> View My Results
                    </a>
                )}
                
                <div className="text-sm text-neutral-500 mt-4">You may close this window.</div>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black">
      {/* Sticky Header with Progress */}
      <div className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-40 shadow-md">
        <div className="px-3 py-2 md:p-4 flex justify-between items-center">
            <div className="flex-1 min-w-0 pr-2">
                <h1 className="text-brand-grey text-[9px] md:text-xs uppercase tracking-widest font-bold">Assessment For</h1>
                <div className="text-sm md:text-lg font-bold text-white truncate max-w-full">{companyName || publicCompanyName}</div>
            </div>

            {/* Quick Submit in Header if Complete (Desktop Only, Mobile has large button below) */}
            {isOverallComplete && (
                 <button 
                    onClick={handleFinish}
                    disabled={isSubmitting}
                    className="hidden md:flex px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold items-center gap-2 animate-pulse disabled:opacity-50"
                >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4" />} Submit
                </button>
            )}

            <div className="text-right shrink-0">
                <div className="text-brand-grey text-[9px] md:text-xs font-bold uppercase">Participant</div>
                <div className="text-sm md:text-base text-white font-medium">{firstName} {lastName}</div>
            </div>
        </div>

        {/* Progress Bar Section */}
        <div className="px-3 pb-3 md:px-4 md:pb-4">
            <div className="flex justify-between text-[10px] md:text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                <span className="flex items-center gap-2">
                   Progress
                   <span className={`text-brand-orange ${progressPercentage === 100 ? 'text-green-400' : ''}`}>{progressPercentage}%</span>
                </span>
                <span className="inline text-[9px] md:text-[10px]">{categoriesStatus.filter(c => c.isComplete).length} of {categoriesStatus.length} Pillars</span>
            </div>
            
            <div className="flex gap-1 h-1.5 md:h-2 w-full">
                {categoriesStatus.map((cat) => (
                    <div 
                        key={cat.id}
                        className="flex-1 bg-neutral-800 rounded-sm overflow-hidden relative group"
                        title={`${cat.name}: ${cat.isComplete ? 'Complete' : 'In Progress'}`}
                    >
                        <div 
                            className={`h-full transition-all duration-500 ${
                                cat.isComplete ? 'bg-green-500' : 
                                cat.isStarted ? 'bg-brand-orange' : 'bg-neutral-800'
                            }`}
                            style={{ width: cat.isComplete ? '100%' : `${cat.percentage}%` }}
                        />
                    </div>
                ))}
            </div>
        </div>
      </div>

      <GameBoard 
        assessmentData={assessmentData}
        userAnswers={userAnswers}
        onCategorySelect={handleCategorySelect}
        onFinish={handleFinish}
      />

      {activeCategory && (
        <QuestionModal 
            category={activeCategory}
            startingIndex={getStartingIndex(activeCategory)}
            existingAnswers={userAnswers}
            onSave={handleCategorySave}
            onClose={() => setActiveCategory(null)}
        />
      )}
    </div>
  );
};

export default ParticipantView;
