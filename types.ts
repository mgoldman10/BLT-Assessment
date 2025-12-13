export interface Question {
  id: string;
  text: string;
  type?: 'rating' | 'text';
}

export interface Category {
  id: string;
  name: string;
  questions: Question[];
}

export interface AssessmentData {
  topic: string;
  categories: Category[];
}

export interface AssessmentTemplate {
  id: string;
  name: string;
  categories: Category[];
  createdAt: number;
  updatedAt: number;
}

export enum GameState {
  SETUP = 'SETUP',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED',
  ERROR = 'ERROR'
}

export interface UserAnswers {
  [questionId: string]: number | string;
}

export interface ParticipantResponse {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  timestamp: number;
  answers: UserAnswers;
}

export interface Company {
  id: string;
  name: string;
  templateId: string;
  tags?: string[];
  assessmentType?: 'standard' | 'strategy';
  createdAt: number;
  responses: ParticipantResponse[];
  lastActivity?: number;
  viewedAt?: number;

  // new: stable public identifier used to compose shareable URLs
  // optional here for backward-compatibility; createCompany will ensure it's set on creation
  publicId?: string;
}

// NEW: Settings for automation
export interface AppSettings {
    logoUrl?: string;
    webhookUrl?: string; // The Zapier URL
}

export type UserRole = 'SUPER_ADMIN' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
}

export const SCALE_LABELS = {
  0: "Strongly Disagree",
  1: "Disagree",
  2: "Neutral",
  3: "Agree",
  4: "Strongly Agree"
};
