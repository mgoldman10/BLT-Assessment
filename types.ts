export interface Question {
  id: string;
  text: string;
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
  [questionId: string]: number; // 0 to 4
}

export interface ParticipantResponse {
  id: string;
  firstName: string;
  lastName: string;
  email?: string; // Added email field
  timestamp: number;
  answers: UserAnswers;
}

export interface Company {
  id: string;
  name: string;
  templateId: string; // Links to the specific AssessmentTemplate used
  tags?: string[]; // For grouping/searching
  assessmentType?: 'standard' | 'strategy'; // DEPRECATED: Kept for migration
  createdAt: number;
  responses: ParticipantResponse[];
}

export type UserRole = 'SUPER_ADMIN' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string; // Only visible to Super Admin for management
}

export const SCALE_LABELS = {
  0: "Strongly Disagree",
  1: "Disagree",
  2: "Neutral",
  3: "Agree",
  4: "Strongly Agree"
};
