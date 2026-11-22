import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Subject } from '../types';
import { updatePreferences } from '../services/firestoreService';
import { User } from 'firebase/auth';

interface SubjectContextType {
  activeSubjectId: string;
  activeSubject: Subject | null;
  setActiveSubjectId: (id: string, persistToUserPref?: boolean) => void;
  handleSubjectDeleted: (deletedId: string, remainingSubjects: Subject[]) => void;
  clearActiveSubject: () => void;
}

const SubjectContext = createContext<SubjectContextType | undefined>(undefined);

export const ACTIVE_SUBJECT_STORAGE_KEY = 'studybridge_active_subject_id';

export const SubjectProvider: React.FC<{
  children: React.ReactNode;
  subjects: Subject[];
  user: User | null;
  preferredSubjectId?: string;
}> = ({ children, subjects, user, preferredSubjectId }) => {
  // Read once from localStorage. NEVER recompute from newest/first subject on mount or list update.
  const [activeSubjectId, setActiveSubjectIdState] = useState<string>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(ACTIVE_SUBJECT_STORAGE_KEY) || '';
    }
    return '';
  });

  const userRef = useRef<User | null>(user);
  const prevUidRef = useRef<string | null>(user?.uid || null);
  useEffect(() => {
    const currentUid = user?.uid || null;
    if (prevUidRef.current && !currentUid) {
      setActiveSubjectIdState('');
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(ACTIVE_SUBJECT_STORAGE_KEY);
      }
    }
    prevUidRef.current = currentUid;
    userRef.current = user;
  }, [user]);

  // Sync from Firestore user preferences once loaded if no active subject is currently set locally
  useEffect(() => {
    if (preferredSubjectId && !activeSubjectId) {
      setActiveSubjectIdState(preferredSubjectId);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ACTIVE_SUBJECT_STORAGE_KEY, preferredSubjectId);
      }
    }
  }, [preferredSubjectId, activeSubjectId]);

  const setActiveSubjectId = (id: string, persistToUserPref = true) => {
    setActiveSubjectIdState(id);
    if (typeof localStorage !== 'undefined') {
      if (id) {
        localStorage.setItem(ACTIVE_SUBJECT_STORAGE_KEY, id);
      } else {
        localStorage.removeItem(ACTIVE_SUBJECT_STORAGE_KEY);
      }
    }
    if (persistToUserPref && userRef.current?.uid) {
      updatePreferences(userRef.current.uid, { activeSubjectId: id }).catch((err) => {
        console.warn('Error saving activeSubjectId preference:', err);
      });
    }
  };

  // Only change when active subject is explicitly deleted -> pick the first remaining one
  const handleSubjectDeleted = (deletedId: string, remainingSubjects: Subject[]) => {
    if (deletedId === activeSubjectId) {
      const nextId = remainingSubjects[0]?.id || '';
      setActiveSubjectId(nextId, true);
    }
  };

  const clearActiveSubject = () => {
    setActiveSubjectId('', false);
  };

  const activeSubject = subjects.find((s) => s.id === activeSubjectId) || null;

  return (
    <SubjectContext.Provider
      value={{
        activeSubjectId,
        activeSubject,
        setActiveSubjectId,
        handleSubjectDeleted,
        clearActiveSubject
      }}
    >
      {children}
    </SubjectContext.Provider>
  );
};

export function useActiveSubject(): SubjectContextType {
  const context = useContext(SubjectContext);
  if (!context) {
    throw new Error('useActiveSubject must be used within a SubjectProvider');
  }
  return context;
}
