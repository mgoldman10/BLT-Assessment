import { Company, ParticipantResponse, AssessmentTemplate, User, AppSettings } from '../types';
import { db, isConfigured, auth, getSecondaryAuth } from './firebaseConfig';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  getDoc,
  updateDoc,
  deleteField
} from "firebase/firestore/lite";
import {
  createUserWithEmailAndPassword,
  updatePassword,
  signInWithEmailAndPassword
} from 'firebase/auth';

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
    role: 'SUPER_ADMIN'
};

// Default password for migration/seeding (temporary)
const DEFAULT_ADMIN_PASSWORD = 'breakthrough';

// --- Default Templates ---
const SEED_TEMPLATES: AssessmentTemplate[] = [
  {
    id: 'default-standard',
    name: 'BLT Assessment (30 questions)',
    assessmentType: 'blt',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    categories: [
        { name: "Mastering Self-Leadership", questions: [{ id: "q-0-0", text: "I am continuously learning and improving" }, { id: "q-0-1", text: "I understand and leverage my strengths every day" }, { id: "q-0-2", text: "I am aware of my emotional state and have the ability to effectively manage it" }, { id: "q-0-3", text: "I focus on those things I control and accept the things I can't" }, { id: "q-0-4", text: "When I need help, I am comfortable asking for it" }] },
        { name: "Proactively Structuring the Team", questions: [{ id: "q-1-0", text: "Our leadership team is structured so that each major function has one person accountable and no member of the leadership team is stretched too thin" }, { id: "q-1-1", text: "Our leadership team has a twelve-quarter forecast for the business that drives proactive decisions regarding additions and changes to the leadership team structure" }, { id: "q-1-2", text: "Each leadership team role has a job scorecard that includes the mission, responsibilities, measures of success, and competencies required for the role" }, { id: "q-1-3", text: "Each member of the leadership team is part of a mastermind group of peers that help challenge them and act as a sounding board" }, { id: "q-1-4", text: "We have a professional services A-Team consisting of exceptional attorneys, accountants, coaches, bankers, and other critical external services" }] },
        { name: "Finding the Right People", questions: [{ id: "q-2-0", text: "We proactively build a virtual bench of potential A-players for the leadership team and the leadership team's direct reports" }, { id: "q-2-1", text: "We have an effective process to develop strong leaders to fill new leadership team needs from within the organization" }, { id: "q-2-2", text: "We have an effective employee referral program that generates at least one-third of our candidates for leadership positions and their direct reports" }, { id: "q-2-3", text: "We have a thorough screening, interviewing, and evaluation process that ensures 90 percent of leadership team hires are A-players" }, { id: "q-2-4", text: "Every leadership team member has a strong #2 who has the potential to be their successor" }] },
        { name: "Building a Resilient Culture", questions: [{ id: "q-3-0", text: "Our leadership team has developed, communicated, and lives by a set of core values that anchors our culture and is nonnegotiable" }, { id: "q-3-1", text: "Each member of the leadership team rallies behind an inspiring core purpose that answers the question, 'Why does our company exist?'" }, { id: "q-3-2", text: "Each leadership team member is a true believer and evangelist for our company's long-term (ten years or more) and midterm (three-year) vision" }, { id: "q-3-3", text: "Our leadership team is a safe place for us to be honest and vulnerable, to freely admit mistakes, to ask for help, and to ask for forgiveness" }, { id: "q-3-4", text: "Members of the leadership team consistently hold themselves and others on the team accountable for their commitments" }] },
        { name: "Executing With Discipline", questions: [{ id: "q-4-0", text: "Our leadership team is aligned around no more than five priorities for the year and the quarter" }, { id: "q-4-1", text: "There is clear accountability (one 'owner' and a clear measure of success) for each annual and quarterly priority" }, { id: "q-4-2", text: "We measure and hold each leader accountable to two to three leading and lagging key performance indicators" }, { id: "q-4-3", text: "Our planning and communication rhythm allows us to effectively plan and adjust throughout the year and quarter to take advantage of opportunities and attack major challenges" }, { id: "q-4-4", text: "Our planning and communication rhythm drives effective communication across the leadership team and cascades down from and up to the leadership team" }] },
        { name: "Developing & Improving", questions: [{ id: "q-5-0", text: "As a leadership team, we spend time each quarter learning and growing together (books, conferences, new tools, techniques, etc.)" }, { id: "q-5-1", text: "All leadership team members are held accountable to their own learning and development plans (personal and professional)" }, { id: "q-5-2", text: "All leadership team members are held accountable for ensuring their direct reports have learning and development plans (personal and professional)" }, { id: "q-5-3", text: "Our leadership team assesses the talent of their direct reports quarterly and defines ninety-day action steps (coaching, mentoring, challenging, warning, etc.) for each direct report" }, { id: "q-5-4", text: "Our leadership team holds one another accountable for maximizing their team's talent as well as making the tough decision to 'cut the cord' where necessary" }] }
    ].map((c, i) => ({
        id: `cat-${i}`,
        name: c.name,
        questions: c.questions.map((q, j) => ({ id: q.id || `q-${i}-${j}`, text: q.text, type: 'rating' }))
    }))
  },
  {
    id: 'default-strategy',
    name: 'BLT Assessment (35 questions)',
    assessmentType: 'blt',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    categories: [
        { name: "Mastering Self-Leadership", questions: ["I am continuously learning and improving", "I understand and leverage my strengths every day", "I am aware of my emotional state and have the ability to effectively manage it", "I focus on those things I control and accept the things I can't", "When I need help, I am comfortable asking for it"] },
        { name: "Proactively Structuring the Team", questions: ["Our leadership team is structured so that each major function has one person accountable and no member of the leadership team is stretched too thin", "Our leadership team has a twelve-quarter forecast for the business that drives proactive decisions regarding additions and changes to the leadership team structure", "Each leadership team role has a job scorecard that includes the mission, responsibilities, measures of success, and competencies required for the role", "Each member of the leadership team is part of a mastermind group of peers that help challenge them and act as a sounding board", "We have a professional services A-Team consisting of exceptional attorneys, accountants, coaches, bankers, and other critical external services"] },
        { name: "Finding the Right People", questions: ["We proactively build a virtual bench of potential A-players for the leadership team and the leadership team's direct reports", "We have an effective process to develop strong leaders to fill new leadership team needs from within the organization", "We have an effective employee referral program that generates at least one-third of our candidates for leadership positions and their direct reports", "We have a thorough screening, interviewing, and evaluation process that ensures 90 percent of leadership team hires are A-players", "Every leadership team member has a strong #2 who has the potential to be their successor"] },
        { name: "Building a Resilient Culture", questions: ["Our leadership team has developed, communicated, and lives by a set of core values that anchors our culture and is nonnegotiable", "Each member of the leadership team rallies behind an inspiring core purpose that answers the question, 'Why does our company exist?'", "Each leadership team member is a true believer and evangelist for our company's long-term (ten years or more) and midterm (three-year) vision", "Our leadership team is a safe place for us to be honest and vulnerable, to freely admit mistakes, to ask for help, and to ask for forgiveness", "Members of the leadership team consistently hold themselves and others on the team accountable for their commitments"] },
        { name: "Create a Differentiated Strategy", questions: ["Our leadership team has developed a core customer avatar that includes who they are (specific person, demographics, industry, role), their wants, needs, issues and fears", "Our leadership team is aligned around a 3-year set of key financial and non-financial targets (i.e. numbers)", "Our leadership team has defined, and is aligned around a 3-year \"sandbox\"- the products/services, geographies and distribution channels we will be playing in", "Our leadership team has used our understanding of the market and competition to create 3-5 \"differentiators\" that will drive our growth over the next 3 years", "As a leadership team, we review and update our strategy annually and, where needed, quarterly"] },
        { name: "Executing With Discipline", questions: ["Our leadership team is aligned around no more than five priorities for the year and the quarter", "There is clear accountability (one 'owner' and a clear measure of success) for each annual and quarterly priority", "We measure and hold each leader accountable to two to three leading and lagging key performance indicators", "Our planning and communication rhythm allows us to effectively plan and adjust throughout the year and quarter to take advantage of opportunities and attack major challenges", "Our planning and communication rhythm drives effective communication across the leadership team and cascades down from and up to the leadership team"] },
        { name: "Developing & Improving", questions: ["As a leadership team, we spend time each quarter learning and growing together (books, conferences, new tools, techniques, etc.)", "All leadership team members are held accountable to their own learning and development plans (personal and professional)", "All leadership team members are held accountable for ensuring their direct reports have learning and development plans (personal and professional)", "Our leadership team assesses the talent of their direct reports quarterly and defines ninety-day action steps (coaching, mentoring, challenging, warning, etc.) for each direct report", "Our leadership team holds one another accountable for maximizing their team's talent as well as making the tough decision to 'cut the cord' where necessary"] }
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
    assessmentType: 'long-form',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    categories: [
        { 
            id: 'cp-cat-1',
            name: "Vision & Ideal State", 
            questions: [
                { id: "cp-q-1", text: "LONG-TERM IDEAL(10+ Years): Succinctly describe in a statement what you would like to be true. Consider covering impact, reputation, and what the company looks like.", type: 'text' },
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
const getLocalData = <T>(key: string): T[] => {
    try {
        const json = localStorage.getItem(key);
        return json ? JSON.parse(json) : [];
    } catch { return []; }
};

const setLocalData = <T>(key: string, data: T[]) => {
    localStorage.setItem(key, JSON.stringify(data));
};

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
    // DISABLED: After Firebase Auth migration, users are managed via Firebase Auth
    // The default admin should be created manually in Firebase Console
    // Keeping this function for backward compatibility but it does nothing

    // Only seed in localStorage mode (for development without Firebase)
    if (!isConfigured()) {
        const users = getLocalData<User>(LOCAL_USERS_KEY);
        if (users.length === 0) {
            setLocalData(LOCAL_USERS_KEY, [DEFAULT_ADMIN]);
        }
    }

    // Do NOT auto-create Firestore users - they should come from Firebase Auth
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

// Helper: Create Firebase Auth user and Firestore metadata
export const createFirebaseUser = async (email: string, password: string, name: string, role: string): Promise<string> => {
    if (!auth || !db) throw new Error("Firebase not configured");

    // Verify admin is logged in on primary auth instance
    const currentAdmin = auth.currentUser;
    if (!currentAdmin) {
        throw new Error("You must be logged in as an admin to create users");
    }

    // Get secondary auth instance for user creation
    // This prevents logging out the admin when creating a new user
    const secondaryAuth = getSecondaryAuth();
    if (!secondaryAuth) throw new Error("Secondary auth not configured");

    // Step 1: Create Firebase Auth account on secondary instance
    // This won't affect the admin's session on the primary instance
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = userCredential.user.uid;

    // Step 2: Create Firestore metadata document
    // The Firestore rules allow authenticated users to create their own document
    const userMetadata: User = {
        id: uid,
        name,
        email,
        role: role as 'SUPER_ADMIN' | 'ADMIN'
    };
    await setDoc(doc(db, USERS_COL, uid), userMetadata);

    // Step 3: Sign out from secondary auth (cleanup)
    await secondaryAuth.signOut();

    // Admin remains logged in on primary auth instance!
    return uid;
};

// Helper: Update Firebase Auth user password
export const updateFirebaseUserPassword = async (email: string, currentPassword: string, newPassword: string): Promise<void> => {
    if (!auth) throw new Error("Firebase Auth not configured");

    // Sign in temporarily to get user object (admin operation)
    const userCredential = await signInWithEmailAndPassword(auth, email, currentPassword);
    await updatePassword(userCredential.user, newPassword);
};

// Helper: Delete Firebase Auth user
export const deleteFirebaseUser = async (uid: string): Promise<void> => {
    if (!auth) throw new Error("Firebase Auth not configured");

    // Note: This requires Firebase Admin SDK or special permissions
    // For now, we'll just delete Firestore data
    // TODO: Use Firebase Admin SDK on backend to delete auth accounts
    console.warn("Firebase Auth user deletion requires Admin SDK. Only deleting Firestore metadata.");
};

export const saveUser = async (user: User): Promise<void> => {
    // Save metadata to Firestore (no password stored)
    const userMetadata: User = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
    };

    if (isConfigured() && db) {
        await setDoc(doc(db, USERS_COL, user.id), userMetadata);
        return;
    }
    const local = getLocalData<User>(LOCAL_USERS_KEY);
    const idx = local.findIndex(u => u.id === user.id);
    if (idx >= 0) local[idx] = userMetadata;
    else local.push(userMetadata);
    setLocalData(LOCAL_USERS_KEY, local);
};

export const updateUserPassword = async (userId: string, newPassword: string): Promise<void> => {
    // NOTE: Password updates should now be done via Firebase Auth
    // This function is kept for backwards compatibility but does nothing
    // Use updateFirebaseUserPassword() or Firebase Auth SDK directly
    console.warn("updateUserPassword is deprecated. Use Firebase Auth to update passwords.");

    // For local storage fallback (non-Firebase mode)
    if (!isConfigured()) {
        const local = getLocalData<User>(LOCAL_USERS_KEY);
        const idx = local.findIndex(u => u.id === userId);
        if (idx >= 0) {
            // Can't store password anymore
            console.warn("Password storage not supported in localStorage mode with Firebase Auth");
        }
    }
};

export const deleteUser = async (id: string): Promise<void> => {
    // Delete Firestore metadata
    if (isConfigured() && db) {
        await deleteDoc(doc(db, USERS_COL, id));
        
        // Call Netlify function to delete from Firebase Auth
        try {
            // Get the base URL - works in both dev and production
            const baseUrl = window.location.origin;
            const functionUrl = `${baseUrl}/.netlify/functions/deleteAuthUser`;
            
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: id }),
            });

            if (!response.ok) {
                const error = await response.json();
                console.warn(`Failed to delete Firebase Auth user ${id}:`, error.message || 'Unknown error');
                // Don't throw - Firestore deletion succeeded, Auth deletion is best-effort
            } else {
                console.log(`Successfully deleted Firebase Auth user: ${id}`);
            }
        } catch (error: any) {
            // Log but don't fail - Firestore deletion already succeeded
            console.warn(`Error calling deleteAuthUser function for ${id}:`, error.message);
        }
        
        return;
    }

    // LocalStorage fallback
    const local = getLocalData<User>(LOCAL_USERS_KEY);
    setLocalData(LOCAL_USERS_KEY, local.filter(u => u.id !== id));
};

// --- Company Management ---

export const getCompanies = async (): Promise<Company[]> => {
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
        responses: []
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
        await setDoc(ref, { viewedAt: Date.now() }, { merge: true });
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
