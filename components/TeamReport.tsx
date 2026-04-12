import React, { useState, useEffect, useCallback } from 'react';
import { AssessmentData, ParticipantResponse, SCALE_LABELS, UserAnswers } from '../types';
import { getLogo } from '../services/storage';
import { generateExecutiveSummary, AIAnalysisInput } from '../services/geminiService';
import { ArrowLeft, Printer, Users, Sparkles, Loader2, RefreshCw, AlertCircle, MessageSquare } from 'lucide-react';

interface TeamReportProps {
    companyName: string;
    assessmentData: AssessmentData;
    allResponses: ParticipantResponse[];
    onRestart: () => void;
    mode?: 'single' | 'batch' | 'master';
    onSummaryReady?: () => void;
}

const TeamReport: React.FC<TeamReportProps> = ({
    companyName,
    assessmentData,
    allResponses,
    onRestart,
    mode = 'single',
    onSummaryReady
}) => {
    const [showIndividualScores, setShowIndividualScores] = useState(false);
    const [customLogo, setCustomLogo] = useState<string | null>(null);
    const totalRespondents = allResponses.length;

    // Detect if this is a Survey (Text based) or Assessment (Score based)
    // We check if the first question of the first category is text-based
    const isTextSurvey = assessmentData.categories[0]?.questions[0]?.type === 'text';

    // AI State
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    useEffect(() => {
        const loadLogo = async () => {
            try {
                const logo = await getLogo();
                setCustomLogo(logo);
            } catch (e) {
                console.error("Failed to load logo", e);
            }
        };
        loadLogo();
    }, []);

    // Helper: Try to find an answer even if the ID format in the DB is slightly different
    const fuzzyFindAnswer = (answers: UserAnswers | undefined, targetId: string): number | string | undefined => {
        if (!answers) return undefined;
        if (answers[targetId] !== undefined) return answers[targetId];
        const match = targetId.match(/^q-(\d+)-(\d+)$/);
        if (match) {
            const [_, cStr, qStr] = match;
            const c = parseInt(cStr);
            const q = parseInt(qStr);
            const variants = [`q-${c + 1}-${q + 1}`, `q-${c}-${q + 1}`, `q-${c + 1}-${q}`, `q-${c}-${q}`];
            for (const v of variants) {
                if (answers[v] !== undefined) return answers[v];
            }
        }
        return undefined;
    };

    // Calculate Scores (Only for non-text surveys)
    const pillarScores = !isTextSurvey ? assessmentData.categories.map(cat => {
        let totalScore = 0;
        let totalAnswers = 0;
        allResponses.forEach(response => {
            cat.questions.forEach(q => {
                const val = fuzzyFindAnswer(response.answers, q.id);
                if (typeof val === 'number' && val >= 0 && val <= 4) {
                    totalScore += val;
                    totalAnswers++;
                }
            });
        });
        const average = totalAnswers > 0 ? totalScore / totalAnswers : 0;
        return { id: cat.id, name: cat.name, average };
    }) : [];

    const getQuestionStats = useCallback((questionId: string) => {
        const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
        let validResponsesCount = 0;
        let totalScore = 0;
        allResponses.forEach(r => {
            const val = fuzzyFindAnswer(r.answers, questionId);
            if (typeof val === 'number' && val >= 0 && val <= 4) {
                counts[val] = (counts[val] || 0) + 1;
                totalScore += val;
                validResponsesCount++;
            }
        });
        const average = validResponsesCount > 0 ? totalScore / validResponsesCount : 0;
        const stats = [0, 1, 2, 3, 4].map(val => ({
            value: val,
            label: SCALE_LABELS[val as keyof typeof SCALE_LABELS],
            count: counts[val] || 0,
            percentage: validResponsesCount > 0 ? ((counts[val] || 0) / validResponsesCount) * 100 : 0
        }));
        return { stats, average, counts, validResponsesCount };
    }, [allResponses]);

    const handleGenerateAI = useCallback(async () => {
        if (isTextSurvey) return; // Skip for text surveys for now or handle differently later

        setIsGeneratingAI(true);
        setAiError(null);
        try {
            const allQuestions: any[] = [];
            
            assessmentData.categories.forEach(cat => {
                cat.questions.forEach(q => {
                    const { average, counts, validResponsesCount } = getQuestionStats(q.id);
                    const lowVotes = counts[0] + counts[1];
                    const highVotes = counts[3] + counts[4];
                    const isSplit = (lowVotes > 0 && highVotes > 0) && (lowVotes + highVotes >= Math.max(2, validResponsesCount * 0.5));
                    
                    allQuestions.push({
                        text: q.text,
                        score: average,
                        label: cat.name,
                        isSplit,
                        varianceDescription: isSplit ? `${lowVotes} Disagree vs ${highVotes} Agree` : ''
                    });
                });
            });

            const topStrengths = [...allQuestions].sort((a,b) => b.score - a.score).slice(0, 5);
            const criticalGaps = [...allQuestions].sort((a,b) => a.score - b.score).slice(0, 5);
            const misalignments = allQuestions.filter(q => q.isSplit).slice(0, 3);

            const input: AIAnalysisInput = {
                companyName,
                respondentCount: totalRespondents,
                pillarScores: pillarScores.map(p => ({ name: p.name, score: p.average })),
                topStrengths: topStrengths.map(s => ({ text: s.text, label: s.label })),
                criticalGaps: criticalGaps.map(g => ({ text: g.text, label: g.label })),
                misalignments: misalignments.map(m => ({ text: m.text, varianceDescription: m.varianceDescription, label: m.label }))
            };

            const summary = await generateExecutiveSummary(input);
            setAiSummary(summary);
        } catch (e) {
            console.error("AI Generation failed", e);
            setAiError("AI Analysis failed. Check API Key configuration.");
        } finally {
            setIsGeneratingAI(false);
            onSummaryReady?.();
        }
    }, [assessmentData, companyName, getQuestionStats, pillarScores, totalRespondents, isTextSurvey]);

    useEffect(() => {
        if (allResponses.length === 0 || isTextSurvey) {
            onSummaryReady?.();
        } else if (!aiSummary && !isGeneratingAI && !aiError) {
            handleGenerateAI();
        }
    }, []);

    const handlePrint = () => {
        if (typeof window !== 'undefined' && window.print) {
            const date = new Date().toISOString().split('T')[0];
            const originalTitle = document.title;
            document.title = `BLT-${companyName}-${date}`;
            setTimeout(() => {
                window.print();
                document.title = originalTitle;
            }, 100);
        } else {
            alert("Automatic printing is blocked. Please press Ctrl+P (or Cmd+P).");
        }
    };

    const currentDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    let globalQuestionIndex = 0;

    return (
        <div className={`bg-white text-slate-900 font-sans p-4 md:p-8 ${mode === 'batch' ? 'min-h-0 pb-8' : 'min-h-screen pb-32'}`}>
            {mode !== 'batch' && (
                <div className="max-w-6xl mx-auto mb-8 no-print flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <button onClick={onRestart} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-medium transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                    </button>
                    {!isTextSurvey && (
                        <div className="flex items-center gap-3 bg-slate-100 p-2 pr-4 rounded-lg border border-slate-200 shadow-sm">
                            <div className="bg-white p-1.5 rounded-md border border-slate-200 text-slate-500"><Users className="w-4 h-4" /></div>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${showIndividualScores ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                     <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out ${showIndividualScores ? 'translate-x-5' : 'translate-x-0'}`} />
                                </div>
                                <input type="checkbox" className="hidden" checked={showIndividualScores} onChange={e => setShowIndividualScores(e.target.checked)} />
                                <span className="text-sm font-semibold text-slate-700">Show Individual Scores</span>
                            </label>
                        </div>
                    )}
                </div>
            )}

            <div className="max-w-6xl mx-auto report-container relative">
                {/* Header */}
                <div className="mb-8 print:mb-4 text-center border-b-2 border-slate-900 pb-4">
                    {customLogo ? (
                        <img src={customLogo} alt="Company Logo" className="h-24 md:h-28 object-contain mx-auto mb-4" style={{ WebkitPrintColorAdjust: 'exact' }} />
                    ) : (
                        <div className="flex justify-center mb-6 items-center gap-3 select-none">
                             <div className="text-4xl md:text-5xl font-bold tracking-widest text-slate-900 font-sans">MIKE</div>
                             <div className="flex items-center text-4xl md:text-5xl font-bold tracking-widest text-slate-900 font-sans">G<div className="w-6 h-6 md:w-8 md:h-8 bg-[#ff4500] rounded-full mx-0.5" style={{WebkitPrintColorAdjust:'exact'}}></div>LDMAN</div>
                        </div>
                    )}
                    <h1 className="text-3xl md:text-4xl font-bold mb-2 text-slate-900">
                        {mode === 'master' ? 'Aggregate Report' : (isTextSurvey ? 'Pre-Planning Survey Results' : 'Breakthrough Leadership Team Assessment')}
                    </h1>
                    <h2 className="text-xl md:text-2xl text-slate-700 mb-1">{companyName}</h2>
                    <p className="text-slate-500 text-sm">Aggregated results from {totalRespondents} participant{totalRespondents !== 1 ? 's' : ''} • {currentDate}</p>
                </div>

                {/* --- RENDER LOGIC FOR TEXT SURVEY --- */}
                {isTextSurvey ? (
                    <div className="space-y-12">
                        {assessmentData.categories.map((cat, idx) => (
                            // Only apply page-break if it's NOT the first category
                            <div key={cat.id} className={idx > 0 ? "page-break" : ""}>
                                <div className="border-b-4 border-slate-900 mb-6 pb-2"><h2 className="text-2xl font-bold">{cat.name}</h2></div>
                                <div className="space-y-8">
                                    {cat.questions.map((q) => {
                                        // Collect all answers for this question
                                        const responses = allResponses.map(r => ({
                                            name: `${r.firstName} ${r.lastName}`,
                                            text: fuzzyFindAnswer(r.answers, q.id)
                                        })).filter(r => r.text); // Filter out empty

                                        return (
                                            <div key={q.id} className="break-inside-avoid">
                                                <h4 className="text-lg font-bold text-slate-800 mb-4 bg-slate-50 p-3 rounded border-l-4 border-brand-orange">{q.text}</h4>
                                                <div className="grid gap-3">
                                                    {responses.length === 0 ? (
                                                        <div className="text-slate-400 italic pl-4">No responses.</div>
                                                    ) : (
                                                        responses.map((resp, idx) => (
                                                            <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm break-inside-avoid">
                                                                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                                    <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                                                    {resp.name}
                                                                </div>
                                                                <div className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed">
                                                                    {resp.text}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* --- RENDER LOGIC FOR STANDARD ASSESSMENT --- */
                    <>
                    <div className="mb-8">
                        <h3 className="text-xl font-bold mb-4 text-center">Average Scores by Pillar</h3>
                        <div className="flex justify-center w-full max-w-5xl mx-auto px-4">
                            <div className="relative h-[300px] w-10 border-r border-transparent mr-4 shrink-0">
                                <span className="absolute right-0 top-0 -translate-y-1/2 text-xs font-bold text-slate-400">4.0</span>
                                <span className="absolute right-0 top-[25%] -translate-y-1/2 text-xs font-bold text-slate-400">3.0</span>
                                <span className="absolute right-0 top-[50%] -translate-y-1/2 text-xs font-bold text-slate-400">2.0</span>
                                <span className="absolute right-0 top-[75%] -translate-y-1/2 text-xs font-bold text-slate-400">1.0</span>
                                <span className="absolute right-0 top-[100%] -translate-y-1/2 text-xs font-bold text-slate-400">0</span>
                            </div>
                            <div className="flex-1">
                                <div className="relative h-[300px] border-l border-b border-slate-300">
                                    <div className="absolute w-full border-t border-slate-200 border-dashed top-0"></div>
                                    <div className="absolute w-full border-t border-slate-200 border-dashed top-[25%]"></div>
                                    <div className="absolute w-full border-t border-slate-200 border-dashed top-[50%]"></div>
                                    <div className="absolute w-full border-t border-slate-200 border-dashed top-[75%]"></div>
                                    <div className="absolute inset-0 flex items-end justify-around px-4">
                                        {pillarScores.map((pillar) => {
                                            const displayScore = Number(pillar.average.toFixed(1));
                                            const styleColor = displayScore < 2.0 ? '#ef4444' : (displayScore < 3.0 ? '#facc15' : '#22c55e');
                                            return (
                                                <div key={pillar.id} className="flex flex-col items-center w-full max-w-[100px] h-full justify-end group">
                                                    <div className="mb-1 font-bold text-base text-slate-700 z-10">{pillar.average.toFixed(1)}</div>
                                                    <div 
                                                        className="w-full rounded-t-sm transition-all duration-1000 ease-out shadow-sm relative z-0"
                                                        style={{ height: `${(pillar.average / 4) * 100}%`, backgroundColor: styleColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                                                    ></div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div className="flex justify-around px-4 mt-4">
                                    {pillarScores.map(pillar => (
                                        <div key={pillar.id} className="w-full max-w-[100px] text-[10px] md:text-xs font-semibold text-center leading-tight text-slate-700 flex items-start justify-center">
                                            {pillar.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap justify-center mt-4 gap-4 md:gap-8 text-[10px] md:text-xs text-slate-500">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#ef4444]" style={{backgroundColor: '#ef4444', WebkitPrintColorAdjust:'exact'}}></div><span>&lt; 2.0 May Require Significant Attention</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#facc15]" style={{backgroundColor: '#facc15', WebkitPrintColorAdjust:'exact'}}></div><span>2.0 - 2.99 Development Opportunities</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#22c55e]" style={{backgroundColor: '#22c55e', WebkitPrintColorAdjust:'exact'}}></div><span>3.0+ Great Job - Keep Going!</span></div>
                        </div>
                    </div>

                    <div className="mb-12 border-t-2 border-slate-100 pt-6 break-inside-avoid">
                        <div className="flex items-center gap-3 mb-4">
                            <Sparkles className="w-5 h-5 text-brand-orange" />
                            <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Executive Summary</h3>
                            {isGeneratingAI && <span className="text-xs text-slate-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Generating...</span>}
                            {aiError && (
                                <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded">
                                    <AlertCircle className="w-3 h-3" /> {aiError}
                                    <button onClick={handleGenerateAI} className="underline hover:text-red-700 flex items-center gap-1"><RefreshCw className="w-3 h-3"/> Retry</button>
                                </div>
                            )}
                            {!isGeneratingAI && !aiSummary && !aiError && (
                                <button onClick={handleGenerateAI} className="text-xs text-brand-orange underline font-bold hover:text-orange-700">Generate Now</button>
                            )}
                        </div>
                        {aiSummary ? (
                            <div className="prose prose-sm max-w-none text-sm text-slate-700">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="[&>h3]:text-brand-orange [&>h3]:font-bold [&>h3]:mb-2 [&>h3]:uppercase [&>h3]:text-xs [&>ul]:pl-4 [&>ul]:space-y-2">
                                        <h3 className="text-brand-orange font-bold text-xs uppercase mb-2">Key Strengths</h3>
                                        {aiSummary.includes('### Key Strengths') ? (
                                            <div dangerouslySetInnerHTML={{ __html: aiSummary.split('### Key Strengths')[1].split('### Critical Gaps')[0].replace(/-/g, '•').replace(/\n/g, '<br/>') }}></div>
                                        ) : null}
                                    </div>
                                    <div className="[&>h3]:text-brand-orange [&>h3]:font-bold [&>h3]:mb-2 [&>h3]:uppercase [&>h3]:text-xs [&>ul]:pl-4 [&>ul]:space-y-2">
                                        {aiSummary.includes('### Critical Gaps') ? (
                                            <>
                                                <h3 className="text-brand-orange font-bold text-xs uppercase mb-2">Critical Gaps</h3>
                                                <div dangerouslySetInnerHTML={{ __html: aiSummary.split('### Critical Gaps')[1].split('### Areas of Misalignment')[0].replace(/-/g, '•').replace(/\n/g, '<br/>') }}></div>
                                            </>
                                        ) : null}
                                    </div>
                                    <div className="[&>h3]:text-brand-orange [&>h3]:font-bold [&>h3]:mb-2 [&>h3]:uppercase [&>h3]:text-xs [&>ul]:pl-4 [&>ul]:space-y-2">
                                        <h3 className="text-brand-orange font-bold text-xs uppercase mb-2">Areas of Misalignment</h3>
                                        {totalRespondents === 1 ? (
                                            <p className="italic text-slate-500">
                                                Misalignment can only be identified if more than one leader takes the assessment. If you'd like someone else on your leadership team to take the assessment, please send them the same link you used.
                                            </p>
                                        ) : (
                                            aiSummary.includes('### Areas of Misalignment') ? (
                                                <div dangerouslySetInnerHTML={{ __html: aiSummary.split('### Areas of Misalignment')[1].replace(/-/g, '•').replace(/\n/g, '<br/>') }}></div>
                                            ) : null
                                        )}
                                    </div>
                                </div>
                                {!aiSummary.includes('###') && <div className="whitespace-pre-wrap">{aiSummary}</div>}
                            </div>
                        ) : (
                            <div className="text-slate-400 text-xs italic">
                                {!isGeneratingAI && !aiError && "Click 'Generate Now' to analyze results with AI."}
                            </div>
                        )}
                    </div>

                    <div className="space-y-16 print:space-y-0 print:block">
                        {assessmentData.categories.map((cat, idx) => (
                            <div key={cat.id} className={`${idx > 0 ? 'page-break' : ''} print:pt-8`}>
                                <div className="border-b-4 border-slate-900 mb-8 pb-2"><h2 className="text-3xl font-bold">{cat.name}</h2></div>
                                <div className="space-y-12 print:space-y-8">
                                    {cat.questions.map((q, qIdx) => {
                                        globalQuestionIndex++;
                                        const { stats, average } = getQuestionStats(q.id);
                                        const displayAverage = Number(average.toFixed(1));
                                        let bubbleColor = '#94a3b8'; let textColor = 'white';
                                        if (totalRespondents > 0) {
                                            if (displayAverage < 2.0) bubbleColor = '#ef4444';
                                            else if (displayAverage < 3.0) { bubbleColor = '#facc15'; textColor = '#713f12'; }
                                            else bubbleColor = '#22c55e';
                                        } else { bubbleColor = '#cbd5e1'; textColor = '#64748b'; }

                                        return (
                                            <div key={q.id} className="break-inside-avoid">
                                                <div className="flex items-start gap-4 mb-6">
                                                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm shadow-sm" style={{ WebkitPrintColorAdjust: 'exact', backgroundColor: bubbleColor, color: textColor }}>{globalQuestionIndex}</div>
                                                    <div className="flex-1"><h4 className="text-lg font-bold pt-0.5">{q.text}</h4></div>
                                                </div>
                                                <div className="hidden md:block overflow-x-auto mb-4">
                                                    <table className="w-full text-sm border-collapse">
                                                        <thead><tr><th className="p-2 text-left w-32 text-slate-500 font-normal"></th>{stats.map(s => <th key={s.value} className="p-2 border border-slate-200 bg-slate-50 w-1/5 text-center font-semibold text-slate-900">{s.label}</th>)}</tr></thead>
                                                        <tbody>
                                                            <tr><td className="p-2 border border-slate-200 font-bold text-slate-700 bg-slate-50">Response Count</td>{stats.map(s => <td key={s.value} className="p-2 border border-slate-200 text-center text-slate-900 font-medium">{s.count}</td>)}</tr>
                                                            <tr><td className="p-2 border border-slate-200 font-bold text-slate-700 bg-slate-50">Response %</td>{stats.map(s => <td key={s.value} className="p-2 border border-slate-200 text-center text-slate-900">{s.percentage.toFixed(1)}%</td>)}</tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <div className="md:hidden mb-6">
                                                    <div className="grid grid-cols-5 gap-1 text-center mb-1">{[0,1,2,3,4].map(v => <div key={v} className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded py-1">{v}</div>)}</div>
                                                    <div className="grid grid-cols-5 gap-1 text-center">{stats.map(s => <div key={s.value} className={`p-1 rounded border flex flex-col justify-center ${s.count > 0 ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-300'}`}><div className="font-bold text-sm text-slate-900">{s.count}</div><div className="text-[9px] text-slate-500">{s.percentage.toFixed(0)}%</div></div>)}</div>
                                                    <div className="text-[9px] text-slate-400 mt-2 text-center flex justify-center gap-2 flex-wrap"><span>0:S.Disagree</span><span>1:Disagree</span><span>2:Neutral</span><span>3:Agree</span><span>4:S.Agree</span></div>
                                                </div>
                                                {showIndividualScores && (
                                                    <div className="ml-0 md:ml-12 p-4 bg-slate-50 border border-slate-200 rounded-lg break-inside-avoid">
                                                        <div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-slate-400" /><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Individual Team Responses</span></div>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                            {allResponses.map((resp, rIdx) => {
                                                                const score = fuzzyFindAnswer(resp.answers, q.id);
                                                                if (typeof score !== 'number') return null;
                                                                let bg = 'bg-slate-100 text-slate-600 border-slate-200'; let indicatorColor = '#94a3b8';
                                                                if (score >= 3) { bg = 'bg-green-50 text-green-900 border-green-200'; indicatorColor = '#22c55e'; }
                                                                else if (score >= 2) { bg = 'bg-yellow-50 text-yellow-900 border-yellow-200'; indicatorColor = '#eab308'; }
                                                                else { bg = 'bg-red-50 text-red-900 border-red-200'; indicatorColor = '#ef4444'; }
                                                                const label = SCALE_LABELS[score as keyof typeof SCALE_LABELS] || 'Unknown';
                                                                return (
                                                                    <div key={rIdx} className={`px-3 py-2 rounded-md border ${bg} text-xs md:text-sm flex flex-col break-inside-avoid shadow-sm`} style={{WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                                                        <div className="flex items-center gap-1.5 mb-1"><div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: indicatorColor, WebkitPrintColorAdjust: 'exact'}}></div><span className="font-bold truncate">{resp.firstName} {resp.lastName}</span></div>
                                                                        <span className="text-[10px] md:text-xs opacity-80 font-medium pl-3 truncate">{label}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                    </>
                )}

                <div className={`hidden ${mode === 'batch' ? 'print:hidden' : 'print:flex'} print-footer justify-between items-center px-8 text-xs text-slate-400 z-50`}>
                    <span className="font-semibold text-slate-600">Breakthrough Leadership Team Assessment</span><span>{companyName}</span><span>{currentDate}</span>
                </div>

                {mode !== 'batch' && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/90 backdrop-blur flex flex-col md:flex-row justify-center gap-4 no-print z-50 border-t border-slate-800">
                        <div className="text-slate-400 text-xs max-w-md text-center md:text-left flex items-center"><p>Tip: If the button doesn't work, press <span className="font-bold text-white">Ctrl+P</span> (Windows) or <span className="font-bold text-white">Cmd+P</span> (Mac).</p></div>
                        <button type="button" onClick={handlePrint} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-bold flex items-center justify-center gap-2 shadow-lg transition-all transform active:scale-95"><Printer className="w-4 h-4" /> Print / Save as PDF</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeamReport;
