import { Company, ParticipantResponse, AssessmentTemplate, User, AppSettings } from '../types';
import { db, isConfigured } from './firebaseConfig';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  getDoc,
  updateDoc
} from "firebase/firestore/lite";

// --- Collections ---
const COMPANIES_COL = 'companies';
const TEMPLATES_COL = 'templates';
const USERS_COL = 'users';
const SETTINGS_COL = 'settings';
const SETTINGS_DOC_ID = 'global_settings';

// --- LocalStorage Keys (Fallback) ---
const LOCAL_COMPANIES_KEY = 'breakthrough_companies';
const LOCAL_TEMPLATES_KEY = 'breakthrough_templates';
const LOCAL_USERS_KEY = 'breakthrough_users';
const LOCAL_SETTINGS_KEY = 'breakthrough_settings';

// --- Default Users (Seeding) ---
const DEFAULT_ADMIN: User = {
    id: 'super-admin-01',
    name: 'Mike Goldman',
    email: 'mike@mike-goldman.com',
    role: 'SUPER_ADMIN',
    password: 'breakthrough'
};

// --- Default Templates ---
const SEED_TEMPLATES: AssessmentTemplate[] = [
  {
    id: 'default-standard',
    name: 'BLT Assessment (30 questions)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    categories: [
        { name: "Mastering Self-Leadership", questions: [{ id: "q-0-0", text: "I am continuously learning and improving" }, { id: "q-0-1", text: "I understand and leverage my strengths every day" }, { id: "q-0-2", text: "I am aware of my emotional state and have the ability to effectively manage it" }, { id: "q-0-3", text: "I focus on those things I control and accept the things I can't" }, { id: "q-0-4", text: "When I need help, I am comfortable asking for it" }] },
        { name: "Proactively Structuring the Team", questions: [{ id: "q-1-0", text: "Our leadership team is structured so that each major function has one person accountable and no member of the leadership team is stretched across too many core responsibilities" }, { id: "q-1-1", text: "We meet regularly with clear agendas that focus on strategic issues, not operational details" }, { id: "q-1-2", text: "Decisions are made quickly with clarity about who owns follow-up" }, { id: "q-1-3", text: "We have explicit role clarity and expectation alignment between members" }, { id: "q-1-4", text: "The team holds each other accountable to agreed standards of behavior and delivery" }] },
        { name: "Finding the Right People", questions: [{ id: "q-2-0", text: "We proactively build a virtual bench of potential A-players for the leadership team and the leadership team's direct reports" }, { id: "q-2-1", text: "Hiring decisions are driven by a consistent set of criteria and process" }, { id: "q-2-2", text: "We have a strong onboarding approach that accelerates new leadership contributors" }, { id: "q-2-3", text: "We regularly review key positions and succession plans" }, { id: "q-2-4", text: "The team invests time in recruiting and talent development" }] },
        { name: "Building a Resilient Culture", questions: [{ id: "q-3-0", text: "Our leadership team has developed, communicated, and lives by a set of core values that anchors our culture and is nonnegotiable" }, { id: "q-3-1", text: "There is psychological safety in the team; members speak up when something concerns them" }, { id: "q-3-2", text: "We celebrate progress and learn quickly from mistakes" }, { id: "q-3-3", text: "Cross-functional collaboration is encouraged and rewarded" }, { id: "q-3-4", text: "We pay attention to wellbeing and workload balance across the team" }] },
        { name: "Executing With Discipline", questions: [{ id: "q-4-0", text: "Our leadership team is aligned around no more than five priorities for the year and the quarter" }, { id: "q-4-1", text: "There is clear accountability (one 'owner') for each major deliverable" }, { id: "q-4-2", text: "We track progress to plan weekly and remove blockers quickly" }, { id: "q-4-3", text: "Resources are allocated to what matters most" }, { id: "q-4-4", text: "We use data to make decisions and adjust quickly" }] },
        { name: "Developing & Improving", questions: [{ id: "q-5-0", text: "As a leadership team, we spend time each quarter learning and growing together (books, conferences, new tools, techniques, etc.)" }, { id: "q-5-1", text: "We run feedback loops (360s, retrospectives) and act on them" }, { id: "q-5-2", text: "We regularly inspect and improve our ways of working" }, { id: "q-5-3", text: "Members are encouraged and supported to develop their leadership capability" }, { id: "q-5-4", text: "We learn from other industries and best practices and adapt them" }] },
    ].map((c, i) => ({
        id: `cat-${i}`,
        name: c.name,
        questions: c.questions.map((q, j) => ({ id: q.id || `q-${i}-${j}`, text: q.text, type: 'rating' }))
    }))
  },
  {
    id: 'default-strategy',
    name: 'BLT Assessment (35 questions)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    categories: [
        { name: "Mastering Self-Leadership", questions: ["I am continuously learning and improving", "I understand and leverage my strengths every day", "I am aware of my emotional state and have the ability to effectively manage it", "I focus on those things I control and accept the things I can't", "When I need help, I am comfortable asking for it"] },
        { name: "Proactively Structuring the Team", questions: ["Our leadership team is structured so that each major function has one person accountable and no member of the leadership team is stretched across too many core responsibilities", "We meet regularly with clear agendas that focus on strategic issues, not operational details", "Decisions are made quickly with clarity about who owns follow-up", "We have explicit role clarity and expectation alignment between members", "The team holds each other accountable to agreed standards of behavior and delivery"] },
        { name: "Finding the Right People", questions: ["We proactively build a virtual bench of potential A-players for the leadership team and the leadership team's direct reports", "Hiring decisions are driven by a consistent set of criteria and process", "We have a strong onboarding approach that accelerates new leadership contributors", "We regularly review key positions and succession plans", "The team invests time in recruiting and talent development"] },
        { name: "Building a Resilient Culture", questions: ["Our leadership team has developed, communicated, and lives by a set of core values that anchors our culture and is nonnegotiable", "There is psychological safety in the team; members speak up when something concerns them", "We celebrate progress and learn quickly from mistakes", "Cross-functional collaboration is encouraged and rewarded", "We pay attention to wellbeing and workload balance across the team"] },
        { name: "Create a Differentiated Strategy", questions: ["Our leadership team has developed a core customer avatar that includes who they are (specific person, demographics, industry, role)", "We clearly articulate our unique value proposition and why customers choose us", "We have an explicit go-to-market plan that is measurable", "We regularly validate our assumptions with customers", "We prioritize initiatives that move the strategy forward"] },
        { name: "Executing With Discipline", questions: ["Our leadership team is aligned around no more than five priorities for the year and the quarter", "There is clear accountability (one 'owner') for each major deliverable", "We track progress to plan weekly and remove blockers quickly", "Resources are allocated to what matters most", "We use data to make decisions and adjust quickly"] },
        { name: "Developing & Improving", questions: ["As a leadership team, we spend time each quarter learning and growing together (books, conferences, new tools, techniques, etc.)", "We run feedback loops (360s, retrospectives) and act on them", "We regularly inspect and improve our ways of working", "Members are encouraged and supported to develop their leadership capability", "We learn from other industries and best practices and adapt them"] },
    ].map((c, i) => ({
        id: `cat-${i}`,
        name: c.name,
        questions: c.questions.map((q, j) => ({ id: `q-${i}-${j}`, text: q, type: 'rating' as const }))
    }))
  },
  // NEW: Pre-Planning Survey
  {
    id: 'default-coaching',
    name: 'Pre-Planning Survey',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    categories: [
        { 
            id: 'cp-cat-1',
            name: "Vision & Ideal State", 
            questions: [
                { id: "cp-q-1", text: "LONG-TERM IDEAL(10+ Years): Succinctly describe in a statement what you would like to be true. Consider covering impact, reputation, and what the company looks like." },
                { id: "cp-q-3", text: "NEAR-TERM IDEAL (3 Years): Given the long-term ideal, what must be true in the near-term for us to be sure we are on the path?", type: 'text' }
            ] 
        },
        { 
            id: 'cp-cat-2',
            name: "Future Market Trends", 
            questions: [
                { id: "cp-q-2a", text: "Trend 1: List an important trend relevant to us over the next 1-3 years.", type: 'text' },
                { id: "cp-q-2b", text: "Trend 2: List a second important trend relevant to us over the next 1-3 years.", type: 'text' },
                { id: "cp-q-2c", text: "Trend 3: List a third important trend relevant to us over the next 1-3 years.", type: 'text' }
            ] 
        },
        { 
            id: 'cp-cat-3',
            name: "The 3-Year Picture", 
            questions: [
                { id: "cp-q-4", text: "In 3 years, what will we be selling?", type: 'text' },
                { id: "cp-q-5", text: "In 3 years, how will we sell it?", type: 'text' },
                { id: "cp-q-6", text: "In 3 years, where will we be selling it?", type: 'text' },
                { id: "cp-q-7", text: "In 3 years, how many will we sell?", type: 'text' }
            ] 
       },
        { 
            id: 'cp-cat-4',
            name: "SWOT Analysis", 
            questions: [
                { id: "cp-q-8", text: "What are the top 2 strengths of this organization that has been the source of success thus far?", type: 'text' },
                { id: "cp-q-9", text: "What are the top 2 internal weaknesses of the organization?", type: 'text' },
                { id: "cp-q-10", text: "What are the top 2 external opportunities we should be taking action on?", type: 'text' },
                { id: "cp-q-11", text: "What are the top 2 external threats we should be taking action on?", type: 'text' }
            ] 
        },
        { 
            id: 'cp-cat-5',
            name: "Current Strategy", 
            questions: [
                { id: "cp-q-12", text: "Describe the positive thing about the current strategy?", type: 'text' },
                { id: "cp-q-13", text: "What frustration do you have regarding the current strategy?", type: 'text' },
                { id: "cp-q-14", text: "If you could change one thing with our current strategy – what would it be?", type: 'text' },
                { id: "cp-q-15", text: "If you could change one thing operationally - what would it be?", type: 'text' }
            ] 
        },
        { 
            id: 'cp-cat-6',
            name: "Priorities", 
            questions: [
                { id: "cp-q-16", text: "What do you believe the #1 priority for the company should be for the next 12 months (be specific)?", type: 'text' },
                { id: "cp-q-17", text: "What do you believe the #1 priority for the company should be over the next 90 days (be specific)?", type: 'text' },
                { id: "cp-q-18", text: "What do you believe YOUR #1 priority should be for the next 90 days (be specific)?", type: 'text' }
            ] 
        }
    ]
  }
];

