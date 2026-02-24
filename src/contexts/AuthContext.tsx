import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { auth, signInWithGoogle, signOutUser, getCurrentUser, onAuthStateChanged } from '../services/firebase';
import type { User } from '../types';
import { Role } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isTeacher: boolean;
  isApproved: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      try {
        if (firebaseUser) {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Auth state change error:', err);
        setError('Đã có lỗi xảy ra');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    setError(null);
    try {
      const loggedInUser = await signInWithGoogle();
      setUser(loggedInUser);
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
      setUser(null);
    } catch (err: any) {
      setError(err.message || 'Đăng xuất thất bại');
    }
  };

  const isAdmin = user?.role === Role.ADMIN || user?.role === Role.LEADER;
  const isTeacher = user?.role === Role.ADMIN || user?.role === Role.LEADER || user?.role === Role.TEACHER;
  const isApproved = user?.isApproved ?? false;

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      login,
      logout,
      isAdmin,
      isTeacher,
      isApproved,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};
