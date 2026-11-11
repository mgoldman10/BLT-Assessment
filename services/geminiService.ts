import { AssessmentData, AssessmentTemplate, Category, UserAnswers } from "../types";
import { getTemplate, fetchTemplateStrict } from "./storage";
import { auth } from "./firebaseConfig";

const getTotalQuestions = (template: AssessmentTemplate) =>
  template.categories.reduce((count, category) => count + category.questions.length, 0);

const resolveAssessmentType = (template: AssessmentTemplate): AssessmentTemplate['assessmentType'] => {
  if (template.assessmentType) return template.assessmentType;
  if (template.categories.some(category => category.questions.some(question => question.type === 'text'))) {
    return 'long-form';
  }
  const totalQuestions = getTotalQuestions(template);
  return totalQuestions === 30 || totalQuestions === 35 ? 'blt' : 'long-form';
};

const normalizeTemplateAssessmentType = (template: AssessmentTemplate): AssessmentTemplate => ({
  ...template,
  assessmentType: resolveAssessmentType(template)
});

const normalizeNonBltTemplate = (template: AssessmentTemplate): AssessmentTemplate => {
  const normalized = normalizeTemplateAssessmentType(template);
  if (normalized.assessmentType !== 'long-form') return normalized;
  return {
    ...normalized,
    categories: normalized.categories.map(category => ({
      ...category,
      questions: category.questions.map(question => ({
        ...question,
        type: 'text' as const
      }))
    }))
  };
};

// strict: used for participant links — a failed request throws (so an error is
// shown) instead of quietly substituting a different assessment.
export const getAssessmentData = async (templateId: string, strict = false): Promise<AssessmentData> => {
  const loadTemplate = strict ? fetchTemplateStrict : getTemplate;
  const template = await loadTemplate(templateId);

  // Fallback if template deleted or not found (shouldn't happen with seeding)
  if (!template) {
    const standard = await loadTemplate('default-standard');
    if (standard) {
      return { topic: standard.name, categories: standard.categories };
    }
    throw new Error("Assessment Template not found.");
  }

  const normalizedTemplate = normalizeNonBltTemplate(template);

  return {
    topic: normalizedTemplate.name, // FIXED: Uses the actual template name (e.g. "Pre-Planning Survey")
    categories: normalizedTemplate.categories
  };
};

// Gemini runs in Netlify functions (generateSummary / generateTemplate) so the
// API key stays on the server and never ships in the site's code.
const callAiFunction = async (name: string, payload: unknown): Promise<any> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // Logged-in admins send their login token: required for template generation,
  // and it exempts batch report printing from the per-visitor summary limit.
  const token = await auth?.currentUser?.getIdToken().catch(() => null);
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/.netlify/functions/${name}`, { method: 'POST', headers, body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) {
    throw new QuotaExceededError('The AI summary is busy right now. Please wait a minute, then click Retry.');
  }
  if (!res.ok) throw new Error(data.error || 'The AI summary is temporarily unavailable. Please try again later.');
  return data;
};

export const generateAssessmentTemplate = async (topic: string): Promise<Omit<AssessmentTemplate, 'id'|'createdAt'|'updatedAt'>> => {
  const data = await callAiFunction('generateTemplate', { topic });

  // Transform to internal structure with IDs
  const categories: Category[] = (data.categories || []).map((c: any, i: number) => ({
    id: `cat-${i}`,
    name: c.name,
    questions: (c.questions || []).map((q: string, j: number) => ({
      id: `q-${i}-${j}`,
      text: q
    }))
  }));

  return {
    name: data.name || `${topic} Assessment`,
    categories
  };
};

// New function for Executive Summary
export interface AIAnalysisInput {
    companyName: string;
    respondentCount: number;
    pillarScores: { name: string; score: number }[];
    topStrengths: { text: string; label: string }[];
    criticalGaps: { text: string; label: string }[];
    misalignments: { text: string; varianceDescription: string; label: string }[];
}

export class QuotaExceededError extends Error {
    retryAfter?: number;
    constructor(message: string, retryAfter?: number) {
        super(message);
        this.name = 'QuotaExceededError';
        this.retryAfter = retryAfter;
    }
}

export const generateExecutiveSummary = async (data: AIAnalysisInput): Promise<string> => {
    const result = await callAiFunction('generateSummary', data);
    return result.summary || "Could not generate analysis.";
};
