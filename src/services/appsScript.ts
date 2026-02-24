// =================================================================
// GOOGLE APPS SCRIPT API SERVICE
// URL được lưu trong Firebase Firestore để tất cả users đều dùng được
// =================================================================

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// Cache URL trong memory
let APPS_SCRIPT_URL: string | null = null;

// Load URL từ Firestore (gọi 1 lần khi app khởi động)
export async function loadAppsScriptUrl(): Promise<string | null> {
  try {
    const configRef = doc(db, 'settings', 'appsScript');
    const configSnap = await getDoc(configRef);
    
    if (configSnap.exists()) {
      APPS_SCRIPT_URL = configSnap.data().url || null;
    }
    return APPS_SCRIPT_URL;
  } catch (error) {
    console.error('Error loading Apps Script URL:', error);
    return null;
  }
}

// Lưu URL vào Firestore (chỉ Admin/Teacher mới gọi)
export async function saveAppsScriptUrl(url: string): Promise<boolean> {
  try {
    const configRef = doc(db, 'settings', 'appsScript');
    await setDoc(configRef, { 
      url: url.trim(),
      updatedAt: new Date().toISOString()
    });
    APPS_SCRIPT_URL = url.trim();
    return true;
  } catch (error) {
    console.error('Error saving Apps Script URL:', error);
    return false;
  }
}

export function getAppsScriptUrl(): string {
  return APPS_SCRIPT_URL || '';
}

export function isAppsScriptConfigured(): boolean {
  return !!APPS_SCRIPT_URL && APPS_SCRIPT_URL.indexOf('script.google.com') !== -1;
}

// =================================================================
// API CALLS
// =================================================================

interface ApiResponse {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

async function callApi(action: string, data: Record<string, unknown> = {}): Promise<ApiResponse> {
  if (!APPS_SCRIPT_URL) {
    return { success: false, error: 'Apps Script URL chưa được cấu hình' };
  }
  
  try {
    // Dùng URLSearchParams để tránh CORS preflight
    const formData = new URLSearchParams();
    formData.append('data', JSON.stringify({ action, ...data }));
    
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: formData,
      redirect: 'follow'
    });

    const text = await response.text();
    
    try {
      return JSON.parse(text);
    } catch {
      console.error('Invalid JSON response:', text);
      return { success: false, error: 'Invalid response from server: ' + text.substring(0, 100) };
    }
  } catch (error) {
    console.error('API call error:', error);
    return { success: false, error: String(error) };
  }
}

// =================================================================
// ASSIGNMENT APIs
// =================================================================

export interface AssignmentData {
  classId: string;
  title: string;
  description?: string;
  problemText?: string;
  teacherId: string;
  dueDate?: string;
  attachmentBase64?: string;
  attachmentFileName?: string;
  solutionImages?: string[];
}

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
  className?: string;
}

export async function createAssignment(data: AssignmentData): Promise<ApiResponse> {
  return callApi('createAssignment', data as unknown as Record<string, unknown>);
}

export async function getAssignments(classId?: string): Promise<ApiResponse & { assignments?: Assignment[] }> {
  return callApi('getAssignments', { classId });
}

export async function deleteAssignment(assignmentId: string): Promise<ApiResponse> {
  return callApi('deleteAssignment', { assignmentId });
}

// =================================================================
// SUBMISSION APIs
// =================================================================

export interface SubmissionData {
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  images?: string[];
  textAnswer?: string;
}

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

export async function submitAssignment(data: SubmissionData): Promise<ApiResponse> {
  return callApi('submitAssignment', data as unknown as Record<string, unknown>);
}

export async function getSubmissions(assignmentId: string): Promise<ApiResponse & { submissions?: Submission[] }> {
  return callApi('getSubmissions', { assignmentId });
}

export async function getStudentSubmission(assignmentId: string, studentId: string): Promise<ApiResponse & { submission?: Submission | null }> {
  return callApi('getStudentSubmission', { assignmentId, studentId });
}

// =================================================================
// GRADING APIs
// =================================================================

export async function gradeSubmission(submissionId: string): Promise<ApiResponse & { score?: number; feedback?: string }> {
  return callApi('gradeSubmission', { submissionId });
}

export async function gradeAllSubmissions(assignmentId: string): Promise<ApiResponse & { gradedCount?: number; errorCount?: number }> {
  return callApi('gradeAllSubmissions', { assignmentId });
}

// =================================================================
// API KEY APIs
// =================================================================

export interface ApiKeyConfig {
  id: string;
  name: string;
  key: string;
  isActive: boolean;
  usageCount: number;
  lastUsed?: string;
  createdAt?: string;
}

export async function getApiKeys(): Promise<ApiResponse & { keys?: ApiKeyConfig[] }> {
  return callApi('getApiKeys');
}

export async function addApiKey(name: string, key: string): Promise<ApiResponse> {
  return callApi('addApiKey', { name, key });
}

export async function removeApiKey(keyId: string): Promise<ApiResponse> {
  return callApi('removeApiKey', { keyId });
}

export async function toggleApiKey(keyId: string): Promise<ApiResponse & { isActive?: boolean }> {
  return callApi('toggleApiKey', { keyId });
}

// =================================================================
// HELPER
// =================================================================

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
