import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signOut, 
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc,
  updateDoc,
  deleteDoc,
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import type { User, Class, StudentInClass } from '../types';
import { Role } from '../types';

// ============ FIREBASE CONFIG ============
const firebaseConfig = {
  apiKey: "AIzaSyAPoANvUvP_wbvjJ6GXqgACBMFXwi3Sz50",
  authDomain: "classroom-manager-e75a6.firebaseapp.com",
  projectId: "classroom-manager-e75a6",
  storageBucket: "classroom-manager-e75a6.firebasestorage.app",
  messagingSenderId: "688827951316",
  appId: "1:688827951316:web:8d25073353884f5888b341"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ============ HELPER FUNCTIONS ============
const toDate = (timestamp: Timestamp | Date | undefined | null): Date | undefined => {
  if (!timestamp) return undefined;
  if (timestamp instanceof Timestamp) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return undefined;
};

const generateCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// ============ AUTH FUNCTIONS ============
export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;
    
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const isFirstUser = usersSnapshot.empty;
      
      const newUser: User = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || 'Unknown',
        email: firebaseUser.email || undefined,
        avatar: firebaseUser.photoURL || undefined,
        role: isFirstUser ? Role.ADMIN : Role.STUDENT,
        isApproved: isFirstUser,
        createdAt: new Date()
      };
      
      await setDoc(userRef, {
        ...newUser,
        createdAt: serverTimestamp()
      });
      
      return newUser;
    }
    
    const userData = userSnap.data();
    return {
      id: userSnap.id,
      name: userData.name || '',
      email: userData.email,
      avatar: userData.avatar,
      role: userData.role || Role.STUDENT,
      isApproved: userData.isApproved ?? false,
      createdAt: toDate(userData.createdAt)
    };
  } catch (error) {
    console.error('Google sign in error:', error);
    throw error;
  }
};

export const signOutUser = () => signOut(auth);

export const getCurrentUser = async (): Promise<User | null> => {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return null;
  
  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const userData = userSnap.data();
    return {
      id: userSnap.id,
      name: userData.name || '',
      email: userData.email,
      avatar: userData.avatar,
      role: userData.role || Role.STUDENT,
      isApproved: userData.isApproved ?? false,
      createdAt: toDate(userData.createdAt)
    };
  }
  return null;
};

// ============ USER MANAGEMENT ============
export const getAllUsers = async (): Promise<User[]> => {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name || '',
      email: data.email,
      avatar: data.avatar,
      role: data.role || Role.STUDENT,
      isApproved: data.isApproved ?? false,
      createdAt: toDate(data.createdAt)
    };
  });
};

export const approveUser = async (userId: string): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), { isApproved: true });
};

export const rejectUser = async (userId: string): Promise<void> => {
  await deleteDoc(doc(db, 'users', userId));
};

export const updateUserRole = async (userId: string, role: string): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), { role });
};

// ============ CLASS FUNCTIONS ============
export const createClass = async (data: { name: string; description?: string; teacherId: string; teacherName: string }): Promise<Class> => {
  let code = generateCode();
  let attempts = 0;
  
  while (attempts < 10) {
    const existing = await getDocs(query(collection(db, 'classes'), where('code', '==', code)));
    if (existing.empty) break;
    code = generateCode();
    attempts++;
  }
  
  const classData = {
    name: data.name,
    description: data.description || '',
    code,
    teacherId: data.teacherId,
    teacherName: data.teacherName,
    studentCount: 0,
    students: [],
    createdAt: serverTimestamp()
  };
  
  const docRef = await addDoc(collection(db, 'classes'), classData);
  
  return {
    id: docRef.id,
    ...classData,
    createdAt: new Date()
  };
};