// --- Settings Management ---
export const getSettings = async (): Promise<AppSettings> => {
    if (isConfigured() && db) {
        try {
            const ref = doc(db, SETTINGS_COL, SETTINGS_DOC_ID);
            const snap = await getDoc(ref);
            if (snap.exists()) return snap.data() as AppSettings;
        } catch (e) {}
    }
    const local = localStorage.getItem(LOCAL_SETTINGS_KEY);
    return local ? JSON.parse(local) : {};
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
    if (isConfigured() && db) {
        await setDoc(doc(db, SETTINGS_COL, SETTINGS_DOC_ID), settings, { merge: true });
    }
    const current = await getSettings(); 
    const newSettings = { ...current, ...settings };
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(newSettings));
};

// Re-export logo functions to use Settings
export const saveLogo = async (base64: string): Promise<void> => {
    await saveSettings({ logoUrl: base64 });
};

export const getLogo = async (): Promise<string | null> => {
    const s = await getSettings();
    return s.logoUrl || null;
};

export const removeLogo = async (): Promise<void> => {
    await saveSettings({ logoUrl: '' });
};

// --- Helper for LocalStorage ---
const getLocalData = <T,>(key: string): T[] => {
    try {
        const json = localStorage.getItem(key);
        return json ? JSON.parse(json) : [];
    } catch { return []; }
};

