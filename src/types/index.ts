// Role constants
export const Role = {
  ADMIN: 'admin',
  LEADER: 'leader', 
  TEACHER: 'teacher',
  STUDENT: 'student'
} as const;

export type RoleType = typeof Role[keyof typeof Role];

// User interface (Firebase)
export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role: RoleType;
  isApproved: boolean;
  createdAt?: Date;
}

// Class interface (Firebase)
export interface Class {
  id: string;
  name: string;
  description?: string;
  code: string;
  teacherId: string;
  teacherName: string;
  studentCount: number;
  students?: string[];
  createdAt?: Date;
}

// Student in class (Firebase)
export interface StudentInClass {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  joinedAt?: Date;
}

// Assignment (Google Sheets via Apps Script)
export interface Assignment {
  id: string;
  classId: string;
  title: string;
  description?: string;
  problemText?: string;
  attachmentFileId?: string;
  attachmentFileName?: string;
  attachmentUrl?: string;
  solutionImageIds?: string[];
  solutionImagesCount: number;
  dueDate?: string;
  createdAt?: string;
  teacherId: string;
  className?: string; // Added for display
}

// Submission (Google Sheets via Apps Script)
export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  imageIds?: string[];
  imagesCount: number;
  textAnswer?: string;
  score?: number | string;
  feedback?: string;
  isGraded: boolean;
  submittedAt?: string;
  gradedAt?: string;
}

// API Key config (Google Sheets via Apps Script)
export interface ApiKeyConfig {
  id: string;
  name: string;
  key: string;
  isActive: boolean;
  usageCount: number;
  lastUsed?: string;
  createdAt?: string;
}
