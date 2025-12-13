import React, { useState, useEffect } from 'react';
import { AssessmentData, Company, ParticipantResponse, User } from './types';
import { getAssessmentData } from './services/geminiService';
import { getCompanies, saveCompany, addResponseToCompany, markCompanyViewed, getSettings, createCompany, getCompanyByPublicId, getCompanyById } from './services/storage'; 
import { getCurrentUser, logout } from './services/authService';
import { triggerAutomationWebhook } from './services/webhookService';
import LoadingSpinner from './components/LoadingSpinner';
import TeamReport from './components/TeamReport';
import AdminDashboard from './components/AdminDashboard';
import ParticipantView from './components/ParticipantView';
import BatchPrintView from './components/BatchPrintView';
import LoginScreen from './components/LoginScreen';

type ViewMode = 'LOGIN' | 'DASHBOARD' | 'PARTICIPANT' | 'SINGLE_REPORT' | 'BATCH_PRINT' | 'MASTER_REPORT' | 'MANUAL_ENTRY';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('DASHBOARD');
  const [user, setUser] = useState<User | null>(null);
  
  // Participant State
  const [participantCompany, setParticipantCompany] = useState('');
  const [participantCompanyId, setParticipantCompanyId] = useState<string>(''); 

  // Report State
  const [reportCompany, setReportCompany] = useState<Company | null>(null);
  const [batchCompanies, setBatchCompanies] = useState<Company[]>([]);
  const [masterReportData, setMasterReportData] = useState<Company | null>(null);

  // Manual Entry State
  const [manualEntryCompany, setManualEntryCompany] = useState<Company | null>(null);

  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);

  useEffect(() => {
    const getParam = (key: string) => {
        const urlParams = new URLSearchParams(window.location.search);
        const param = urlParams.get(key);
        if (param) return param;

        if (window.location.hash && window.location.hash.includes('?')) {
            try {
                const hashString = window.location.hash.split('?')[1];
                const hashParams = new URLSearchParams(hashString);
                return hashParams.get(key);
            } catch (e) {}
        }
        return null;
    };

    const companyName = getParam('company');
    const mode = getParam('mode');
    const templateIdParam = getParam('template') || 'default-strategy';
    const typeParam = getParam('type'); // Used for fallback
    const viewResultMode = getParam('mode') === 'view_result' || getParam('mode') === 'view';

    const loadData = async () => {
      // 1) Path-based public link: /r/:publicId (highest priority)
      try {
        const pathname = window.location.pathname || '';
        const normalized = pathname.replace(/\/+$/, '');
        if (normalized.startsWith('/r/')) {
          const token = decodeURIComponent(normalized.split('/r/')[1] || '');
          if (token) {
            const company = await getCompanyByPublicId(token);
            if (company) {
              const data = await getAssessmentData(company.templateId || 'default-standard');
              setAssessmentData(data);
              setParticipantCompany(company.name || '');
              setParticipantCompanyId(company.id);
              setViewMode('PARTICIPANT');
              setIsLoading(false);
              return;
            }
          }
        }
      } catch (e) {
        console.warn('Public link handling failed', e);
      }

      // 2) Query param public/embed mode: ?mode=public&template=...
      if (mode === 'public') {
          const data = await getAssessmentData(templateIdParam);
          setAssessmentData(data);
          setParticipantCompany(''); 
          setParticipantCompanyId('PUBLIC_NEW'); 
          setViewMode('PARTICIPANT');
          setIsLoading(false);
          return;
      }

      // 3) Query param participant via company name or (defensive) publicId in company param
      if (companyName) {
        // First try exact company name match
        const companies = await getCompanies();
        const exactByName = companies.find(c => c.name === companyName);

        if (exactByName) {
             let finalTemplateId = exactByName.templateId || 'default-standard';
             if (!exactByName.templateId && typeParam) {
                 if (typeParam === 'Pre-Planning') finalTemplateId = 'default-coaching';
                 else if (typeParam === 'BLT-Extended') finalTemplateId = 'default-strategy';
             }
             const data = await getAssessmentData(finalTemplateId);
             setAssessmentData(data);
             setParticipantCompany(exactByName.name);
             setParticipantCompanyId(exactByName.id);
             setViewMode('PARTICIPANT');
             setIsLoading(false);
             return;
        } else {
            // If not found by name, try interpreting the company param as a publicId
            try {
              const byPublic = await getCompanyByPublicId(companyName);
              if (byPublic) {
                const data = await getAssessmentData(byPublic.templateId || 'default-standard');
                setAssessmentData(data);
                setParticipantCompany(byPublic.name);
                setParticipantCompanyId(byPublic.id);
                setViewMode('PARTICIPANT');
                setIsLoading(false);
                return;
              }
            } catch (e) {
              // fall through
            }
        }
      }

      // 4) Result view via query params (compatibility with older links)
      if (viewResultMode && companyName) {
        // If old links use ?mode=view_result&company=Name, try resolving to a company object:
        const companies = await getCompanies();
        const byName = companies.find(c => c.name === companyName);
        if (byName) {
          // load its template and show a report view (admin-like single report)
          const data = await getAssessmentData(byName.templateId || 'default-standard');
          setAssessmentData(data);
          setReportCompany(byName);
          setViewMode('SINGLE_REPORT');
          setIsLoading(false);
          return;
        } else {
          // try publicId
          const byPublic = await getCompanyByPublicId(companyName);
          if (byPublic) {
            const data = await getAssessmentData(byPublic.templateId || 'default-standard');
            setAssessmentData(data);
            setReportCompany(byPublic);
            setViewMode('SINGLE_REPORT');
            setIsLoading(false);
            return;
          }
        }
      }

      // Default: show dashboard or login depending on session
      const current = getCurrentUser();
      if (current) {
        setUser(current);
        setViewMode('DASHBOARD');
      } else {
        setViewMode('LOGIN');
      }
      setIsLoading(false);
    };

    loadData();
  }, []);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      {viewMode === 'LOGIN' && <LoginScreen onLoginSuccess={(u) => { setUser(u); setViewMode('DASHBOARD'); }} />}
      {viewMode === 'DASHBOARD' && user && (
        <AdminDashboard
          user={user}
          onLogout={() => { logout(); setUser(null); setViewMode('LOGIN'); }}
          onViewReport={(c) => { setReportCompany(c); setViewMode('SINGLE_REPORT'); }}
          onBatchPrint={(cs) => { setBatchCompanies(cs); setViewMode('BATCH_PRINT'); }}
          onMasterReport={(c) => { setMasterReportData(c[0]); setViewMode('MASTER_REPORT'); }}
          onManualEntry={(c) => { setManualEntryCompany(c); setViewMode('MANUAL_ENTRY'); }}
        />
      )}

      {viewMode === 'PARTICIPANT' && assessmentData && (
        <ParticipantView
          companyName={participantCompany}
          companyId={participantCompanyId || undefined}
          assessmentData={assessmentData}
        />
      )}

      {viewMode === 'SINGLE_REPORT' && reportCompany && assessmentData && (
        <TeamReport
          companyName={reportCompany.name}
          assessmentData={assessmentData}
          allResponses={reportCompany.responses}
          onRestart={() => window.location.reload()}
        />
      )}

      {viewMode === 'BATCH_PRINT' && (
        <BatchPrintView companies={batchCompanies} onDone={() => setViewMode('DASHBOARD')} />
      )}

      {/* MASTER_REPORT and MANUAL_ENTRY kept minimal here */}
      {viewMode === 'MASTER_REPORT' && masterReportData && (
        <TeamReport companyName={masterReportData.name} assessmentData={assessmentData!} allResponses={masterReportData.responses} onRestart={() => setViewMode('DASHBOARD')} mode="master" />
      )}

      {viewMode === 'MANUAL_ENTRY' && manualEntryCompany && (
        <ParticipantView companyName={manualEntryCompany.name} companyId={manualEntryCompany.id} assessmentData={assessmentData || ({} as AssessmentData)} />
      )}
    </div>
  );
};

export default App;