const setLocalData = <T,>(key: string, data: T[]) => {
    localStorage.setItem(key, JSON.stringify(data));
};

// --- Utilities for publicId/slugs ---

function slugify(name: string) {
  return name
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanum with hyphen
    .replace(/^-+|-+$/g, '');    // trim leading/trailing hyphens
}

function generatePublicId(name: string) {
  // Prefer crypto.randomUUID if available
  try {
    const globalCrypto: any = (globalThis as any)?.crypto;
    if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
      return `${slugify(name)}-${globalCrypto.randomUUID()}`;
    }
  } catch (e) {
    // ignore and fallback
  }
  // Fallback: slug + timestamp + short random
  return `${slugify(name)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}

// --- Template Management ---
export const seedTemplates = async (): Promise<void> => {
    if (isConfigured() && db) {
        try {
            for (const seed of SEED_TEMPLATES) {
                const ref = doc(db, TEMPLATES_COL, seed.id);
                await setDoc(ref, seed, { merge: true });
            }
        } catch (e) {
            console.error("Firebase seeding failed", e);
        }
    } else {
        const current = getLocalData<AssessmentTemplate>(LOCAL_TEMPLATES_KEY);
        let changed = false;
        SEED_TEMPLATES.forEach(seed => {
            const idx = current.findIndex(c => c.id === seed.id);
            if (idx === -1) {
                current.push(seed);
                changed = true;
            } else if (current[idx].name !== seed.name) {
                current[idx] = seed;
                changed = true;
            }
        });
        if (changed) setLocalData(LOCAL_TEMPLATES_KEY, current);
    }
};

export const getTemplates = async (): Promise<AssessmentTemplate[]> => {
    await seedTemplates();
    if (isConfigured() && db) {
        try {
            const querySnapshot = await getDocs(collection(db, TEMPLATES_COL));
            const templates = querySnapshot.docs.map(doc => doc.data() as AssessmentTemplate);
            return templates.length > 0 ? templates : SEED_TEMPLATES;
        } catch (e) {
            console.warn("DB error, falling back to local templates");
            return SEED_TEMPLATES;
        }
    }
    const local = getLocalData<AssessmentTemplate>(LOCAL_TEMPLATES_KEY);
    return local.length > 0 ? local : SEED_TEMPLATES;
};

export const getTemplate = async (id: string): Promise<AssessmentTemplate | undefined> => {
    if (isConfigured() && db) {
        try {
            const ref = doc(db, TEMPLATES_COL, id);
            const snap = await getDoc(ref);
            if (snap.exists()) return snap.data() as AssessmentTemplate;
        } catch (e) {}
    }
    const local = getLocalData<AssessmentTemplate>(LOCAL_TEMPLATES_KEY);
    const found = local.find(t => t.id === id);
    if (found) return found;
    return SEED_TEMPLATES.find(t => t.id === id);
};

export const saveTemplate = async (template: AssessmentTemplate): Promise<void> => {
    const updated = { ...template, updatedAt: Date.now() };
    if (isConfigured() && db) {
        await setDoc(doc(db, TEMPLATES_COL, template.id), updated);
        return;
    }
    const local = getLocalData<AssessmentTemplate>(LOCAL_TEMPLATES_KEY);
    const idx = local.findIndex(t => t.id === template.id);
    if (idx >= 0) local[idx] = updated;
    else local.push(updated);
    setLocalData(LOCAL_TEMPLATES_KEY, local);
};

export const deleteTemplate = async (id: string): Promise<void> => {
    if (isConfigured() && db) {
        await deleteDoc(doc(db, TEMPLATES_COL, id));
        return;
    }
    const local = getLocalData<AssessmentTemplate>(LOCAL_TEMPLATES_KEY);
    setLocalData(LOCAL_TEMPLATES_KEY, local.filter(t => t.id !== id));
};

// --- User Management ---
export const seedUsers = async (): Promise<void> => {
    if (isConfigured() && db) {
        try {
            const ref = doc(db, USERS_COL, DEFAULT_ADMIN.id);
            const snap = await getDoc(ref);
            if (!snap.exists()) {
                await setDoc(ref, DEFAULT_ADMIN);
            }
        } catch (e) {
            console.error("Firebase user seeding failed", e);
        }
    } else {
        const users = getLocalData<User>(LOCAL_USERS_KEY);
        if (users.length === 0) {
            setLocalData(LOCAL_USERS_KEY, [DEFAULT_ADMIN]);
        }
    }
}

export const getUsers = async (): Promise<User[]> => {
    await seedUsers();
    if (isConfigured() && db) {
        try {
            const snap = await getDocs(collection(db, USERS_COL));
            const users = snap.docs.map(d => d.data() as User);
            return users.length > 0 ? users : [DEFAULT_ADMIN];
        } catch (e) {
            console.warn("DB error users");
            return [DEFAULT_ADMIN];
        }
    }
    const local = getLocalData<User>(LOCAL_USERS_KEY);
    return local.length > 0 ? local : [DEFAULT_ADMIN];
};

export const saveUser = async (user: User): Promise<void> => {
    if (isConfigured() && db) {
        await setDoc(doc(db, USERS_COL, user.id), user);
        return;
    }
    const local = getLocalData<User>(LOCAL_USERS_KEY);
    const idx = local.findIndex(u => u.id === user.id);
    if (idx >= 0) local[idx] = user;
    else local.push(user);
    setLocalData(LOCAL_USERS_KEY, local);
};

export const updateUserPassword = async (userId: string, newPassword: string): Promise<void> => {
    if (isConfigured() && db) {
        const ref = doc(db, USERS_COL, userId);
        await updateDoc(ref, { password: newPassword });
        return;
    }
    const local = getLocalData<User>(LOCAL_USERS_KEY);
    const idx = local.findIndex(u => u.id === userId);
    if (idx >= 0) {
        local[idx].password = newPassword;
        setLocalData(LOCAL_USERS_KEY, local);
    }
};

export const deleteUser = async (id: string): Promise<void> => {
    if (isConfigured() && db) {
        await deleteDoc(doc(db, USERS_COL, id));
        return;
    }
    const local = getLocalData<User>(LOCAL_USERS_KEY);
    setLocalData(LOCAL_USERS_KEY, local.filter(u => u.id !== id));
};

// --- Company Management ---

// Ensure/migrate existing companies to have publicId where missing
export const ensurePublicIdsForAllCompanies = async (): Promise<void> => {
    if (isConfigured() && db) {
        try {
            const snap = await getDocs(collection(db, COMPANIES_COL));
            for (const d of snap.docs) {
                const c = d.data() as Company;
                if (!c.publicId) {
                    const publicId = generatePublicId(c.name || c.id);
                    // setDoc with merge to avoid overwriting other fields
                    await setDoc(doc(db, COMPANIES_COL, c.id), { publicId }, { merge: true } as any);
                }
            }
        } catch (e) {
            console.warn("ensurePublicIdsForAllCompanies (db) failed", e);
        }
        return;
    }

    // local fallback
    const local = getLocalData<Company>(LOCAL_COMPANIES_KEY);
    let changed = false;
    local.forEach(c => {
        if (!c.publicId) {
            c.publicId = generatePublicId(c.name || c.id);
            changed = true;
        }
    });
    if (changed) setLocalData(LOCAL_COMPANIES_KEY, local);
};

export const getCompanies = async (): Promise<Company[]> => {
    // Backfill local or db companies with a publicId if missing (non-destructive)
    await ensurePublicIdsForAllCompanies();

    if (isConfigured() && db) {
        try {
            const snap = await getDocs(collection(db, COMPANIES_COL));
            return snap.docs.map(d => d.data() as Company);
        } catch (e) {
            return [];
        }
    }
    return getLocalData<Company>(LOCAL_COMPANIES_KEY);
};

export const getCompanyById = async (companyId: string): Promise<Company | undefined> => {
    if (isConfigured() && db) {
        try {
            const ref = doc(db, COMPANIES_COL, companyId);
            const snap = await getDoc(ref);
            if (snap.exists()) return snap.data() as Company;
            return undefined;
        } catch (e) {
            return undefined;
        }
    }
    const local = getLocalData<Company>(LOCAL_COMPANIES_KEY);
    return local.find(c => c.id === companyId);
};

export const getCompanyByPublicId = async (publicId: string): Promise<Company | undefined> => {
    if (isConfigured() && db) {
        try {
            // Firestore-lite doesn't provide a simple query helper in this import; fall back to scanning
            const snap = await getDocs(collection(db, COMPANIES_COL));
            for (const d of snap.docs) {
                const c = d.data() as Company;
                if (c.publicId === publicId) return c;
            }
            return undefined;
        } catch (e) {
            return undefined;
        }
    }
    const local = getLocalData<Company>(LOCAL_COMPANIES_KEY);
    return local.find(c => c.publicId === publicId);
};

export const saveCompany = async (company: Company): Promise<void> => {
    if (isConfigured() && db) {
        await setDoc(doc(db, COMPANIES_COL, company.id), company);
        return;
    }
    const local = getLocalData<Company>(LOCAL_COMPANIES_KEY);
    const idx = local.findIndex(c => c.id === company.id);
    if (idx >= 0) local[idx] = company;
    else local.push(company);
    setLocalData(LOCAL_COMPANIES_KEY, local);
};

export const createCompany = async (name: string, templateId: string, tags: string[] = []): Promise<Company> => {
    const newCompany: Company = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        name,
        templateId,
        tags,
        createdAt: Date.now(),
        responses: [],
        publicId: generatePublicId(name)
    };
    await saveCompany(newCompany);
    return newCompany;
};

export const deleteCompany = async (id: string): Promise<void> => {
    if (isConfigured() && db) {
        await deleteDoc(doc(db, COMPANIES_COL, id));
        return;
    }
    const local = getLocalData<Company>(LOCAL_COMPANIES_KEY);
    setLocalData(LOCAL_COMPANIES_KEY, local.filter(c => c.id !== id));
};

// Updated: Track lastActivity on response
export const addResponseToCompany = async (companyId: string, response: ParticipantResponse): Promise<void> => {
    if (isConfigured() && db) {
        const ref = doc(db, COMPANIES_COL, companyId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const comp = snap.data() as Company;
            comp.responses.push(response);
            comp.lastActivity = Date.now(); // Update activity timestamp
            await setDoc(ref, comp);
        }
        return;
    }
    const local = getLocalData<Company>(LOCAL_COMPANIES_KEY);
    const company = local.find(c => c.id === companyId);
    if (company) {
        company.responses.push(response);
        company.lastActivity = Date.now(); // Update activity timestamp
        setLocalData(LOCAL_COMPANIES_KEY, local);
    }
};

// New: Mark company as viewed by admin
export const markCompanyViewed = async (companyId: string): Promise<void> => {
    if (isConfigured() && db) {
        const ref = doc(db, COMPANIES_COL, companyId);
        // We merge to avoid overwriting responses if they came in concurrently
        await setDoc(ref, { viewedAt: Date.now() }, { merge: true } as any);
        return;
    }
    const local = getLocalData<Company>(LOCAL_COMPANIES_KEY);
    const company = local.find(c => c.id === companyId);
    if (company) {
        company.viewedAt = Date.now();
        setLocalData(LOCAL_COMPANIES_KEY, local);
    }
};

// --- Utils ---
export const encodeResponse = (response: ParticipantResponse): string => {
  try {
    return btoa(JSON.stringify(response));
  } catch (e) {
    return "";
  }
};

export const decodeResponse = (token: string): ParticipantResponse | null => {
  try {
    const json = atob(token);
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
};