export const getClassesByTeacher = async (teacherId: string): Promise<Class[]> => {
  const q = query(collection(db, 'classes'), where('teacherId', '==', teacherId));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name || '',
      description: data.description,
      code: data.code || '',
      teacherId: data.teacherId || '',
      teacherName: data.teacherName || '',
      studentCount: data.studentCount || 0,
      students: data.students || [],
      createdAt: toDate(data.createdAt)
    };
  });
};

export const getClassByCode = async (code: string): Promise<Class | null> => {
  const q = query(collection(db, 'classes'), where('code', '==', code.toUpperCase()));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  
  const docSnap = snapshot.docs[0];
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name || '',
    description: data.description,
    code: data.code || '',
    teacherId: data.teacherId || '',
    teacherName: data.teacherName || '',
    studentCount: data.studentCount || 0,
    students: data.students || [],
    createdAt: toDate(data.createdAt)
  };
};

export const deleteClass = async (classId: string): Promise<void> => {
  const studentsSnapshot = await getDocs(collection(db, 'classes', classId, 'students'));
  for (const d of studentsSnapshot.docs) {
    await deleteDoc(d.ref);
  }
  await deleteDoc(doc(db, 'classes', classId));
};

export const addStudentEmailToClass = async (classId: string, email: string): Promise<void> => {
  await updateDoc(doc(db, 'classes', classId), {
    students: arrayUnion(email.toLowerCase())
  });
};

export const removeStudentEmailFromClass = async (classId: string, email: string): Promise<void> => {
  await updateDoc(doc(db, 'classes', classId), {
    students: arrayRemove(email.toLowerCase())
  });
};

export const joinClass = async (classId: string, student: { id: string; name: string; email?: string; avatar?: string }): Promise<void> => {
  const studentRef = doc(db, 'classes', classId, 'students', student.id);
  await setDoc(studentRef, {
    ...student,
    joinedAt: serverTimestamp()
  });
  
  const classRef = doc(db, 'classes', classId);
  const studentsSnapshot = await getDocs(collection(db, 'classes', classId, 'students'));
  await updateDoc(classRef, { studentCount: studentsSnapshot.size });
};

export const getStudentsInClass = async (classId: string): Promise<StudentInClass[]> => {
  const snapshot = await getDocs(collection(db, 'classes', classId, 'students'));
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name || '',
      email: data.email,
      avatar: data.avatar,
      joinedAt: toDate(data.joinedAt)
    };
  });
};

export const getClassesForStudent = async (studentId: string, studentEmail?: string): Promise<Class[]> => {
  const joinedClasses: Class[] = [];
  const classesSnapshot = await getDocs(collection(db, 'classes'));
  
  for (const classDoc of classesSnapshot.docs) {
    const studentRef = doc(db, 'classes', classDoc.id, 'students', studentId);
    const studentSnap = await getDoc(studentRef);
    
    if (studentSnap.exists()) {
      const data = classDoc.data();
      joinedClasses.push({
        id: classDoc.id,
        name: data.name || '',
        description: data.description,
        code: data.code || '',
        teacherId: data.teacherId || '',
        teacherName: data.teacherName || '',
        studentCount: data.studentCount || 0,
        students: data.students || [],
        createdAt: toDate(data.createdAt)
      });
    }
  }
  
  if (studentEmail) {
    const preAddedQuery = query(collection(db, 'classes'), where('students', 'array-contains', studentEmail.toLowerCase()));
    const preAddedSnapshot = await getDocs(preAddedQuery);
    
    for (const docSnap of preAddedSnapshot.docs) {
      if (!joinedClasses.find(c => c.id === docSnap.id)) {
        const data = docSnap.data();
        joinedClasses.push({
          id: docSnap.id,
          name: data.name || '',
          description: data.description,
          code: data.code || '',
          teacherId: data.teacherId || '',
          teacherName: data.teacherName || '',
          studentCount: data.studentCount || 0,
          students: data.students || [],
          createdAt: toDate(data.createdAt)
        });
      }
    }
  }
  
  return joinedClasses;
};

export { onAuthStateChanged };
