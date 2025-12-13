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

const mapTypeToTemplateId = (type?: string) => {
  if (!type) return undefined;
  const t = type.toLowerCase();
  if (t.includes('pre-planning') || t.includes('pre-planning') || t.includes('preplanning') || t.includes('pre-plann')) return 'default-coaching';
  if (t.includes('extended') || t.includes('35') || t.includes('extended')) return 'default-strategy';
  // default mapping fallback
  if (t.includes('blt')) return 'default-standard';
  return undefined;
};

const normalizeNameParam = (s: string | null) => {
  if (!s) return '';
  // Replace '+' with space (defensive), trim, and normalize spaces
  return s.replace(/\+/g, ' ').trim();
};

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

    const companyNameRaw = getParam('company');
    const companyName = normalizeNameParam(companyNameRaw);
    const mode = getParam('mode');
    const templateIdParam = getParam('template') || 'default-strategy';
    const typeParam = getParam('type'); // Used for disambiguation/fallback
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
        // Load all companies to handle duplicates
        const companies = await getCompanies();

        // Case-insensitive compare normalized names
        const normalizedInput = companyName.toLowerCase();
        const matches = companies.filter(c => (c.name || '').toLowerCase() === normalizedInput);

        if (matches.length === 1) {
          const chosen = matches[0];
          const data = await getAssessmentData(chosen.templateId || 'default-standard');
          setAssessmentData(data);
          setParticipantCompany(chosen.name);
          setParticipantCompanyId(chosen.id);
          setViewMode('PARTICIPANT');
          setIsLoading(false);
          return;
        }

        if (matches.length > 1) {
          // Try disambiguation using the type= param mapping to templateId
          const mapped = mapTypeToTemplateId(typeParam || undefined);
          if (mapped) {
            const found = matches.find(m => (m.templateId || '').toLowerCase() === mapped.toLowerCase());
            if (found) {
              const data = await getAssessmentData(found.templateId || 'default-standard');
              setAssessmentData(data);
              setParticipantCompany(found.name);
              setParticipantCompanyId(found.id);
              setViewMode('PARTICIPANT');
              setIsLoading(false);
              return;
            }
          }

          // If still ambiguous, pick the most recently created one (the second assessment you created will be newer)
          const newest = matches.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
          if (newest) {
            const data = await getAssessmentData(newest.templateId || 'default-standard');
            setAssessmentData(data);
            setParticipantCompany(newest.name);
            setParticipantCompanyId(newest.id);
            setViewMode('PARTICIPANT');
            setIsLoading(false);
            return;
          }
        }

        // No exact name match: try interpreting company param as a publicId (defensive)
        try {
          const byPublic = await getCompanyByPublicId(companyNameRaw || companyName);
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

        // As an extra fallback: try to find any company whose name includes the param string
        const partial = companies.find(c => (c.name || '').toLowerCase().includes(normalizedInput));
        if (partial) {
          const data = await getAssessmentData(partial.templateId || 'default-standard');
          setAssessmentData(data);
          setParticipantCompany(partial.name);
          setParticipantCompanyId(partial.id);
          setViewMode('PARTICIPANT');
          setIsLoading(false);
          return;
        }
      }

      // 4) Result view via query params (compatibility with older links)
      if (viewResultMode && companyName) {
        const companies = await getCompanies();
        const exact = companies.find(c => (c.name || '').toLowerCase() === companyName.toLowerCase());
        if (exact) {
          const data = await getAssessmentData(exact.templateId || 'default-standard');
          setAssessmentData(data);
          setReportCompany(exact);
          setViewMode('SINGLE_REPORT');
          setIsLoading(false);
          return;
        }

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

      {viewMode === 'MASTER_REPORT' && masterReportData && assessmentData && (
        <TeamReport companyName={masterReportData.name} assessmentData={assessmentData} allResponses={masterReportData.responses} onRestart={() => setViewMode('DASHBOARD')} mode="master" />
      )}

      {viewMode === 'MANUAL_ENTRY' && manualEntryCompany && assessmentData && (
        <ParticipantView companyName={manualEntryCompany.name} companyId={manualEntryCompany.id} assessmentData={assessmentData} />
      )}
    </div>
  );
};

export default App;
