import React, { useEffect, useState } from 'react';
import { Company, AssessmentData } from '../types';
import TeamReport from './TeamReport';
import { getAssessmentData } from '../services/geminiService';
import { downloadPdf } from '../services/pdfService';
import { ArrowLeft, Printer, Loader2, AlertCircle } from 'lucide-react';

interface BatchPrintViewProps {
    companies: Company[];
    onBack: () => void;
}

const BatchPrintView: React.FC<BatchPrintViewProps> = ({ companies, onBack }) => {
    const [loading, setLoading] = useState(true);
    const [dataMap, setDataMap] = useState<Record<string, AssessmentData>>({});
    const [summariesReady, setSummariesReady] = useState(0);
    const [totalSummariesNeeded, setTotalSummariesNeeded] = useState(0);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);

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

    const allSummariesReady = totalSummariesNeeded === 0 || summariesReady >= totalSummariesNeeded;

    const handlePrintAll = async () => {
        const date = new Date().toISOString().split('T')[0];
        const filename = companies.length === 1
            ? `BLT-${companies[0].name}-${date}`
            : `BLT-Batch-${date}`;
        setIsGeneratingPdf(true);
        setPdfError(null);
        try {
            await downloadPdf('batch-print-area', filename);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'PDF generation failed';
            setPdfError(msg);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleSaveOne = async (company: Company) => {
        const date = new Date().toISOString().split('T')[0];
        const filename = `BLT-${company.name}-${date}`;
        setIsGeneratingPdf(true);
        setPdfError(null);
        try {
            await downloadPdf(`company-report-${company.id}`, filename);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'PDF generation failed';
            setPdfError(msg);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

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
                    <h2 className="font-bold">Batch PDF Export ({companies.length} Reports)</h2>
                </div>
                <div className="flex items-center gap-3">
                    {pdfError && (
                        <div className="flex items-center gap-2 text-red-400 text-xs">
                            <AlertCircle className="w-4 h-4" />
                            <span>{pdfError}</span>
                        </div>
                    )}
                    <button
                        onClick={handlePrintAll}
                        disabled={!allSummariesReady || isGeneratingPdf}
                        className={`px-4 py-2 text-white rounded-lg font-bold flex items-center gap-2 transition-colors ${allSummariesReady && !isGeneratingPdf ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-600 cursor-not-allowed opacity-70'}`}
                    >
                        {isGeneratingPdf ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF...</>
                        ) : !allSummariesReady ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Generating summaries... {summariesReady}/{totalSummariesNeeded}</>
                        ) : (
                            <><Printer className="w-4 h-4" /> Save All as PDF</>
                        )}
                    </button>
                </div>
            </div>

            <div id="batch-print-area" className="p-8">
                {companies.map((company, index) => {
                    const companyAssessmentData = dataMap[company.id];
                    if (!companyAssessmentData) return null;

                    return (
                        <div
                            key={company.id}
                            className={index > 0 ? 'batch-company-start' : ''}
                        >
                            <div id={`company-report-${company.id}`} className="bg-white shadow-xl mb-8 mx-auto max-w-6xl">
                                {allSummariesReady && (
                                    <div className="no-print flex justify-end px-6 pt-4">
                                        <button
                                            onClick={() => handleSaveOne(company)}
                                            disabled={isGeneratingPdf}
                                            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded font-medium transition-colors ${isGeneratingPdf ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
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
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default BatchPrintView;
