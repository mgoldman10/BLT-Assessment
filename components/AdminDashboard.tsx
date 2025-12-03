import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Company, UserAnswers, ParticipantResponse, AssessmentTemplate, Category, User, UserRole } from '../types';
import { getCompanies, createCompany, saveCompany, deleteCompany, decodeResponse, saveLogo, getLogo, removeLogo, getTemplates, saveTemplate, deleteTemplate, addResponseToCompany, seedTemplates, getUsers, saveUser, deleteUser, updateUserPassword, getSettings, saveSettings } from '../services/storage';
import { isConfigured } from '../services/firebaseConfig';
import { getAssessmentData, generateAssessmentTemplate } from '../services/geminiService';
import { logout, verifyPassword } from '../services/authService';
import { sendUserInvite } from '../services/emailService';
import { Plus, BarChart2, Trash2, Users, Terminal, Share2, X, Search, Calendar, Copy, Check, Layers, Printer, UserPlus, Edit3, Settings, Upload, Image as ImageIcon, AlertTriangle, FileText, LayoutList, Tag, Filter, ArrowUpDown, RotateCcw, RefreshCw, Cloud, HardDrive, Sparkles, Loader2, LogOut, ChevronDown, CheckSquare, Square, Shield, Mail, Lock, Clock, Key } from 'lucide-react';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
  onViewReport: (company: Company) => void;
  onBatchPrint: (companies: Company[]) => void;
  onMasterReport: (companies: Company[]) => void;
  onManualEntry: (company: Company) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onViewReport, onBatchPrint, onMasterReport, onManualEntry }) => {
  const [activeTab, setActiveTab] = useState<'companies' | 'templates' | 'users'>('companies');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Default sort is now "Last Activity"
  const [sortOption, setSortOption] = useState<'activity' | 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'resp-desc' | 'resp-asc'>('activity');
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterTemplateIds, setFilterTemplateIds] = useState<Set<string>>(new Set());
  const [isTemplateFilterOpen, setIsTemplateFilterOpen] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  const [isCreating, setIsCreating] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyTemplateId, setNewCompanyTemplateId] = useState('default-standard');
  const [newCompanyTags, setNewCompanyTags] = useState('');

  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<AssessmentTemplate | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('ADMIN');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [sendInvite, setSendInvite] = useState(true);
  
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

  // AI Generation State
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pasteToken, setPasteToken] = useState('');
  
  const [showManageModal, setShowManageModal] = useState(false);
  const [managingCompany, setManagingCompany] = useState<Company | null>(null);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [settings, setSettings] = useState<{ logoUrl?: string, webhookUrl?: string }>({});

  const [renamingCompany, setRenamingCompany] = useState<Company | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<AssessmentTemplate | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [responseToDelete, setResponseToDelete] = useState<{ companyId: string; responseId: string; name: string } | null>(null);

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [showBulkLinksModal, setShowBulkLinksModal] = useState(false);
  const [bulkLinksText, setBulkLinksText] = useState('');
  
  const templateFilterRef = useRef<HTMLDivElement>(null);

  const isCloud = isConfigured();
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  useEffect(() => {
    refreshData();
    const initSettings = async () => {
        const s = await getSettings();
        setSettings(s || {});
        setCustomLogo(s?.logoUrl || null);
    };
    initSettings();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templateFilterRef.current && !templateFilterRef.current.contains(event.target as Node)) {
        setIsTemplateFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const refreshData = async () => {
    setIsLoading(true);
    const [c, t, u] = await Promise.all([getCompanies(), getTemplates(), getUsers()]);
    setCompanies(c);
    setTemplates(t);
    setUsers(u);
    setIsLoading(false);
  };

  const handleSaveWebhook = async () => {
    await saveSettings({ webhookUrl: settings.webhookUrl });
    alert("Webhook settings saved!");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPasswordInput !== confirmPasswordInput) {
          alert("New passwords do not match.");
          return;
      }
      if (!verifyPassword(user, currentPassword)) {
          alert("Current password incorrect.");
          return;
      }
      await updateUserPassword(user.id, newPasswordInput);
      alert("Password updated successfully. Please log in again.");
      onLogout();
  };

  const handleReseed = async () => {
      try {
        await seedTemplates();
        await refreshData();
        alert("Defaults templates restored.");
      } catch (e) {
        alert("Failed to restore templates.");
      }
  };

  const allUniqueTags = useMemo(() => {
    const tags = new Set<string>();
    companies.forEach(c => {
      if (c.tags) c.tags.forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [companies]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCompanyName.trim()) {
      setIsLoading(true);
      const tags = newCompanyTags.split(',').map(t => t.trim()).filter(t => t !== '');
      const selectedTemplateId = newCompanyTemplateId || 'default-standard';
      await createCompany(newCompanyName.trim(), selectedTemplateId, tags);
      await refreshData();
      setIsLoading(false);
      setIsCreating(false);
      setNewCompanyName('');
      setNewCompanyTemplateId('default-standard');
      setNewCompanyTags('');
    }
  };

  const startRenamingCompany = (company: Company) => {
    setRenamingCompany(company);
    setRenameValue(company.name);
  };

  const handleRenameSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (renamingCompany && renameValue.trim()) {
      const updated = { ...renamingCompany, name: renameValue.trim() };
      await saveCompany(updated);
      await refreshData();
      setRenamingCompany(null);
    }
  };

  const confirmDeleteCompany = async () => {
    if (companyToDelete) {
      await deleteCompany(companyToDelete.id);
      await refreshData();
      if (selectedIds.has(companyToDelete.id)) {
        const newSelected = new Set(selectedIds);
        newSelected.delete(companyToDelete.id);
        setSelectedIds(newSelected);
      }
      setCompanyToDelete(null);
    }
  };

  const handleCreateTemplate = async () => {
    const newTemplate: AssessmentTemplate = {
      id: `custom-${Date.now()}`,
      name: "New Custom Assessment",
      categories: [
        { id: 'cat-0', name: 'New Pillar 1', questions: [{ id: 'q-0-0', text: 'New Question 1' }] }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await saveTemplate(newTemplate);
    await refreshData();
    setEditingTemplate(newTemplate);
  };

  const handleGenerateAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopic.trim()) return;

    setIsGeneratingAI(true);
    try {
        const generated = await generateAssessmentTemplate(aiTopic);
        const newTemplate: AssessmentTemplate = {
            id: `ai-${Date.now()}`,
            name: generated.name,
            categories: generated.categories,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        await saveTemplate(newTemplate);
        await refreshData();
        setShowAIModal(false);
        setAiTopic('');
    } catch (error) {
        console.error(error);
        alert("Failed to generate assessment. Please check your API Key and try again.");
    } finally {
        setIsGeneratingAI(false);
    }
  };

  const handleSaveTemplate = async (template: AssessmentTemplate) => {
    await saveTemplate(template);
    await refreshData();
    setEditingTemplate(null);
  };

  const confirmDeleteTemplate = async () => {
    if (templateToDelete) {
      await deleteTemplate(templateToDelete.id);
      await refreshData();
      setTemplateToDelete(null);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newUserName && newUserEmail && newUserPassword) {
          const u: User = {
              id: editingUser ? editingUser.id : `user-${Date.now()}`,
              name: newUserName,
              email: newUserEmail,
              role: newUserRole,
              password: newUserPassword
          };
          await saveUser(u);
          if (sendInvite && !editingUser) {
             await sendUserInvite(newUserName, newUserEmail, newUserRole, newUserPassword);
             alert("User saved and invite sent!");
          }
          await refreshData();
          setShowUserModal(false);
          setEditingUser(null);
          setNewUserName(''); setNewUserEmail(''); setNewUserPassword('');
      }
  };

  const confirmDeleteUser = async () => {
      if (userToDelete) {
          await deleteUser(userToDelete.id);
          await refreshData();
          setUserToDelete(null);
      }
  };

  const handleSimulateData = async (company: Company) => {
    const assessmentData = await getAssessmentData(company.templateId);
    const firstNames = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth"];
    const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"];

    for (let i = 0; i < 5; i++) {
      const answers: UserAnswers = {};
      assessmentData.categories.forEach(cat => {
          cat.questions.forEach(q => {
              const rand = Math.random();
              let val = 2;
              if (rand < 0.1) val = 0;
              else if (rand < 0.2) val = 1;
              else if (rand < 0.35) val = 2;
              else if (rand < 0.65) val = 3;
              else val = 4;
              answers[q.id] = val;
          });
      });
      
      const rFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const rLastName = lastNames[Math.floor(Math.random() * lastNames.length)];

      const response = {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2),
          firstName: rFirstName,
          lastName: rLastName,
          email: `${rFirstName.toLowerCase()}.${rLastName.toLowerCase()}@example.com`,
          timestamp: Date.now(),
          answers
      };
      
      await addResponseToCompany(company.id, response);
    }
    
    await refreshData();
    alert("Simulated data added!");
  };

  const getShareLink = (company: Company) => {
    const baseUrl = window.location.origin + window.location.pathname;
    const cleanPath = baseUrl.split('?')[0];
    
    let typeParam = 'BLT';
    if (company.templateId === 'default-coaching') {
        typeParam = 'Pre-Planning';
    } else if (company.templateId === 'default-strategy') {
        typeParam = 'BLT-Extended';
    } else {
        const template = templates.find(t => t.id === company.templateId);
        if (template) {
            const name = template.name.toLowerCase();
            if (name.includes('coaching') || name.includes('planning')) typeParam = 'Pre-Planning';
            else if (name.includes('35')) typeParam = 'BLT-Extended';
        }
    }

    const params = new URLSearchParams();
    params.set('company', company.name);
    params.set('type', typeParam);

    return `${cleanPath}?${params.toString()}`;
  };

  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const toggleTemplateFilter = (templateId: string) => {
      const newSet = new Set(filterTemplateIds);
      if (newSet.has(templateId)) newSet.delete(templateId);
      else newSet.add(templateId);
      setFilterTemplateIds(newSet);
  };

  const filteredCompanies = companies
    .filter(c => {
        const searchLower = searchTerm.toLowerCase();
        const nameMatch = c.name.toLowerCase().includes(searchLower);
        const tagMatch = c.tags && c.tags.some(tag => tag.toLowerCase().includes(searchLower));
        const textMatch = nameMatch || tagMatch;
        const tagFilterMatch = filterTag ? (c.tags && c.tags.includes(filterTag)) : true;
        const templateMatch = filterTemplateIds.size === 0 || filterTemplateIds.has(c.templateId);

        let dateMatch = true;
        if (filterStartDate) {
            const startTs = new Date(filterStartDate).setHours(0,0,0,0);
            if (c.createdAt < startTs) dateMatch = false;
        }
        if (filterEndDate && dateMatch) {
            const endTs = new Date(filterEndDate).setHours(23,59,59,999);
            if (c.createdAt > endTs) dateMatch = false;
        }

        return textMatch && tagFilterMatch && dateMatch && templateMatch;
    })
    .sort((a, b) => {
        switch (sortOption) {
            case 'activity': return (b.lastActivity || 0) - (a.lastActivity || 0);
            case 'date-desc': return b.createdAt - a.createdAt;
            case 'date-asc': return a.createdAt - b.createdAt;
            case 'name-asc': return a.name.localeCompare(b.name);
            case 'name-desc': return b.name.localeCompare(a.name);
            case 'resp-desc': return b.responses.length - a.responses.length;
            case 'resp-asc': return a.responses.length - b.responses.length;
            default: return (b.lastActivity || 0) - (a.lastActivity || 0);
        }
    });

  const handleSelectAll = () => {
      const allFilteredSelected = filteredCompanies.length > 0 && filteredCompanies.every(c => selectedIds.has(c.id));
      if (allFilteredSelected) {
          const newSet = new Set(selectedIds);
          filteredCompanies.forEach(c => newSet.delete(c.id));
          setSelectedIds(newSet);
      } else {
          const newSet = new Set(selectedIds);
          filteredCompanies.forEach(c => newSet.add(c.id));
          setSelectedIds(newSet);
      }
  };

  const resetFilters = () => {
      setSearchTerm('');
      setFilterTag('');
      setFilterTemplateIds(new Set());
      setFilterStartDate('');
      setFilterEndDate('');
      setSortOption('activity');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 border-b border-brand-grey/20 pb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-2 leading-tight">Admin Dashboard</h1>
          <div className="flex items-center gap-2">
            <p className="text-brand-grey">Welcome, {user.name}.</p>
            {isCloud ? 
                <span className="flex items-center gap-1 text-[10px] uppercase font-bold bg-green-900/30 text-green-400 px-2 py-0.5 rounded border border-green-800"><Cloud className="w-3 h-3"/> Cloud Active</span> : 
                <span className="flex items-center gap-1 text-[10px] uppercase font-bold bg-neutral-700 text-neutral-400 px-2 py-0.5 rounded border border-neutral-600"><HardDrive className="w-3 h-3"/> Local Storage</span>
            }
          </div>
        </div>
        <div className="flex gap-3">
            <button
                onClick={() => {
                    setNewPasswordInput('');
                    setConfirmPasswordInput('');
                    setCurrentPassword('');
                    setShowChangePasswordModal(true);
                }}
                className="px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold flex items-center gap-2 transition-colors shadow-lg border border-brand-grey/10"
                title="Change Password"
            >
                <Key className="w-5 h-5" />
            </button>
            {isSuperAdmin && (
                <button 
                    onClick={() => setShowSettingsModal(true)}
                    className="px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold flex items-center gap-2 transition-colors shadow-lg border border-brand-grey/10"
                    title="Settings"
                >
                    <Settings className="w-5 h-5" />
                </button>
            )}
            <button 
                onClick={onLogout}
                className="px-4 py-3 bg-neutral-800 hover:bg-red-900/30 text-white hover:text-red-400 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-lg border border-brand-grey/10"
                title="Logout"
            >
                <LogOut className="w-5 h-5" />
            </button>
            <button 
                onClick={() => setIsCreating(true)}
                className="px-6 py-3 bg-brand-orange hover:bg-orange-600 text-white rounded-xl font-bold flex items-center gap-2 transition-colors shadow-lg shadow-orange-900/20"
            >
                <Plus className="w-5 h-5" /> New Assessment
            </button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-neutral-800 mb-8">
        <button
          onClick={() => setActiveTab('companies')}
          className={`px-4 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'companies' ? 'border-brand-orange text-brand-orange' : 'border-transparent text-brand-grey hover:text-white'}`}
        >
          <div className="flex items-center gap-2"><LayoutList className="w-4 h-4" /> Manage Companies</div>
        </button>
        {isSuperAdmin && (
            <>
                <button
                onClick={() => setActiveTab('templates')}
                className={`px-4 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'templates' ? 'border-brand-orange text-brand-orange' : 'border-transparent text-brand-grey hover:text-white'}`}
                >
                <div className="flex items-center gap-2"><FileText className="w-4 h-4" /> Manage Templates</div>
                </button>
                <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'users' ? 'border-brand-orange text-brand-orange' : 'border-transparent text-brand-grey hover:text-white'}`}
                >
                <div className="flex items-center gap-2"><Users className="w-4 h-4" /> Manage Users</div>
                </button>
            </>
        )}
      </div>

      {/* --- COMPANIES TAB --- */}
      {activeTab === 'companies' && (
        <>
          {isCreating && (
            <div className="mb-8 p-6 bg-neutral-800 rounded-2xl border border-neutral-700 animate-in fade-in slide-in-from-top-4">
              <form onSubmit={handleCreateCompany} className="flex flex-col gap-4">
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                    <label className="block text-sm font-medium text-brand-grey mb-2">Company / Team Name</label>
                    <input 
                        type="text" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)}
                        className="w-full px-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none"
                        placeholder="e.g. Acme Corp Leadership" autoFocus
                    />
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-brand-grey mb-2">Tags (Optional)</label>
                    <input 
                        type="text" value={newCompanyTags} onChange={(e) => setNewCompanyTags(e.target.value)}
                        className="w-full px-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none"
                        placeholder="e.g. Q1, Tech Team"
                    />
                    </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-grey mb-2">Select Template</label>
                  <select value={newCompanyTemplateId} onChange={(e) => setNewCompanyTemplateId(e.target.value)} className="w-full px-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none">
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.categories.reduce((a,c) => a + c.questions.length, 0)} questions)</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 justify-end mt-2">
                    <button type="button" onClick={() => setIsCreating(false)} className="px-6 py-3 bg-neutral-700 hover:bg-neutral-600 text-white rounded-xl font-bold">Cancel</button>
                    <button type="submit" disabled={isLoading} className="px-6 py-3 bg-brand-orange hover:bg-orange-600 text-white rounded-xl font-bold">{isLoading ? 'Creating...' : 'Create Assessment'}</button>
                </div>
              </form>
            </div>
          )}

          <div className="mb-6 space-y-4">
            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-brand-grey w-5 h-5" />
                    <input type="text" placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-neutral-800 border border-neutral-700 rounded-2xl text-white placeholder-neutral-500 focus:ring-2 focus:ring-brand-orange outline-none transition-all shadow-sm" />
                </div>
                <button onClick={handleSelectAll} className="px-6 py-4 bg-neutral-800 border border-neutral-700 text-brand-grey hover:text-white hover:border-neutral-500 rounded-2xl font-bold transition-colors whitespace-nowrap">
                    {filteredCompanies.length > 0 && filteredCompanies.every(c => selectedIds.has(c.id)) ? 'Unselect All' : 'Select All'}
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 p-4 bg-neutral-800/50 border border-neutral-700/50 rounded-2xl">
                <div className="flex items-center gap-2 text-sm text-brand-grey mr-2"><Filter className="w-4 h-4" /> Filters:</div>
                
                <div className="relative" ref={templateFilterRef}>
                    <button 
                        onClick={() => setIsTemplateFilterOpen(!isTemplateFilterOpen)} 
                        className={`flex items-center gap-2 pl-3 pr-3 py-2 border rounded-lg text-sm outline-none transition-colors ${filterTemplateIds.size > 0 ? 'bg-neutral-700 border-neutral-500 text-white' : 'bg-neutral-800 border-neutral-600 text-brand-grey hover:border-neutral-500'}`}
                    >
                        <FileText className="w-3.5 h-3.5" />
                        {filterTemplateIds.size === 0 ? "All Types" : `${filterTemplateIds.size} Types`}
                        <ChevronDown className="w-3 h-3 ml-1" />
                    </button>
                    
                    {isTemplateFilterOpen && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-50 p-2 max-h-64 overflow-y-auto">
                            {templates.map(t => (
                                <div key={t.id} onClick={() => toggleTemplateFilter(t.id)} className="flex items-center gap-3 p-2 hover:bg-neutral-800 rounded-lg cursor-pointer">
                                    {filterTemplateIds.has(t.id) ? 
                                        <CheckSquare className="w-4 h-4 text-brand-orange shrink-0" /> : 
                                        <Square className="w-4 h-4 text-neutral-600 shrink-0" />
                                    }
                                    <span className={`text-sm ${filterTemplateIds.has(t.id) ? 'text-white font-medium' : 'text-neutral-400'}`}>{t.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="relative group">
                    <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="appearance-none pl-9 pr-8 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-sm text-white focus:ring-1 focus:ring-brand-orange outline-none cursor-pointer hover:border-neutral-500">
                        <option value="">All Tags</option>
                        {allUniqueTags.map(tag => (<option key={tag} value={tag}>{tag}</option>))}
                    </select>
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-grey" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-sm text-white focus:ring-1 focus:ring-brand-orange outline-none hover:border-neutral-500" placeholder="Start" />
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-grey" />
                    </div>
                    <span className="text-brand-grey">-</span>
                    <div className="relative">
                         <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-sm text-white focus:ring-1 focus:ring-brand-orange outline-none hover:border-neutral-500" />
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-grey" />
                    </div>
                </div>
                <div className="flex-1"></div>
                <div className="flex items-center gap-2 text-sm text-brand-grey border-l border-neutral-700 pl-4">
                    <ArrowUpDown className="w-4 h-4" /> Sort:
                    <select value={sortOption} onChange={(e) => setSortOption(e.target.value as any)} className="appearance-none pl-3 pr-8 py-2 bg-neutral-800 border border-neutral-600 rounded-lg text-sm text-white focus:ring-1 focus:ring-brand-orange outline-none cursor-pointer hover:border-neutral-500">
                        <option value="activity">Last Activity</option>
                        <option value="date-desc">Newest First</option>
                        <option value="date-asc">Oldest First</option>
                        <option value="name-asc">Name (A-Z)</option>
                        <option value="name-desc">Name (Z-A)</option>
                        <option value="resp-desc">Most Responses</option>
                        <option value="resp-asc">Fewest Responses</option>
                    </select>
                </div>
                {(filterTag || filterStartDate || filterEndDate || searchTerm || sortOption !== 'date-desc' || filterTemplateIds.size > 0) && (
                    <button onClick={resetFilters} className="p-2 text-brand-grey hover:text-white hover:bg-neutral-700 rounded-lg transition-colors" title="Reset Filters"><RotateCcw className="w-4 h-4" /></button>
                )}
            </div>
          </div>

          {filteredCompanies.length === 0 ? (
            <div className="text-center py-12 text-brand-grey bg-neutral-800/30 rounded-2xl border border-neutral-800 border-dashed">
                {isLoading ? 'Loading...' : 'No assessments found.'}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredCompanies.map(company => {
                const template = templates.find(t => t.id === company.templateId);
                // Determine if unread: Last Activity is NEWER than Last Viewed
                const isUnread = company.lastActivity && (!company.viewedAt || company.lastActivity > company.viewedAt);

                return (
                <div key={company.id} className={`bg-neutral-800 p-6 rounded-2xl border flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center transition-all shadow-sm ${selectedIds.has(company.id) ? 'border-brand-orange ring-1 ring-brand-orange/50 bg-orange-900/10' : 'border-neutral-700 hover:border-neutral-500'}`}>
                  <div className="flex items-start gap-4 flex-1 w-full">
                    <div className="flex flex-col items-center gap-2">
                       <input type="checkbox" checked={selectedIds.has(company.id)} onChange={() => toggleSelection(company.id)} className="w-4 h-4 rounded border-neutral-600 text-brand-orange bg-brand-black flex-shrink-0 focus:ring-brand-orange" />
                       {isUnread && <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" title="New Activity"></div>}
                    </div>
                    <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                          <h3 className="text-2xl font-bold text-white break-words">{company.name}</h3>
                          <div className="flex items-center gap-2 px-3 py-1 bg-neutral-700/50 rounded-full border border-neutral-600 text-xs font-medium text-brand-grey w-fit">
                              <Calendar className="w-3 h-3" /> {new Date(company.createdAt).toLocaleDateString()}
                          </div>
                          {template && (
                            <span className="px-2 py-1 rounded text-[10px] uppercase font-bold bg-brand-black text-brand-grey border border-neutral-700">{template.name}</span>
                          )}
                          {company.lastActivity && (
                             <span className="px-2 py-1 rounded text-[10px] uppercase font-bold bg-neutral-800 text-neutral-400 border border-neutral-700 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Active: {new Date(company.lastActivity).toLocaleDateString()}
                             </span>
                          )}
                        </div>
                        
                        {company.tags && company.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {company.tags.map((tag, idx) => (
                                    <span key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-neutral-700 text-brand-grey border border-neutral-600 rounded text-xs font-medium"><Tag className="w-3 h-3" /> {tag}</span>
                                ))}
                            </div>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-brand-grey">
                            <button onClick={() => { setManagingCompany(company); setShowManageModal(true); }} className={`flex items-center gap-2 hover:text-white transition-colors ${company.responses.length > 0 ? "text-brand-orange font-bold" : ""}`}>
                                <Users className="w-4 h-4" />
                                <span className="underline decoration-dotted">{company.responses.length} Response{company.responses.length !== 1 ? 's' : ''}</span>
                            </button>
                            <div className="w-1 h-1 bg-neutral-600 rounded-full"></div>
                            <button onClick={() => { setShareLink(getShareLink(company)); setShowShareModal(true); }} className="flex items-center gap-2 text-brand-grey hover:text-white transition-colors"><Share2 className="w-4 h-4" /> Get Link 🔗</button>
                        </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 w-full lg:w-auto pl-8 lg:pl-0">
                    <button onClick={() => handleSimulateData(company)} className="px-4 py-2 bg-neutral-900 hover:bg-neutral-950 text-brand-grey border border-neutral-700 rounded-lg text-sm font-medium transition-colors"><Terminal className="w-4 h-4 inline mr-2" /> Sim</button>
                    <button onClick={() => { setActiveCompanyId(company.id); setShowImportModal(true); }} className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg text-sm font-medium transition-colors"><UserPlus className="w-4 h-4 inline mr-2" /> Input</button>
                    <button onClick={() => onViewReport(company)} disabled={company.responses.length === 0} className="px-4 py-2 bg-brand-orange hover:bg-orange-600 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg text-sm font-bold transition-colors relative">
                        <BarChart2 className="w-4 h-4 inline mr-2" /> Report
                        {isUnread && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-neutral-800"></span>}
                    </button>
                    <button onClick={() => startRenamingCompany(company)} className="px-3 py-2 text-brand-grey hover:text-brand-orange transition-colors border border-transparent hover:border-orange-900/30 rounded-lg" title="Edit Name"><Edit3 className="w-5 h-5" /></button>
                    <button onClick={() => setCompanyToDelete(company)} className="px-3 py-2 text-brand-grey hover:text-red-400 transition-colors border border-transparent hover:border-red-900/30 rounded-lg" title="Delete"><Trash2 className="w-5 h-5" /></button>
                  </div>
                </div>
              )})}
            </div>
          )}

          <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-neutral-900 border border-neutral-700 shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 transition-all duration-300 z-40 ${selectedIds.size > 0 ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0'}`}>
              <div className="text-white font-bold text-sm border-r border-neutral-700 pr-4 mr-1">{selectedIds.size} Selected</div>
              <button onClick={() => {
                   const selected = companies.filter(c => selectedIds.has(c.id));
                   const text = selected.map(c => `${c.name}\n${getShareLink(c)}`).join('\n\n');
                   setBulkLinksText(text); setShowBulkLinksModal(true);
              }} className="flex items-center gap-2 text-brand-grey hover:text-white hover:bg-neutral-800 px-3 py-1.5 rounded-lg text-sm font-medium"><Copy className="w-4 h-4"/> Links</button>
              <button onClick={() => {
                   const selected = companies.filter(c => selectedIds.has(c.id));
                   if(selected.length) onBatchPrint(selected);
              }} className="flex items-center gap-2 text-brand-grey hover:text-white hover:bg-neutral-800 px-3 py-1.5 rounded-lg text-sm font-medium"><Printer className="w-4 h-4"/> Print</button>
              <button onClick={() => {
                   const selected = companies.filter(c => selectedIds.has(c.id));
                   if(selected.length) onMasterReport(selected);
              }} className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg"><Layers className="w-4 h-4"/> Master</button>
              <button onClick={() => setSelectedIds(new Set())} className="ml-2 p-1 hover:bg-neutral-800 rounded-full text-brand-grey hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        </>
      )}

      {/* ... (Templates Tab - identical to previous) ... */}
      {activeTab === 'templates' && isSuperAdmin && (
        <div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             <button onClick={() => setShowAIModal(true)} className="h-full min-h-[200px] border-2 border-dashed border-brand-orange/40 bg-brand-orange/5 hover:bg-brand-orange/10 rounded-2xl flex flex-col items-center justify-center text-brand-orange transition-all group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Sparkles className="w-12 h-12 mb-4 group-hover:scale-110 group-hover:rotate-12 transition-transform" />
                <span className="font-bold text-lg">Generate with AI</span>
                <span className="text-xs text-brand-orange/70 mt-2">Create new assessment topic</span>
             </button>

             <button onClick={handleCreateTemplate} className="h-full min-h-[200px] border-2 border-dashed border-neutral-700 rounded-2xl flex flex-col items-center justify-center text-neutral-500 hover:text-white hover:border-neutral-500 hover:bg-neutral-800/30 transition-all group">
                <Plus className="w-12 h-12 mb-4 group-hover:scale-110 transition-transform" />
                <span className="font-bold">Create Manually</span>
             </button>

             {templates.map(t => (
               <div key={t.id} className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700 flex flex-col justify-between hover:border-neutral-500 transition-colors shadow-lg">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">{t.name}</h3>
                    <div className="text-sm text-brand-grey mb-4">{t.categories.length} Categories • {t.categories.reduce((acc, cat) => acc + cat.questions.length, 0)} Questions</div>
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-neutral-700">
                     <button onClick={() => setEditingTemplate(t)} className="flex-1 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"><Edit3 className="w-4 h-4" /> Edit</button>
                     <button onClick={() => setTemplateToDelete(t)} className="px-3 py-2 bg-neutral-700 hover:bg-red-900/50 text-brand-grey hover:text-red-400 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* ... (Users Tab - identical to previous) ... */}
      {activeTab === 'users' && isSuperAdmin && (
          <div>
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-white">System Users</h2>
                  <button onClick={() => {
                      setEditingUser(null);
                      setNewUserName(''); setNewUserEmail(''); setNewUserPassword(''); setNewUserRole('ADMIN');
                      setShowUserModal(true);
                  }} className="px-4 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg">
                      <UserPlus className="w-4 h-4" /> Add User
                  </button>
              </div>
              <div className="bg-neutral-800 border border-neutral-700 rounded-2xl overflow-hidden shadow-lg">
                  <table className="w-full text-left">
                      <thead className="bg-neutral-900 text-xs uppercase text-brand-grey">
                          <tr>
                              <th className="p-4">Name</th>
                              <th className="p-4">Email</th>
                              <th className="p-4">Role</th>
                              <th className="p-4 text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-700">
                          {users.map(u => (
                              <tr key={u.id} className="hover:bg-neutral-700/50 transition-colors">
                                  <td className="p-4 font-medium text-white">{u.name}</td>
                                  <td className="p-4 text-brand-grey">{u.email}</td>
                                  <td className="p-4">
                                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${u.role === 'SUPER_ADMIN' ? 'bg-purple-900/30 text-purple-400 border-purple-800' : 'bg-blue-900/30 text-blue-400 border-blue-800'}`}>
                                          {u.role.replace('_', ' ')}
                                      </span>
                                  </td>
                                  <td className="p-4 text-right flex justify-end gap-2">
                                      <button onClick={() => {
                                          setEditingUser(u);
                                          setNewUserName(u.name); setNewUserEmail(u.email); setNewUserRole(u.role); setNewUserPassword(u.password || '');
                                          setShowUserModal(true);
                                      }} className="p-2 text-brand-grey hover:text-white bg-neutral-900 rounded-lg border border-neutral-700 hover:border-neutral-500"><Edit3 className="w-4 h-4" /></button>
                                      {u.role !== 'SUPER_ADMIN' && (
                                          <button onClick={() => setUserToDelete(u)} className="p-2 text-brand-grey hover:text-red-400 bg-neutral-900 rounded-lg border border-neutral-700 hover:border-red-900/50"><Trash2 className="w-4 h-4" /></button>
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* ... (Modals) ... */}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/90 backdrop-blur-sm">
          <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-700 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6">Change Password</h3>
            <form onSubmit={handleChangePassword}>
              <div className="space-y-4 mb-6">
                <div><label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Current Password</label><input type="password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full px-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none" /></div>
                <div><label className="block text-xs font-bold text-neutral-500 uppercase mb-1">New Password</label><input type="password" required value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} className="w-full px-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none" /></div>
                <div><label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Confirm New Password</label><input type="password" required value={confirmPasswordInput} onChange={e => setConfirmPasswordInput(e.target.value)} className="w-full px-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none" /></div>
              </div>
              <div className="flex gap-3 justify-end"><button type="button" onClick={() => setShowChangePasswordModal(false)} className="px-4 py-2 bg-neutral-800 text-white rounded-lg font-bold">Cancel</button><button type="submit" className="px-6 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-lg font-bold shadow-lg">Update</button></div>
            </form>
          </div>
        </div>
      )}
      
      {/* AI Generation Modal */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/90 backdrop-blur-sm animate-in fade-in">
          <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-700 w-full max-w-lg shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-orange to-yellow-500"></div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-brand-orange" />Generate Assessment</h3>
                <button onClick={() => setShowAIModal(false)} className="text-neutral-500 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleGenerateAI}>
                <div className="mb-6">
                    <label className="block text-sm font-medium text-brand-grey mb-2">What is the topic of this assessment?</label>
                    <input type="text" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g. Sales Team Maturity..." className="w-full px-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none" autoFocus disabled={isGeneratingAI} />
                    <p className="text-xs text-neutral-500 mt-2">AI will generate 5-7 pillars with 5 questions each.</p>
                </div>
                <div className="flex gap-3 justify-end"><button type="button" onClick={() => setShowAIModal(false)} disabled={isGeneratingAI} className="px-6 py-3 bg-neutral-800 text-white rounded-xl font-bold hover:bg-neutral-700">Cancel</button><button type="submit" disabled={isGeneratingAI || !aiTopic.trim()} className="px-6 py-3 bg-brand-orange hover:bg-orange-600 text-white rounded-xl font-bold shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">{isGeneratingAI ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate</>}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/90 backdrop-blur-sm animate-in fade-in">
              <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-700 w-full max-w-md shadow-2xl">
                  <h3 className="text-xl font-bold text-white mb-6">{editingUser ? 'Edit User' : 'Add New User'}</h3>
                  <form onSubmit={handleSaveUser}>
                      <div className="space-y-4 mb-6">
                          <div><label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Full Name</label><input type="text" required value={newUserName} onChange={e => setNewUserName(e.target.value)} className="w-full px-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none" /></div>
                          <div><label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Email</label><input type="email" required value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="w-full px-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none" /></div>
                          <div><label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Password</label><div className="relative"><input type="text" required value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} className="w-full px-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none font-mono" /><Lock className="absolute right-3 top-3 w-5 h-5 text-neutral-500" /></div></div>
                          <div><label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Role</label><select value={newUserRole} onChange={e => setNewUserRole(e.target.value as UserRole)} className="w-full px-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none"><option value="ADMIN">Admin (Standard)</option><option value="SUPER_ADMIN">Super Admin (Full Access)</option></select></div>
                          {!editingUser && (<label className="flex items-center gap-3 p-3 bg-neutral-800 rounded-lg cursor-pointer border border-neutral-700"><input type="checkbox" checked={sendInvite} onChange={e => setSendInvite(e.target.checked)} className="w-4 h-4 rounded text-brand-orange bg-brand-black border-neutral-600 focus:ring-brand-orange" /><span className="text-sm text-brand-grey flex items-center gap-2"><Mail className="w-4 h-4" /> Send email invite with credentials</span></label>)}
                      </div>
                      <div className="flex gap-3 justify-end"><button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-2 bg-neutral-800 text-white rounded-lg font-bold">Cancel</button><button type="submit" className="px-6 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-lg font-bold shadow-lg">Save User</button></div>
                  </form>
              </div>
          </div>
      )}

      {editingTemplate && <TemplateEditor template={editingTemplate} onSave={handleSaveTemplate} onCancel={() => setEditingTemplate(null)} />}

      {renamingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/90 backdrop-blur-sm animate-in fade-in">
          <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-700 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Rename Assessment</h3>
            <form onSubmit={handleRenameSave}>
              <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="w-full px-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none mb-6" autoFocus />
              <div className="flex gap-3 justify-end"><button type="button" onClick={() => setRenamingCompany(null)} className="px-6 py-3 bg-neutral-800 text-white rounded-xl font-bold hover:bg-neutral-700">Cancel</button><button type="submit" className="px-6 py-3 bg-brand-orange hover:bg-orange-600 text-white rounded-xl font-bold shadow-lg">Save</button></div>
            </form>
          </div>
        </div>
      )}

      {templateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/90 backdrop-blur-sm">
           <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-700 w-full max-w-md shadow-2xl">
             <div className="flex items-center gap-4 mb-4 text-red-500"><AlertTriangle className="w-8 h-8" /><h3 className="text-xl font-bold text-white">Delete Template?</h3></div>
             <p className="text-brand-grey mb-6">Are you sure you want to delete <span className="font-bold text-white">{templateToDelete.name}</span>?</p>
             <div className="flex gap-3 justify-end"><button onClick={() => setTemplateToDelete(null)} className="px-6 py-3 bg-neutral-800 text-white rounded-xl font-bold">Cancel</button><button onClick={confirmDeleteTemplate} className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold">Delete</button></div>
           </div>
        </div>
      )}

      {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/90 backdrop-blur-sm">
              <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-700 w-full max-w-md shadow-2xl border-l-4 border-l-red-600">
                  <div className="flex items-center gap-4 mb-4 text-red-500"><Shield className="w-8 h-8" /><h3 className="text-xl font-bold text-white">Delete User?</h3></div>
                  <p className="text-brand-grey mb-6">Are you sure you want to delete access for <span className="font-bold text-white">{userToDelete.name}</span>?</p>
                  <div className="flex gap-3 justify-end"><button onClick={() => setUserToDelete(null)} className="px-6 py-3 bg-neutral-800 text-white rounded-xl font-bold">Cancel</button><button onClick={confirmDeleteUser} className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold">Delete User</button></div>
              </div>
          </div>
      )}

      {companyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/90 backdrop-blur-sm">
           <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-700 w-full max-w-md shadow-2xl">
             <div className="flex items-center gap-4 mb-4 text-red-500"><AlertTriangle className="w-8 h-8" /><h3 className="text-xl font-bold text-white">Delete Assessment?</h3></div>
             <p className="text-brand-grey mb-6">Are you sure you want to delete <span className="font-bold text-white">{companyToDelete.name}</span>?</p>
             <div className="flex gap-3 justify-end"><button onClick={() => setCompanyToDelete(null)} className="px-6 py-3 bg-neutral-800 text-white rounded-xl font-bold">Cancel</button><button onClick={confirmDeleteCompany} className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold">Delete</button></div>
           </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/90 backdrop-blur-sm">
           <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-700 w-full max-w-lg shadow-2xl">
              <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-white">Settings</h3><button onClick={() => setShowSettingsModal(false)}><X className="w-5 h-5 text-neutral-400"/></button></div>
              <div className="mb-4">
                 <h4 className="text-white font-bold mb-2">Report Logo</h4>
                 <div className="bg-brand-black border border-neutral-700 border-dashed rounded-xl p-8 text-center mb-4 relative">
                    {customLogo ? (
                       <div className="relative inline-block"><img src={customLogo} alt="Preview" className="max-h-32 object-contain" /><button onClick={() => { removeLogo(); setCustomLogo(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full"><X className="w-4 h-4"/></button></div>
                    ) : <div className="text-neutral-500"><ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50"/>No logo set</div>}
                 </div>
                 <label className="cursor-pointer w-full py-3 bg-brand-orange hover:bg-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"><Upload className="w-4 h-4"/> Upload<input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { saveLogo(reader.result as string); setCustomLogo(reader.result as string); }; reader.readAsDataURL(file); } }}/></label>
              </div>
              <div className="mb-6 pt-4 border-t border-neutral-800">
                <h4 className="text-white font-bold mb-2">Automation Webhook</h4>
                <p className="text-brand-grey text-xs mb-2">Enter a Zapier or Make.com Webhook URL to trigger emails and Mailchimp updates automatically.</p>
                <div className="flex gap-2"><input type="text" value={settings.webhookUrl || ''} onChange={e => setSettings({...settings, webhookUrl: e.target.value})} placeholder="https://hooks.zapier.com/..." className="flex-1 px-3 py-2 bg-brand-black border border-neutral-600 rounded-lg text-white text-sm focus:ring-1 focus:ring-brand-orange outline-none" /><button onClick={handleSaveWebhook} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-bold text-sm">Save</button></div>
              </div>
              <div className="mb-4 pt-4 border-t border-neutral-800">
                  <h4 className="text-white font-bold mb-2">Database Maintenance</h4>
                  <p className="text-brand-grey text-sm mb-3">If standard templates are missing, click here to restore them.</p>
                  <button onClick={handleReseed} className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 border border-neutral-600"><RefreshCw className="w-4 h-4" /> Re-seed Default Templates</button>
              </div>
              <div className="flex justify-end pt-4 border-t border-neutral-800"><button onClick={() => setShowSettingsModal(false)} className="px-6 py-3 bg-neutral-800 text-white rounded-xl font-bold">Close</button></div>
           </div>
        </div>
      )}

      {showBulkLinksModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/90 backdrop-blur-sm">
            <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-700 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <h3 className="text-xl font-bold text-white mb-4">Assessment Links</h3>
                <textarea readOnly value={bulkLinksText} className="w-full flex-1 px-4 py-3 bg-brand-black border border-neutral-700 rounded-xl text-brand-grey font-mono text-sm mb-4 resize-none" onClick={e=>e.currentTarget.select()} />
                <div className="flex justify-end gap-2"><button onClick={()=>setShowBulkLinksModal(false)} className="px-4 py-2 bg-neutral-800 rounded-lg font-bold">Close</button><button onClick={()=>{navigator.clipboard.writeText(bulkLinksText); alert('Copied!');}} className="px-4 py-2 bg-brand-orange rounded-lg text-white font-bold">Copy to Clipboard</button></div>
            </div>
         </div>
      )}

      {showManageModal && managingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/90 backdrop-blur-sm">
           <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-700 w-full max-w-3xl shadow-2xl h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-6 border-b border-neutral-800 pb-4"><h3 className="text-xl font-bold text-white">Manage Responses: {managingCompany.name}</h3><button onClick={() => setShowManageModal(false)}><X className="w-5 h-5 text-neutral-400"/></button></div>
              <div className="flex-1 overflow-y-auto">
                 {managingCompany.responses.length === 0 ? (<div className="text-center text-neutral-500 py-8">No responses yet.</div>) : (
                    <table className="w-full text-left">
                       <thead className="text-xs text-neutral-400 uppercase bg-neutral-800 sticky top-0"><tr><th className="p-3 rounded-tl-lg">Name</th><th className="p-3">Email</th><th className="p-3">Date</th><th className="p-3 rounded-tr-lg text-right">Action</th></tr></thead>
                       <tbody className="divide-y divide-neutral-800">
                          {managingCompany.responses.map((r) => (
                             <tr key={r.id} className="hover:bg-neutral-800/50">
                                <td className="p-3 text-white font-medium">{r.firstName} {r.lastName}</td>
                                <td className="p-3 text-brand-grey text-sm">{r.email || '-'}</td>
                                <td className="p-3 text-neutral-400 text-sm">{new Date(r.timestamp).toLocaleDateString()} {new Date(r.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                <td className="p-3 text-right"><button onClick={() => setResponseToDelete({ companyId: managingCompany.id, responseId: r.id, name: `${r.firstName} ${r.lastName}` })} className="text-neutral-500 hover:text-red-400 p-1 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 )}
              </div>
           </div>
        </div>
      )}

      {responseToDelete && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-black/90 backdrop-blur-sm">
            <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-700 w-full max-w-md shadow-2xl border-l-4 border-l-red-600">
                <h3 className="text-xl font-bold text-white mb-2">Delete Response?</h3>
                <p className="text-brand-grey mb-6">Are you sure you want to delete the response from <span className="font-bold text-white">{responseToDelete.name}</span>?</p>
                <div className="flex justify-end gap-3">
                   <button onClick={() => setResponseToDelete(null)} className="px-4 py-2 bg-neutral-800 text-white rounded-lg">Cancel</button>
                   <button onClick={async () => {
                      const comp = companies.find(c => c.id === responseToDelete.companyId);
                      if (comp) {
                          const updated = { ...comp, responses: comp.responses.filter(r => r.id !== responseToDelete.responseId) };
                          await saveCompany(updated);
                          await refreshData();
                          setManagingCompany(updated);
                      }
                      setResponseToDelete(null);
                   }} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold">Delete Response</button>
                </div>
            </div>
         </div>
      )}

      {showShareModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/90 backdrop-blur-sm">
            <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-700 w-full max-w-lg shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-4">Share Link</h3>
                <input readOnly value={shareLink} className="w-full px-4 py-3 bg-brand-black border border-neutral-700 rounded-xl text-brand-grey mb-4" onClick={e=>e.currentTarget.select()}/>
                <div className="flex justify-end gap-2"><button onClick={()=>setShowShareModal(false)} className="px-4 py-2 bg-neutral-800 rounded-lg">Close</button></div>
            </div>
         </div>
      )}

      {showImportModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/90 backdrop-blur-sm">
             <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-700 w-full max-w-md shadow-2xl">
                 <h3 className="text-xl font-bold text-white mb-6">Input Data</h3>
                 <div className="space-y-4">
                     <button onClick={() => { 
                        const comp = companies.find(c => c.id === activeCompanyId);
                        if (comp) onManualEntry(comp);
                     }} className="w-full py-4 bg-brand-orange hover:bg-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"><UserPlus className="w-5 h-5" /> Take Assessment Now</button>
                     <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-neutral-700"></div><span className="flex-shrink-0 mx-4 text-neutral-500 text-xs uppercase">Or paste code</span><div className="flex-grow border-t border-neutral-700"></div>
                     </div>
                     <textarea placeholder="Paste result code here..." className="w-full p-3 bg-brand-black border border-neutral-700 rounded-xl text-sm text-white h-24" value={pasteToken} onChange={e => setPasteToken(e.target.value)} />
                     <div className="flex gap-2">
                        <button onClick={() => setShowImportModal(false)} className="flex-1 py-3 bg-neutral-800 text-white rounded-xl">Cancel</button>
                        <button onClick={async () => {
                            const resp = decodeResponse(pasteToken);
                            if (resp && activeCompanyId) {
                                await addResponseToCompany(activeCompanyId, resp);
                                await refreshData();
                                alert(`Imported ${resp.firstName} ${resp.lastName}`);
                                setPasteToken('');
                                setShowImportModal(false);
                            } else { alert("Invalid code"); }
                        }} className="flex-1 py-3 bg-brand-orange text-white rounded-xl font-bold">Import</button>
                     </div>
                 </div>
             </div>
         </div>
      )}
    </div>
  );
};

// Simple Template Editor wrapper remains largely the same but passed props
const TemplateEditor: React.FC<{ template: AssessmentTemplate, onSave: (t: AssessmentTemplate) => void, onCancel: () => void }> = ({ template, onSave, onCancel }) => {
  const [data, setData] = useState<AssessmentTemplate>(template);
  const handleCatNameChange = (catIdx: number, val: string) => { const newCats = [...data.categories]; newCats[catIdx].name = val; setData({ ...data, categories: newCats }); };
  const handleQChange = (catIdx: number, qIdx: number, val: string) => { const newCats = [...data.categories]; newCats[catIdx].questions[qIdx].text = val; setData({ ...data, categories: newCats }); };
  const addQuestion = (catIdx: number) => { const newCats = [...data.categories]; const newQId = `q-${catIdx}-${Date.now()}`; newCats[catIdx].questions.push({ id: newQId, text: "New Question" }); setData({ ...data, categories: newCats }); };
  const removeQuestion = (catIdx: number, qIdx: number) => { const newCats = [...data.categories]; newCats[catIdx].questions.splice(qIdx, 1); setData({ ...data, categories: newCats }); };
  const addCategory = () => { const newCatId = `cat-${Date.now()}`; setData({ ...data, categories: [...data.categories, { id: newCatId, name: "New Category", questions: [{ id: `q-${newCatId}-0`, text: "New Question" }] }] }); };
  const removeCategory = (catIdx: number) => { const newCats = [...data.categories]; newCats.splice(catIdx, 1); setData({...data, categories: newCats}); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/90 backdrop-blur-sm">
      <div className="bg-neutral-900 w-full max-w-4xl h-[90vh] rounded-2xl border border-neutral-700 flex flex-col shadow-2xl">
        <div className="p-6 border-b border-neutral-700 flex justify-between items-center">
          <input className="bg-transparent text-2xl font-bold text-white border-b border-transparent focus:border-brand-orange outline-none" value={data.name} onChange={e => setData({...data, name: e.target.value})} />
          <div className="flex gap-2"><button onClick={onCancel} className="px-4 py-2 text-neutral-400 hover:text-white">Cancel</button><button onClick={() => onSave(data)} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold">Save Template</button></div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
           {data.categories.map((cat, catIdx) => (
             <div key={cat.id} className="bg-neutral-800/50 p-6 rounded-xl border border-neutral-700">
               <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3 w-full"><span className="text-xs font-bold text-brand-orange uppercase tracking-wider whitespace-nowrap">Pillar {catIdx + 1}</span><input className="bg-transparent text-lg font-bold text-white w-full border-b border-neutral-700 focus:border-brand-orange outline-none pb-1" value={cat.name} onChange={e => handleCatNameChange(catIdx, e.target.value)} /></div>
                  <button onClick={() => removeCategory(catIdx)} className="text-neutral-600 hover:text-red-400 p-2"><Trash2 className="w-4 h-4"/></button>
               </div>
               <div className="space-y-3 pl-4 border-l-2 border-neutral-700">
                  {cat.questions.map((q, qIdx) => (
                    <div key={q.id} className="flex gap-2"><span className="text-neutral-500 pt-3 text-xs font-mono">{qIdx + 1}.</span><textarea className="w-full bg-brand-black border border-neutral-700 rounded-lg p-2 text-sm text-brand-grey focus:ring-1 focus:ring-brand-orange outline-none resize-none" rows={2} value={q.text} onChange={e => handleQChange(catIdx, qIdx, e.target.value)} /><button onClick={() => removeQuestion(catIdx, qIdx)} className="text-neutral-700 hover:text-red-400 self-center"><X className="w-4 h-4"/></button></div>
                  ))}
                  <button onClick={() => addQuestion(catIdx)} className="text-xs font-bold text-brand-orange hover:text-orange-400 flex items-center gap-1 mt-2"><Plus className="w-3 h-3" /> Add Question</button>
               </div>
             </div>
           ))}
           <button onClick={addCategory} className="w-full py-4 border-2 border-dashed border-neutral-700 rounded-xl text-neutral-500 hover:text-white hover:border-neutral-500 transition-colors font-bold flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> Add New Pillar</button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
