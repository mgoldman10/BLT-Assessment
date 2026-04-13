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
            setLoading(false);
        };
        
        loadData();
    }, [companies]);
    
    const handlePrint = () => {
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const originalTitle = document.title;
        const names = companies.map(c => c.name).join(', ');
        document.title = `BLT - ${names} - ${dateStr}`;

        // Inject unique named @page rules per company so the CSS page counter
        // resets to 1 at the start of each report (per CSS Paged Media spec,
        // a new named-page sequence resets the page counter).
        const reports = document.querySelectorAll<HTMLElement>('.blt-assessment-report');
        let styleContent = '';
        reports.forEach((_, i) => {
            styleContent += `
                @page blt-co-${i} {
                    @bottom-right {
                        content: "Page " counter(page);
                        font-family: sans-serif;
                        font-size: 9pt;
                        color: #64748b;
                    }
                    @bottom-left {
                        content: "BLT Assessment";
                        font-family: sans-serif;
                        font-size: 9pt;
                        color: #64748b;
                    }
                }
            `;
        });
        const styleEl = document.createElement('style');
        styleEl.textContent = styleContent;
        document.head.appendChild(styleEl);
        reports.forEach((report, i) => report.style.setProperty('page', `blt-co-${i}`));

        window.print();

        // Cleanup after print dialog closes
        document.head.removeChild(styleEl);
        reports.forEach(report => report.style.removeProperty('page'));
        document.title = originalTitle;
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
                    <h2 className="font-bold">Batch Print Preview ({companies.length} Reports)</h2>
                </div>
                <div className="flex items-center gap-4">
                    <p className="text-xs text-slate-400 hidden md:block">Tip: In Chrome's print dialog, uncheck <span className="font-bold text-slate-300">Headers and footers</span> to use per-report page numbers.</p>
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
                    >
                        <Printer className="w-4 h-4" /> Print All
                    </button>
                </div>
            </div>

            <div className="print:p-0 p-8">
                {companies.map((company, index) => {
                    // Get loaded assessment data
                    const companyAssessmentData = dataMap[company.id];

                    if (!companyAssessmentData) return null;

                    return (
                        <div key={company.id}>
                            <div className="bg-white shadow-xl print:shadow-none mb-8 print:mb-0 mx-auto max-w-6xl print:max-w-none">
                                <TeamReport 
                                    companyName={company.name}
                                    assessmentData={companyAssessmentData}
                                    allResponses={company.responses}
                                    onRestart={() => {}} // Not used in batch mode
                                    mode="batch"
                                />
                            </div>
                            {/* Force page break between company reports */}
                            {index < companies.length - 1 && (
                                <div className="page-break block w-full h-0 border-none m-0 p-0"></div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default BatchPrintView;