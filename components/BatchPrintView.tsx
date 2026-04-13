import React, { useEffect, useState } from 'react';
import { Company, AssessmentData } from '../types';
import TeamReport from './TeamReport';
import { getAssessmentData } from '../services/geminiService';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';

interface BatchPrintViewProps {
    companies: Company[];
    onBack: () => void;
}

const BatchPrintView: React.FC<BatchPrintViewProps> = ({ companies, onBack }) => {
    const [loading, setLoading] = useState(true);
    const [dataMap, setDataMap] = useState<Record<string, AssessmentData>>({});
    const [summariesReady, setSummariesReady] = useState(0);
    const [totalSummariesNeeded, setTotalSummariesNeeded] = useState(0);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const newDataMap: Record<string, AssessmentData> = {};
            
            await Promise.all(companies.map(async (company) => {
                // Prioritize templateId, fallback to assessmentType (legacy mapping), then default
                let tid = company.templateId;
                if (!tid && company.assessmentType) {
                    tid = company.assessmentType === 'strategy' ? 'default-strategy' : 'default-standard';
                }
                if (!tid) tid = 'default-standard';

                try {
                    const data = await getAssessmentData(tid);
                    newDataMap[company.id] = data;
                } catch (err) {
                    console.error(`Error loading data for ${company.name}`, err);
                }
            }));
            
            setDataMap(newDataMap);
            setTotalSummariesNeeded(Object.keys(newDataMap).length);
            setLoading(false);
        };
        
        loadData();
    }, [companies]);
    
    const [printingCompanyId, setPrintingCompanyId] = useState<string | null>(null);

    const handlePrintAll = () => {
        const date = new Date().toISOString().split('T')[0];
        const originalTitle = document.title;
        document.title = `BLT-Batch-${date}`;
        window.print();
        document.title = originalTitle;
    };

    const handleSaveOne = (company: Company) => {
        const date = new Date().toISOString().split('T')[0];
        const originalTitle = document.title;
        document.title = `BLT-${company.name}-${date}`;
        setPrintingCompanyId(company.id);
        setTimeout(() => {
            window.print();
            document.title = originalTitle;
            setPrintingCompanyId(null);
        }, 50);
    };

    const allSummariesReady = totalSummariesNeeded === 0 || summariesReady >= totalSummariesNeeded;

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-slate-600 font-medium">Preparing reports...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-100 min-h-screen">
            {/* No-Print Header Controls */}
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center no-print sticky top-0 z-50 shadow-md">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <h2 className="font-bold">Batch Print Preview ({companies.length} Reports)</h2>
                </div>
                <button
                    onClick={handlePrintAll}
                    disabled={!allSummariesReady}
                    className={`px-4 py-2 text-white rounded-lg font-bold flex items-center gap-2 transition-colors ${allSummariesReady ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-600 cursor-not-allowed opacity-70'}`}
                >
                    {allSummariesReady ? (
                        <><Printer className="w-4 h-4" /> Print All</>
                    ) : (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Generating summaries... {summariesReady}/{totalSummariesNeeded}</>
                    )}
                </button>
            </div>

            <div className="print:p-0 p-8">
                {companies.map((company, index) => {
                    // Get loaded assessment data
                    const companyAssessmentData = dataMap[company.id];

                    if (!companyAssessmentData) return null;

                    const isBeingPrinted = printingCompanyId === company.id;
                    const hiddenDuringIndividualPrint = printingCompanyId && !isBeingPrinted;

                    return (
                        <div key={company.id} className={hiddenDuringIndividualPrint ? 'print:hidden' : ''}>
                            <div className="bg-white shadow-xl print:shadow-none mb-8 print:mb-0 mx-auto max-w-6xl print:max-w-none">
                                {allSummariesReady && (
                                    <div className="no-print flex justify-end px-6 pt-4">
                                        <button
                                            onClick={() => handleSaveOne(company)}
                                            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium transition-colors"
                                        >
                                            <Printer className="w-3.5 h-3.5" /> Save as PDF
                                        </button>
                                    </div>
                                )}
                                <TeamReport
                                    companyName={company.name}
                                    assessmentData={companyAssessmentData}
                                    allResponses={company.responses}
                                    onRestart={() => {}}
                                    mode="batch"
                                    onSummaryReady={() => setSummariesReady(prev => prev + 1)}
                                />
                            </div>
                            {/* Force each company to start on a fresh front (odd) page in batch print */}
                            {index < companies.length - 1 && (
                                <div className={`batch-company-break ${hiddenDuringIndividualPrint ? 'print:hidden' : ''}`}></div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default BatchPrintView;