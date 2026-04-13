import { AssessmentData, AssessmentTemplate, Category, UserAnswers } from "../types";
import { getTemplate } from "./storage";
import { GoogleGenAI, Type } from "@google/genai";

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

export const getAssessmentData = async (templateId: string): Promise<AssessmentData> => {
  // Note: getTemplate is now async
  const template = await getTemplate(templateId);
  
  // Fallback if template deleted or not found (shouldn't happen with seeding)
  if (!template) {
    const standard = await getTemplate('default-standard');
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

export const generateAssessmentTemplate = async (topic: string): Promise<Omit<AssessmentTemplate, 'id'|'createdAt'|'updatedAt'>> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Cannot generate AI assessment.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: "You are an expert leadership coach and organizational psychologist creating professional team assessments. Generate a JSON response.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Professional title for the assessment" },
          categories: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Name of the pillar/category" },
                questions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING, description: "A statement to be rated 0-4" }
                }
              },
              required: ["name", "questions"]
            }
          }
        },
        required: ["name", "categories"]
      }
    },
    contents: `Create a professional team assessment template about: "${topic}".
    Requirements:
    1. Assessment Name should be professional.
    2. Create 5 to 7 distinct categories (pillars) relevant to the topic.
    3. Each category MUST have exactly 5 questions.
    4. Questions must be clear statements that a team member would rate on a scale (0=Strongly Disagree to 4=Strongly Agree).
    5. Tone: Professional, corporate, growth-oriented.`
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");

  const data = JSON.parse(text);

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
    if (!process.env.API_KEY) throw new Error("API Key missing");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Note: Scores are intentionally excluded from the data string below so the AI relies on context/labels
    const prompt = `
    Analyze the leadership assessment data for "${data.companyName}".
    Total Respondents: ${data.respondentCount}.
    
    Data Context:
    - Pillars: ${data.pillarScores.map(p => `${p.name} (${p.score.toFixed(1)})`).join(', ')}
    - Identified Strengths: ${data.topStrengths.map(s => `${s.label}: "${s.text}"`).join('; ')}
    - Identified Gaps: ${data.criticalGaps.map(g => `${g.label}: "${g.text}"`).join('; ')}
    - Split Votes (Misalignment): ${data.misalignments.map(m => `${m.label}: "${m.text}" (${m.varianceDescription})`).join('; ')}

    Task:
    Write a concise Executive Summary that fits in a small 3-column box at the bottom of one page.
    IMPORTANT: Keep each bullet point to ONE short sentence (max 20 words). Use ONLY 2-3 bullets per section.
    Output ONLY these 3 sections using Markdown headers:

    ### Key Strengths
    (2-3 bullets. Each bullet: one short sentence naming the strength theme. No elaboration.)

    ### Critical Gaps
    (2-3 bullets. Each bullet: one short sentence naming the gap or risk. No elaboration.)

    ### Areas of Misalignment
    ${data.respondentCount === 1
        ? "(Write 'N/A' because there is only 1 respondent, so misalignment is impossible to measure.)"
        : "(2-3 bullets. Each bullet: one short sentence describing where leaders disagreed. If aligned, say so in one sentence.)"
    }

    Constraint: Do not include an intro or conclusion. Use Markdown headers exactly as written above. Be extremely brief — this must fit in a small column.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });

        return response.text || "Could not generate analysis.";
    } catch (error: any) {
        // Check for quota/rate limit errors - handle different error structures
        const errorObj = error?.error || error;
        const errorCode = errorObj?.code || errorObj?.statusCode;
        const errorStatus = errorObj?.status || errorObj?.message;
        
        // Check for 429 or RESOURCE_EXHAUSTED
        if (errorCode === 429 || errorStatus === 'RESOURCE_EXHAUSTED' || 
            (typeof errorStatus === 'string' && errorStatus.includes('quota'))) {
            
            // Try to extract retry delay from various possible locations
            let retrySeconds: number | undefined;
            const details = errorObj?.details || errorObj?.error?.details || [];
            
            // Look for RetryInfo in details
            const retryInfo = details.find((d: any) => 
                d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' ||
                d.retryDelay
            );
            
            if (retryInfo?.retryDelay) {
                const delayStr = retryInfo.retryDelay.toString().replace('s', '');
                retrySeconds = Math.ceil(parseFloat(delayStr));
            }
            
            // Also check message for retry time
            if (!retrySeconds && errorObj?.message) {
                const match = errorObj.message.match(/retry in ([\d.]+)s/i);
                if (match) {
                    retrySeconds = Math.ceil(parseFloat(match[1]));
                }
            }
            
            const message = retrySeconds 
                ? `API quota exceeded (20 requests/day limit). Please wait ${retrySeconds} seconds and try again, or upgrade your Gemini API plan.`
                : 'API quota exceeded (20 requests/day limit). Please wait a moment and try again, or upgrade your Gemini API plan.';
            throw new QuotaExceededError(message, retrySeconds);
        }
        // Re-throw other errors
        throw error;
    }
};

