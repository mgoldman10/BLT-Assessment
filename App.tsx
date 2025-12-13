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
  if (t.includes('pre-planning') || t.includes('preplanning') || t.includes('pre-plann')) return 'default-coaching';
  if (t.includes('extended') || t.includes('35')) return 'default-strategy';
  // default mapping fallback
  if (t.includes('blt')) return 'default-standard';
  return undefined;
};

const mapTemplateIdToTypeParam = (tid?: string) => {
  if (!tid) return 'BLT';
  if (tid === 'default-coaching') return 'Pre-Planning';
  if (tid === 'default-strategy') return 'BLT-Extended';
  return 'BLT';
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

  // Load initial user & maybe route params
  useEffect(() => {
    // Robust handling for /r/:token short links:
    // If the path is /r/:token, resolve token -> company and redirect to query-style URL
    const pathMatch = window.location.pathname.match(/^\/r\/([^\/?#]+)/);
    if (pathMatch) {
      const token = decodeURIComponent(pathMatch[1]);
      (async () => {
        try {
          // Try to find the company by publicId first, then fallback to id
          let company = await getCompanyByPublicId(token);
          if (!company) company = await getCompanyById(token);
          if (company) {
            const typeParam = mapTemplateIdToTypeParam(company.templateId);
            const url = `/?company=${encodeURIComponent(company.name)}&type=${encodeURIComponent(typeParam)}`;
            // Replace current location with the query-style URL (causes a single navigation)
            window.location.replace(url);
            return;
          }
          // If company not found, continue to parse params normally and let UI handle "not found".
        } catch (err) {
          console.error('Error resolving share token', token, err);
        }
      })();
      // stop further processing in this effect for now (we're navigating away if matched)
      return;
    }

    // existing param parsing & initialization
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

    const init = async () => {
      setIsLoading(true);
      try {
        // Try to load user session
        const current = await getCurrentUser();
        setUser(current);

        const companyNameRaw = getParam('company');
        const companyName = normalizeNameParam(companyNameRaw);
        const mode = getParam('mode');
        const templateIdParam = getParam('template') || undefined;
        const typeParam = getParam('type'); // human-readable type hint

        if (companyName) {
          // Participant or report flow via query params
          const mappedTemplateId = mapTypeToTemplateId(typeParam) || templateIdParam;
          setParticipantCompany(companyName);
          // Attempt to find the company by name and template if needed
          const comps = await getCompanies();
          const found = comps.find(c => c.name.toLowerCase() === companyName.toLowerCase() && (!mappedTemplateId || c.templateId === mappedTemplateId));
          if (found) {
            setParticipantCompanyId(found.id);
            // If mode indicates participant, go to participant view
            if (mode === 'participant' || mode === 'take') {
              setViewMode('PARTICIPANT');
              const data = await getAssessmentData(found.templateId);
              setAssessmentData(data);
            } else {
              // default: open participant view if company exists and there are responses or explicit mode
              setViewMode('PARTICIPANT');
              const data = await getAssessmentData(found.templateId);
              setAssessmentData(data);
            }
          } else {
            // If not found, maybe this is a quick link for creating a temporary company view
            // We'll render ParticipantView but without a persisted company
            setParticipantCompanyId('');
            setViewMode('PARTICIPANT');
            const useTemplate = mappedTemplateId || 'default-strategy';
            const data = await getAssessmentData(useTemplate);
            setAssessmentData(data);
          }
        } else {
          // No direct company in URL — default behavior: show dashboard or login
          setViewMode(current ? 'DASHBOARD' : 'LOGIN');
        }
      } catch (err) {
        console.error('App init error', err);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  // Utility: view a single report (Admin -> Report)
  const onViewReport = async (company: Company) => {
    setIsLoading(true);
    try {
      setReportCompany(company);
      setViewMode('SINGLE_REPORT');
    } finally {
      setIsLoading(false);
    }
  };

  const onBatchPrint = async (companies: Company[]) => {
    setBatchCompanies(companies);
    setViewMode('BATCH_PRINT');
  };

  const onMasterReport = async (companies: Company[]) => {
    // Simple master report: choose first company's template and aggregate externally
    if (!companies || companies.length === 0) return;
    setMasterReportData(companies[0]);
    setViewMode('MASTER_REPORT');
  };

  const onManualEntry = async (company: Company) => {
    setManualEntryCompany(company);
    setViewMode('MANUAL_ENTRY');
  };

  // Participant submits their responses
  const handleParticipantSubmit = async (companyIdOrName: string, response: ParticipantResponse, templateId?: string) => {
    setIsLoading(true);
    try {
      // If we have a persisted companyId, use it. Otherwise, create a company record (ephemeral or saved)
      let companyId = companyIdOrName;
      let companyRecord: Company | undefined;
      if (!companyId) {
        // create new company with provided name if needed
        const created = await createCompany(participantCompany || 'Anonymous', templateId || 'default-strategy');
        companyId = created.id;
        companyRecord = created;
      } else {
        // attempt to find company in storage (by id)
        const comps = await getCompanies();
        companyRecord = comps.find(c => c.id === companyId);
      }

      await addResponseToCompany(companyId, response);

      // Mark viewed / update last activity
      await markCompanyViewed(companyId);

      // Optionally trigger automation webhook if configured
      try {
        await triggerAutomationWebhook({ companyId, response });
      } catch (e) {
        // Non-fatal
        console.warn('Webhook failed', e);
      }

      // After submission, redirect to a thank-you / report page (reuse report view)
      if (companyRecord) {
        setReportCompany(companyRecord);
        setViewMode('SINGLE_REPORT');
      } else {
        // fetch refreshed company if newly created
        const comps = await getCompanies();
        const found = comps.find(c => c.id === companyId);
        if (found) {
          setReportCompany(found);
          setViewMode('SINGLE_REPORT');
        } else {
          // fallback to dashboard
          setViewMode('DASHBOARD');
        }
      }
    } catch (err) {
      console.error('Submit error', err);
      alert('Failed to submit response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setViewMode('LOGIN');
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;

  // Render by mode
  if (viewMode === 'LOGIN') {
    return <LoginScreen onLogin={(u) => { setUser(u); setViewMode('DASHBOARD'); }} />;
  }

  if (viewMode === 'DASHBOARD') {
    return (
      <AdminDashboard
        user={user as User}
        onLogout={handleLogout}
        onViewReport={onViewReport}
        onBatchPrint={onBatchPrint}
        onMasterReport={onMasterReport}
        onManualEntry={onManualEntry}
      />
    );
  }

  if (viewMode === 'PARTICIPANT') {
    return (
      <ParticipantView
        companyName={participantCompany}
        companyId={participantCompanyId}
        assessmentData={assessmentData}
        onSubmit={(response) => handleParticipantSubmit(participantCompanyId, response, assessmentData?.templateId)}
      />
    );
  }

  if (viewMode === 'SINGLE_REPORT' && reportCompany) {
    return (
      <TeamReport company={reportCompany} onBack={() => setViewMode('DASHBOARD')} />
    );
  }

  if (viewMode === 'BATCH_PRINT') {
    return <BatchPrintView companies={batchCompanies} onBack={() => setViewMode('DASHBOARD')} />;
  }

  if (viewMode === 'MASTER_REPORT' && masterReportData) {
    return <TeamReport company={masterReportData} onBack={() => setViewMode('DASHBOARD')} masterMode={true} />;
  }

  if (viewMode === 'MANUAL_ENTRY' && manualEntryCompany) {
    return <TeamReport company={manualEntryCompany} onBack={() => setViewMode('DASHBOARD')} manualEntryMode={true} />;
  }

  // Default fallback
  return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
};

export default App;
