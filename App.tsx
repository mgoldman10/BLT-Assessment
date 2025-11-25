
import React, { useState, useEffect } from 'react';
import { AssessmentData, Company, ParticipantResponse, User } from './types';
import { getAssessmentData } from './services/geminiService';
import { getCompanies, saveCompany, addResponseToCompany } from './services/storage';
import { getCurrentUser, logout } from './services/authService';
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

  // Report State
  const [reportCompany, setReportCompany] = useState<Company | null>(null);
  const [batchCompanies, setBatchCompanies] = useState<Company[]>([]);
  const [masterReportData, setMasterReportData] = useState<Company | null>(null);

  // Manual Entry State
  const [manualEntryCompany, setManualEntryCompany] = useState<Company | null>(null);

  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);

  useEffect(() => {
    const getCompanyParam = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const companyFromQuery = urlParams.get('company');
        if (companyFromQuery) return companyFromQuery;

        if (window.location.hash && window.location.hash.includes('?')) {
            try {
                const hashString = window.location.hash.split('?')[1];
                const hashParams = new URLSearchParams(hashString);
                return hashParams.get('company');
            } catch (e) {
                console.warn("Error parsing hash params", e);
            }
        }
        return null;
    };

    const companyName = getCompanyParam();

    const loadData = async () => {
      // 1. Check for Participant Mode (User clicking a link)
      if (companyName) {
        const companies = await getCompanies();
        const targetCompany = companies.find(c => c.name === companyName);
        
        if (targetCompany) {
             const data = await getAssessmentData(targetCompany.templateId || 'default-standard');
             setAssessmentData(data);
             setParticipantCompany(companyName);
             setViewMode('PARTICIPANT');
        } else {
             const data = await getAssessmentData('default-standard');
             setAssessmentData(data);
             setParticipantCompany(companyName);
             setViewMode('PARTICIPANT');
        }
      } else {
        // 2. Dashboard Mode - Check Auth
        const currentUser = getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setViewMode('DASHBOARD');
        } else {
          setViewMode('LOGIN');
        }
      }
      setIsLoading(false);
    };

    loadData();
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setViewMode('DASHBOARD');
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setViewMode('LOGIN');
  };

  const handleViewReport = async (company: Company) => {
    setIsLoading(true);
    const data = await getAssessmentData(company.templateId || 'default-standard');
    setAssessmentData(data);
    setReportCompany(company);
    setViewMode('SINGLE_REPORT');
    setIsLoading(false);
  };

  const handleBatchPrint = (companies: Company[]) => {
    setBatchCompanies(companies);
    setViewMode('BATCH_PRINT');
  };

  const handleMasterReport = async (companies: Company[]) => {
    setIsLoading(true);
    const primaryTemplateId = companies[0]?.templateId || 'default-standard';
    const data = await getAssessmentData(primaryTemplateId);
    setAssessmentData(data);

    const allResponses: ParticipantResponse[] = [];
    companies.forEach(c => {
        allResponses.push(...c.responses);
    });

    const masterCompany: Company = {
        id: 'master-report',
        name: `Aggregate Report (${companies.length} Companies)`,
        templateId: primaryTemplateId,
        createdAt: Date.now(),
        responses: allResponses
    };

    setMasterReportData(masterCompany);
    setViewMode('MASTER_REPORT');
    setIsLoading(false);
  };
  
  const handleManualEntryStart = async (company: Company) => {
      setIsLoading(true);
      const data = await getAssessmentData(company.templateId || 'default-standard');
      setAssessmentData(data);
      setManualEntryCompany(company);
      setViewMode('MANUAL_ENTRY');
      setIsLoading(false);
  };

  const handleManualEntrySave = async (response: ParticipantResponse) => {
      if (manualEntryCompany) {
          // We use the optimized addResponse function here
          await addResponseToCompany(manualEntryCompany.id, response);
          alert(`Saved response for ${response.firstName} ${response.lastName}`);
          setManualEntryCompany(null);
          setViewMode('DASHBOARD');
      }
  };

  const handleBackToDashboard = () => {
    setReportCompany(null);
    setBatchCompanies([]);
    setMasterReportData(null);
    setManualEntryCompany(null);
    setViewMode('DASHBOARD');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-50 flex items-center justify-center">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  // --- Public View ---
  if (viewMode === 'PARTICIPANT' && assessmentData) {
    return <ParticipantView companyName={participantCompany} assessmentData={assessmentData} />;
  }

  // --- Protected Views ---
  
  if (viewMode === 'LOGIN') {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (viewMode === 'MANUAL_ENTRY' && assessmentData && manualEntryCompany) {
      return (
        <div className="relative">
            <div className="absolute top-4 left-4 z-50">
                <button onClick={handleBackToDashboard} className="px-4 py-2 bg-slate-800 text-white rounded-lg shadow-lg font-bold text-xs hover:bg-slate-700">
                    Cancel Entry
                </button>
            </div>
            <ParticipantView 
                companyName={manualEntryCompany.name} 
                assessmentData={assessmentData} 
                onSubmit={handleManualEntrySave}
            />
        </div>
      );
  }

  if (viewMode === 'SINGLE_REPORT' && reportCompany && assessmentData) {
    return (
      <TeamReport 
        companyName={reportCompany.name}
        assessmentData={assessmentData} 
        allResponses={reportCompany.responses} 
        onRestart={handleBackToDashboard}
        mode="single"
      />
    );
  }

  if (viewMode === 'BATCH_PRINT') {
    return (
        <BatchPrintView 
            companies={batchCompanies}
            onBack={handleBackToDashboard}
        />
    );
  }

  if (viewMode === 'MASTER_REPORT' && masterReportData && assessmentData) {
      return (
        <TeamReport
            companyName={masterReportData.name}
            assessmentData={assessmentData}
            allResponses={masterReportData.responses}
            onRestart={handleBackToDashboard}
            mode="master"
        />
      );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-50 font-sans selection:bg-blue-500/30">
        <AdminDashboard 
            user={user}
            onLogout={handleLogout}
            onViewReport={handleViewReport} 
            onBatchPrint={handleBatchPrint}
            onMasterReport={handleMasterReport}
            onManualEntry={handleManualEntryStart}
        />
      </div>
    );
  }
  
  // Fallback
  return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
};

export default App;
