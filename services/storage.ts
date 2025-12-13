1| import { Company, ParticipantResponse, AssessmentTemplate, User, AppSettings } from '../types';
2| import { db, isConfigured } from './firebaseConfig';
3| import { 
4|   collection, 
5|   doc, 
6|   getDocs, 
7|   setDoc, 
8|   deleteDoc, 
9|   getDoc,
10|   updateDoc
11| } from "firebase/firestore/lite";
12| 
13| // --- Collections ---
14| const COMPANIES_COL = 'companies';
15| const TEMPLATES_COL = 'templates';
16| const USERS_COL = 'users';
17| const SETTINGS_COL = 'settings';
18| const SETTINGS_DOC_ID = 'global_settings';
19| 
20| // --- LocalStorage Keys (Fallback) ---
21| const LOCAL_COMPANIES_KEY = 'breakthrough_companies';
22| const LOCAL_TEMPLATES_KEY = 'breakthrough_templates';
23| const LOCAL_USERS_KEY = 'breakthrough_users';
24| const LOCAL_SETTINGS_KEY = 'breakthrough_settings';
25| 
26| // --- Default Users (Seeding) ---
27| const DEFAULT_ADMIN: User = {
28|     id: 'super-admin-01',
29|     name: 'Mike Goldman',
30|     email: 'mike@mike-goldman.com',
31|     role: 'SUPER_ADMIN',
32|     password: 'breakthrough'
33| };
34| 
35| // --- Default Templates ---
36| const SEED_TEMPLATES: AssessmentTemplate[] = [
37|   {
38|     id: 'default-standard',
39|     name: 'BLT Assessment (30 questions)',
40|     createdAt: Date.now(),
41|     updatedAt: Date.now(),
42|     categories: [
43|         { name: "Mastering Self-Leadership", questions: [{ id: "q-0-0", text: "I am continuously learning and improving" }, { id: "q-0-1", text: "I understand and leverage my strengths every day" }, { id: "q-0-2", text: "I am aware of my emotional state and have strategies to manage it" }, { id: "q-0-3", text: "I set clear personal priorities aligned to the team's goals" }] },
44|         { name: "Proactively Structuring the Team", questions: [{ id: "q-1-0", text: "Our leadership team is structured so that each major function has one person accountable and no member of the leadership team is stepping on another's toes" }, { id: "q-1-1", text: "We have a clear hand-off process for cross-functional initiatives" }] },
45|         { name: "Finding the Right People", questions: [{ id: "q-2-0", text: "We proactively build a virtual bench of potential A-players for the leadership team and the leadership team's direct reports" }, { id: "q-2-1", text: "Hiring decisions for key roles are made using clear criteria and not personality" }] },
46|         { name: "Building a Resilient Culture", questions: [{ id: "q-3-0", text: "Our leadership team has developed, communicated, and lives by a set of core values that anchors our culture and is non-negotiable" }, { id: "q-3-1", text: "We openly discuss cultural gaps and take action to close them" }] },
47|         { name: "Executing With Discipline", questions: [{ id: "q-4-0", text: "Our leadership team is aligned around no more than five priorities for the year and the quarter" }, { id: "q-4-1", text: "We have a disciplined meeting rhythm with clear owners and follow-up" }] },
48|         { name: "Developing & Improving", questions: [{ id: "q-5-0", text: "As a leadership team, we spend time each quarter learning and growing together (books, conferences, new tools, techniques, etc.)" }, { id: "q-5-1", text: "We run frequent retrospectives to learn from wins and losses" }] }
49|     ].map((c, i) => ({
50|         id: `cat-${i}`,
51|         name: c.name,
52|         questions: c.questions.map((q, j) => ({ id: q.id || `q-${i}-${j}`, text: q.text, type: 'rating' }))
53|     }))
54|   },
55|   {
56|     id: 'default-strategy',
57|     name: 'BLT Assessment (35 questions)',
58|     createdAt: Date.now(),
59|     updatedAt: Date.now(),
60|     categories: [
61|         { name: "Mastering Self-Leadership", questions: ["I am continuously learning and improving", "I understand and leverage my strengths every day", "I am aware of my emotional state and have strategies to manage it", "I set clear personal priorities aligned to the team's goals"] },
62|         { name: "Proactively Structuring the Team", questions: ["Our leadership team is structured so that each major function has one person accountable and no member of the leadership team is stepping on another's toes", "We have a clear hand-off process for cross-functional initiatives", "Roles and accountabilities are documented and understood"] },
63|         { name: "Finding the Right People", questions: ["We proactively build a virtual bench of potential A-players for the leadership team and the leadership team's direct reports", "Hiring decisions for key roles are made using clear criteria and not personality", "We invest in structured onboarding for key roles"] },
64|         { name: "Building a Resilient Culture", questions: ["Our leadership team has developed, communicated, and lives by a set of core values that anchors our culture and is non-negotiable", "We openly discuss cultural gaps and take action to close them", "Feedback is given and received productively across the organization"] },
65|         { name: "Create a Differentiated Strategy", questions: ["Our leadership team has developed a core customer avatar that includes who they are (specific person, demographics, industry, role)", "We have a clear differentiating value proposition that is understood across the company", "We can articulate a one-paragraph strategy that guides tactical choices"] },
66|         { name: "Executing With Discipline", questions: ["Our leadership team is aligned around no more than five priorities for the year and the quarter", "There is clear accountability (one 'owner') for each priority", "We review and re-focus priorities regularly"] },
67|         { name: "Developing & Improving", questions: ["As a leadership team, we spend time each quarter learning and growing together (books, conferences, new tools, techniques, etc.)", "We run frequent retrospectives to learn from wins and losses", "We measure and track leadership development metrics"] }
68|     ].map((c, i) => ({
69|         id: `cat-${i}`,
70|         name: c.name,
71|         questions: c.questions.map((q, j) => ({ id: `q-${i}-${j}`, text: q, type: 'rating' as const }))
72|     }))
73|   },
74|   // NEW: Pre-Planning Survey
75|   {
76|     id: 'default-coaching',
77|     name: 'Pre-Planning Survey',
78|     createdAt: Date.now(),
79|     updatedAt: Date.now(),
80|     categories: [
81|         { 
82|             id: 'cp-cat-1',
83|             name: "Vision & Ideal State", 
84|             questions: [
85|                 { id: "cp-q-1", text: "LONG-TERM IDEAL(10+ Years): Succinctly describe in a statement what you would like to be true. Consider covering impact, reputation, and what the company looks like in terms of customers and market position.", type: 'text' },
86|                 { id: "cp-q-3", text: "NEAR-TERM IDEAL (3 Years): Given the long-term ideal, what must be true in the near-term for us to be sure we are on the path?", type: 'text' }
87|             ] 
88|         },
89|         { 
90|             id: 'cp-cat-2',
91|             name: "Future Market Trends", 
92|             questions: [
93|                 { id: "cp-q-2a", text: "Trend 1: List an important trend relevant to us over the next 1-3 years.", type: 'text' },
94|                 { id: "cp-q-2b", text: "Trend 2: List a second important trend relevant to us over the next 1-3 years.", type: 'text' },
95|                 { id: "cp-q-2c", text: "Trend 3: List a third important trend relevant to us over the next 1-3 years.", type: 'text' }
96|             ] 
97|         },
98|         { 
99|             id: 'cp-cat-3',
100|             name: "The 3-Year Picture", 
101|             questions: [
102|                 { id: "cp-q-4", text: "In 3 years, what will we be selling?", type: 'text' },
103|                 { id: "cp-q-5", text: "In 3 years, how will we sell it?", type: 'text' },
104|                 { id: "cp-q-6", text: "In 3 years, where will we be selling it?", type: 'text' },
105|                 { id: "cp-q-7", text: "In 3 years, how many will we sell?", type: 'text' }
106|             ] 
107|        },
108|         { 
109|             id: 'cp-cat-4',
110|             name: "SWOT Analysis", 
111|             questions: [
112|                 { id: "cp-q-8", text: "What are the top 2 strengths of this organization that has been the source of success thus far?", type: 'text' },
113|                 { id: "cp-q-9", text: "What are the top 2 internal weaknesses of the organization?", type: 'text' },
114|                 { id: "cp-q-10", text: "What are the top 2 external opportunities we should be taking action on?", type: 'text' },
115|                 { id: "cp-q-11", text: "What are the top 2 external threats we should be taking action on?", type: 'text' }
116|             ] 
117|         },
118|         { 
119|             id: 'cp-cat-5',
120|             name: "Current Strategy", 
121|             questions: [
122|                 { id: "cp-q-12", text: "Describe the positive thing about the current strategy?", type: 'text' },
123|                 { id: "cp-q-13", text: "What frustration do you have regarding the current strategy?", type: 'text' },
124|                 { id: "cp-q-14", text: "If you could change one thing with our current strategy – what would it be?", type: 'text' },
125|                 { id: "cp-q-15", text: "If you could change one thing operationally - what would it be?", type: 'text' }
126|             ] 
127|         },
128|         { 
129|             id: 'cp-cat-6',
130|             name: "Priorities", 
131|             questions: [
132|                 { id: "cp-q-16", text: "What do you believe the #1 priority for the company should be for the next 12 months (be specific)?", type: 'text' },
133|                 { id: "cp-q-17", text: "What do you believe the #1 priority for the company should be over the next 90 days (be specific)?", type: 'text' },
134|                 { id: "cp-q-18", text: "What do you believe YOUR #1 priority should be for the next 90 days (be specific)?", type: 'text' }
135|             ] 
136|         }
137|     ]
138|   }
139| ];
140| 
141| // --- Settings Management ---
142| export const getSettings = async (): Promise<AppSettings> => {
143|     if (isConfigured() && db) {
144|         try {
145|             const ref = doc(db, SETTINGS_COL, SETTINGS_DOC_ID);
146|             const snap = await getDoc(ref);
147|             if (snap.exists()) return snap.data() as AppSettings;
148|         } catch (e) {}
149|     }
150|     const local = localStorage.getItem(LOCAL_SETTINGS_KEY);
151|     return local ? JSON.parse(local) : {};
152| };
153| 
154| export const saveSettings = async (settings: AppSettings): Promise<void> => {
155|     if (isConfigured() && db) {
156|         await setDoc(doc(db, SETTINGS_COL, SETTINGS_DOC_ID), settings, { merge: true });
157|     }
158|     const current = await getSettings(); 
159|     const newSettings = { ...current, ...settings };
160|     localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(newSettings));
161| };
162| 
163| // Re-export logo functions to use Settings
164| export const saveLogo = async (base64: string): Promise<void> => {
165|     await saveSettings({ logoUrl: base64 });
166| };
167| 
168| export const getLogo = async (): Promise<string | null> => {
169|     const s = await getSettings();
170|     return s.logoUrl || null;
171| };
172| 
173| export const removeLogo = async (): Promise<void> => {
174|     await saveSettings({ logoUrl: '' });
175| };
176| 
177| // --- Helper for LocalStorage ---
178| const getLocalData = <T,>(key: string): T[] => {
179|     try {
180|         const json = localStorage.getItem(key);
181|         return json ? JSON.parse(json) : [];
182|     } catch { return []; }
183| };
184| 
185| const setLocalData = <T,>(key: string, data: T[]) => {
186|     localStorage.setItem(key, JSON.stringify(data));
187| };
188| 
189| // --- Utilities for publicId/slugs ---
190| 
191| function slugify(name: string) {
192|   return name
193|     .toString()
194|     .toLowerCase()
195|     .trim()
196|     .replace(/[^a-z0-9]+/g, '-') // replace non-alphanum with hyphen
197|     .replace(/^-+|-+$/g, '');    // trim leading/trailing hyphens
198| }
199| 
200| function generatePublicId(name: string) {
201|   // Prefer crypto.randomUUID if available
202|   try {
203|     const globalCrypto: any = (globalThis as any)?.crypto;
204|     if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
205|       return `${slugify(name)}-${globalCrypto.randomUUID()}`;
206|     }
207|   } catch (e) {
208|     // ignore and fallback
209|   }
210|   // Fallback: slug + timestamp + short random
211|   return `${slugify(name)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
212| }
213| 
214| // --- Template Management ---
215| export const seedTemplates = async (): Promise<void> => {
216|     if (isConfigured() && db) {
217|         try {
218|             for (const seed of SEED_TEMPLATES) {
219|                 const ref = doc(db, TEMPLATES_COL, seed.id);
220|                 await setDoc(ref, seed, { merge: true });
221|             }
222|         } catch (e) {
223|             console.error("Firebase seeding failed", e);
224|         }
225|     } else {
226|         const current = getLocalData<AssessmentTemplate>(LOCAL_TEMPLATES_KEY);
227|         let changed = false;
228|         SEED_TEMPLATES.forEach(seed => {
229|             const idx = current.findIndex(c => c.id === seed.id);
230|             if (idx === -1) {
231|                 current.push(seed);
232|                 changed = true;
233|             } else if (current[idx].name !== seed.name) {
234|                 current[idx] = seed;
235|                 changed = true;
236|             }
237|         });
238|         if (changed) setLocalData(LOCAL_TEMPLATES_KEY, current);
239|     }
240| };
241| 
242| export const getTemplates = async (): Promise<AssessmentTemplate[]> => {
243|     await seedTemplates();
244|     if (isConfigured() && db) {
245|         try {
246|             const querySnapshot = await getDocs(collection(db, TEMPLATES_COL));
247|             const templates = querySnapshot.docs.map(doc => doc.data() as AssessmentTemplate);
248|             return templates.length > 0 ? templates : SEED_TEMPLATES;
249|         } catch (e) {
250|             console.warn("DB error, falling back to local templates");
251|             return SEED_TEMPLATES;
252|         }
253|     }
254|     const local = getLocalData<AssessmentTemplate>(LOCAL_TEMPLATES_KEY);
255|     return local.length > 0 ? local : SEED_TEMPLATES;
256| };
257| 
258| export const getTemplate = async (id: string): Promise<AssessmentTemplate | undefined> => {
259|     if (isConfigured() && db) {
260|         try {
261|             const ref = doc(db, TEMPLATES_COL, id);
262|             const snap = await getDoc(ref);
263|             if (snap.exists()) return snap.data() as AssessmentTemplate;
264|         } catch (e) {}
265|     }
266|     const local = getLocalData<AssessmentTemplate>(LOCAL_TEMPLATES_KEY);
267|     const found = local.find(t => t.id === id);
268|     if (found) return found;
269|     return SEED_TEMPLATES.find(t => t.id === id);
270| };
271| 
272| export const saveTemplate = async (template: AssessmentTemplate): Promise<void> => {
273|     const updated = { ...template, updatedAt: Date.now() };
274|     if (isConfigured() && db) {
275|         await setDoc(doc(db, TEMPLATES_COL, template.id), updated);
276|         return;
277|     }
278|     const local = getLocalData<AssessmentTemplate>(LOCAL_TEMPLATES_KEY);
279|     const idx = local.findIndex(t => t.id === template.id);
280|     if (idx >= 0) local[idx] = updated;
281|     else local.push(updated);
282|     setLocalData(LOCAL_TEMPLATES_KEY, local);
283| };
284| 
285| export const deleteTemplate = async (id: string): Promise<void> => {
286|     if (isConfigured() && db) {
287|         await deleteDoc(doc(db, TEMPLATES_COL, id));
288|         return;
289|     }
290|     const local = getLocalData<AssessmentTemplate>(LOCAL_TEMPLATES_KEY);
291|     setLocalData(LOCAL_TEMPLATES_KEY, local.filter(t => t.id !== id));
292| };
293| 
294| // --- User Management ---
295| export const seedUsers = async (): Promise<void> => {
296|     if (isConfigured() && db) {
297|         try {
298|             const ref = doc(db, USERS_COL, DEFAULT_ADMIN.id);
299|             const snap = await getDoc(ref);
300|             if (!snap.exists()) {
301|                 await setDoc(ref, DEFAULT_ADMIN);
302|             }
303|         } catch (e) {
304|             console.error("Firebase user seeding failed", e);
305|         }
306|     } else {
307|         const users = getLocalData<User>(LOCAL_USERS_KEY);
308|         if (users.length === 0) {
309|             setLocalData(LOCAL_USERS_KEY, [DEFAULT_ADMIN]);
310|         }
311|     }
312| }
313| 
314| export const getUsers = async (): Promise<User[]> => {
315|     await seedUsers();
316|     if (isConfigured() && db) {
317|         try {
318|             const snap = await getDocs(collection(db, USERS_COL));
319|             const users = snap.docs.map(d => d.data() as User);
320|             return users.length > 0 ? users : [DEFAULT_ADMIN];
321|         } catch (e) {
322|             console.warn("DB error users");
323|             return [DEFAULT_ADMIN];
324|         }
325|     }
326|     const local = getLocalData<User>(LOCAL_USERS_KEY);
327|     return local.length > 0 ? local : [DEFAULT_ADMIN];
328| };
329| 
330| export const saveUser = async (user: User): Promise<void> => {
331|     if (isConfigured() && db) {
332|         await setDoc(doc(db, USERS_COL, user.id), user);
333|         return;
334|     }
335|     const local = getLocalData<User>(LOCAL_USERS_KEY);
336|     const idx = local.findIndex(u => u.id === user.id);
337|     if (idx >= 0) local[idx] = user;
338|     else local.push(user);
339|     setLocalData(LOCAL_USERS_KEY, local);
340| };
341| 
342| export const updateUserPassword = async (userId: string, newPassword: string): Promise<void> => {
343|     if (isConfigured() && db) {
344|         const ref = doc(db, USERS_COL, userId);
345|         await updateDoc(ref, { password: newPassword });
346|         return;
347|     }
348|     const local = getLocalData<User>(LOCAL_USERS_KEY);
349|     const idx = local.findIndex(u => u.id === userId);
350|     if (idx >= 0) {
351|         local[idx].password = newPassword;
352|         setLocalData(LOCAL_USERS_KEY, local);
353|     }
354| };
355| 
356| export const deleteUser = async (id: string): Promise<void> => {
357|     if (isConfigured() && db) {
358|         await deleteDoc(doc(db, USERS_COL, id));
359|         return;
360|     }
361|     const local = getLocalData<User>(LOCAL_USERS_KEY);
362|     setLocalData(LOCAL_USERS_KEY, local.filter(u => u.id !== id));
363| };
364| 
365| // --- Company Management ---
366| 
367| // Ensure/migrate existing companies to have publicId where missing
368| export const ensurePublicIdsForAllCompanies = async (): Promise<void> => {
369|     if (isConfigured() && db) {
370|         try {
371|             const snap = await getDocs(collection(db, COMPANIES_COL));
372|             for (const d of snap.docs) {
373|                 const c = d.data() as Company;
374|                 if (!c.publicId) {
375|                     const publicId = generatePublicId(c.name || c.id);
376|                     // setDoc with merge to avoid overwriting other fields
377|                     await setDoc(doc(db, COMPANIES_COL, c.id), { publicId }, { merge: true } as any);
378|                 }
379|             }
380|         } catch (e) {
381|             console.warn("ensurePublicIdsForAllCompanies (db) failed", e);
382|         }
383|         return;
384|     }
385| 
386|     // local fallback
387|     const local = getLocalData<Company>(LOCAL_COMPANIES_KEY);
388|     let changed = false;
389|     local.forEach(c => {
390|         if (!c.publicId) {
391|             c.publicId = generatePublicId(c.name || c.id);
392|             changed = true;
393|         }
394|     });
395|     if (changed) setLocalData(LOCAL_COMPANIES_KEY, local);
396| };
397| 
398| export const getCompanies = async (): Promise<Company[]> => {
399|     // Backfill local or db companies with a publicId if missing (non-destructive)
400|     await ensurePublicIdsForAllCompanies();
401| 
402|     if (isConfigured() && db) {
403|         try {
404|             const snap = await getDocs(collection(db, COMPANIES_COL));
405|             return snap.docs.map(d => d.data() as Company);
406|         } catch (e) {
407|             return [];
408|         }
409|     }
410|     return getLocalData<Company>(LOCAL_COMPANIES_KEY);
411| };
412| 
413| export const getCompanyById = async (companyId: string): Promise<Company | undefined> => {
414|     if (isConfigured() && db) {
415|         try {
416|             const ref = doc(db, COMPANIES_COL, companyId);
417|             const snap = await getDoc(ref);
418|             if (snap.exists()) return snap.data() as Company;
419|             return undefined;
420|         } catch (e) {
421|             return undefined;
422|         }
423|     }
424|     const local = getLocalData<Company>(LOCAL_COMPANIES_KEY);
425|     return local.find(c => c.id === companyId);
426| };
427| 
428| export const getCompanyByPublicId = async (publicId: string): Promise<Company | undefined> => {
429|     if (isConfigured() && db) {
430|         try {
431|             // Firestore-lite doesn't provide a simple query helper in this import; fall back to scanning
432|             const snap = await getDocs(collection(db, COMPANIES_COL));
433|             for (const d of snap.docs) {
434|                 const c = d.data() as Company;
435|                 if (c.publicId === publicId) return c;
436|             }
437|             return undefined;
438|         } catch (e) {
439|             return undefined;
440|         }
441|     }
442|     const local = getLocalData<Company>(LOCAL_COMPANIES_KEY);
443|     return local.find(c => c.publicId === publicId);
444| };
445| 
446| export const saveCompany = async (company: Company): Promise<void> => {
447|     if (isConfigured() && db) {
448|         await setDoc(doc(db, COMPANIES_COL, company.id), company);
449|         return;
450|     }
451|     const local = getLocalData<Company>(LOCAL_COMPANIES_KEY);
452|     const idx = local.findIndex(c => c.id === company.id);
453|     if (idx >= 0) local[idx] = company;
454|     else local.push(company);
455|     setLocalData(LOCAL_COMPANIES_KEY, local);
456| };
457| 
458| export const createCompany = async (name: string, templateId: string, tags: string[] = []): Promise<Company> => {
459|     const newCompany: Company = {
460|         id: Date.now().toString(36) + Math.random().toString(36).substr(2),
461|         name,
462|         templateId,
463|         tags,
464|         createdAt: Date.now(),
465|         responses: [],
466|         publicId: generatePublicId(name)
467|     };
468|     await saveCompany(newCompany);
469|     return newCompany;
470| };
471| 
472| export const deleteCompany = async (id: string): Promise<void> => {
473|     if (isConfigured() && db) {
474|         await deleteDoc(doc(db, COMPANIES_COL, id));
475|         return;
476|     }
477|     const local = getLocalData<Company>(LOCAL_COMPANIES_KEY);
478|     setLocalData(LOCAL_COMPANIES_KEY, local.filter(c => c.id !== id));
479| };
480| 
481| // Updated: Track lastActivity on response
482| export const addResponseToCompany = async (companyId: string, response: ParticipantResponse): Promise<void> => {
483|     if (isConfigured() && db) {
484|         const ref = doc(db, COMPANIES_COL, companyId);
485|         const snap = await getDoc(ref);
486|         if (snap.exists()) {
487|             const comp = snap.data() as Company;
488|             comp.responses.push(response);
489|             comp.lastActivity = Date.now(); // Update activity timestamp
490|             await setDoc(ref, comp);
491|         }
492|         return;
493|     }
494|     const local = getLocalData<Company>(LOCAL_COMPANIES_KEY);
495|     const company = local.find(c => c.id === companyId);
496|     if (company) {
497|         company.responses.push(response);
498|         company.lastActivity = Date.now(); // Update activity timestamp
499|         setLocalData(LOCAL_COMPANIES_KEY, local);
500|     }
501| };
502| 
503| // New: Mark company as viewed by admin
504| export const markCompanyViewed = async (companyId: string): Promise<void> => {
505|     if (isConfigured() && db) {
506|         const ref = doc(db, COMPANIES_COL, companyId);
507|         // We merge to avoid overwriting responses if they came in concurrently
508|         await setDoc(ref, { viewedAt: Date.now() }, { merge: true } as any);
509|         return;
510|     }
511|     const local = getLocalData<Company>(LOCAL_COMPANIES_KEY);
512|     const company = local.find(c => c.id === companyId);
513|     if (company) {
514|         company.viewedAt = Date.now();
515|         setLocalData(LOCAL_COMPANIES_KEY, local);
516|     }
517| };
518| 
519| // --- Utils ---
520| export const encodeResponse = (response: ParticipantResponse): string => {
521|   try {
522|     return btoa(JSON.stringify(response));
523|   } catch (e) {
524|     return "";
525|   }
526| };
527| 
528| export const decodeResponse = (token: string): ParticipantResponse | null => {
529|   try {
530|     const json = atob(token);
531|     return JSON.parse(json);
532|   } catch (e) {
533|     return null;
534|   }
535| };
536| 
