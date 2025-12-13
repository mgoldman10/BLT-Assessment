import React, { useEffect, useState } from 'react';
import { Company, AssessmentData } from '../types';
import { getAssessmentData } from '../services/geminiService';
import TeamReport from './TeamReport';
import { ArrowLeft, Printer } from 'lucide-react';

export interface BatchPrintViewProps {
  companies: Company[];
  onDone: () => void; // Added: callback to return to dashboard or previous view
}

const BatchPrintView: React.FC<BatchPrintViewProps> = ({ companies, onDone }) => {
  const [templatesByCompany, setTemplatesByCompany] = useState<Record<string, AssessmentData | null>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadTemplates = async () => {
      setIsLoading(true);
      const map: Record<string, AssessmentData | null> = {};
      for (const c of companies) {
        try {
          const tpl = await getAssessmentData(c.templateId || 'default-standard');
          map[c.id] = tpl;
        } catch (err) {
          console.warn(`Failed to load template for company ${c.id}`, err);
          map[c.id] = null;
        }
      }
      if (mounted) {
        setTemplatesByCompany(map);
        setIsLoading(false);
      }
    };

    loadTemplates();
    return () => { mounted = false; };
  }, [companies]);

  const handlePrint = () => {
    // Give browser a tick to re-render if needed, then print
    setTimeout(() => window.print(), 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-black text-white">
        <div className="text-neutral-400">Preparing print view...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black text-white px-6 py-8">
      <div className="max-w-6xl mx-auto mb-6 flex items-center justify-between gap-4">
        <button onClick={onDone} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex gap-2">
          <button onClick={handlePrint} className="px-4 py-2 bg-brand-orange hover:bg-orange-600 rounded-lg flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print All
          </button>
          <button onClick={onDone} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg">Done</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-12">
        {companies.map((c) => {
          const tpl = templatesByCompany[c.id];
          return (
            <section key={c.id} className="bg-neutral-900 p-6 rounded-2xl border border-neutral-700 print:page-break-before break-inside-avoid">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white">{c.name}</h3>
                <div className="text-sm text-brand-grey">{c.templateId || 'default-standard'} • {c.responses.length} Responses</div>
              </div>

              {tpl ? (
                <TeamReport
                  companyName={c.name}
                  assessmentData={tpl}
                  allResponses={c.responses}
                  onRestart={() => { /* no-op in batch print view */ }}
                  mode="batch"
                />
              ) : (
                <div className="p-4 bg-neutral-800 rounded-lg text-brand-grey">
                  Unable to load template for this company. Skipping.
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default BatchPrintView;
