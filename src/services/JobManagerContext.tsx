import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { auth, db } from './firebaseService';
import { collection, doc, setDoc, addDoc, deleteDoc, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { ActionType, InferenceRoute } from '../types';
import { executeAIRequest } from './aiService';

export interface AIJob {
  id: string;
  uid: string;
  subjectId: string;
  type: ActionType | 'ask';
  title: string;
  sourceMaterialIds: string[];
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'interrupted';
  progressText: string;
  error?: string;
  resultId?: string;
  prompt?: string;
  answerContent?: string;
  route?: InferenceRoute;
  latencyMs?: number;
  ttftMs?: number;
  timestamp: number;
}

interface JobManagerContextType {
  jobs: AIJob[];
  enqueueJob: (params: {
    subjectId: string;
    type: ActionType | 'ask';
    title: string;
    sourceMaterialIds: string[];
    prompt: string;
    materialsText: string;
    subjectName: string;
    manualMode: any;
    isOnline: boolean;
    answerLength?: 'short' | 'detailed';
    explainFocus?: string;
    explainLevel?: 'Beginner' | 'Student' | 'Advanced';
  }) => Promise<string>;
  cancelJob: (jobId: string) => void;
  retryJob: (jobId: string) => void;
  resumeJob: (jobId: string) => void;
  deleteJob: (jobId: string) => void;
}

const JobManagerContext = createContext<JobManagerContextType | null>(null);

const MAX_CONCURRENT_JOBS = 3;

export const JobManagerProvider: React.FC<{ children: React.ReactNode; materials: any[]; subjects: any[] }> = ({
  children,
  materials,
  subjects
}) => {
  const [jobs, setJobs] = useState<AIJob[]>([]);
  const activeJobsRef = useRef<Set<string>>(new Set());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Firestore sync for jobs
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setJobs([]);
      return;
    }

    const q = query(collection(db, `users/${user.uid}/jobs`), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => {
        const data = docSnap.data() as AIJob;
        // On load, if status was running, mark as interrupted
        if (data.status === 'running' || data.status === 'queued') {
          return { ...data, status: 'interrupted' as const, progressText: 'Interrupted by reload/navigation' };
        }
        return { ...data, id: docSnap.id };
      });
      setJobs(list);
    }, (err) => {
      console.warn("Jobs sync error:", err);
    });

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  const saveJobFirestore = async (job: AIJob) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, `users/${user.uid}/jobs`, job.id);
      await setDoc(ref, job, { merge: true });
    } catch (e) {
      console.warn("Failed to save job in Firestore:", e);
    }
  };

  const processQueue = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;

    // Find queued jobs
    const queuedJobs = jobs.filter(j => j.status === 'queued');
    const runningCount = jobs.filter(j => j.status === 'running').length;
    const slotsAvailable = MAX_CONCURRENT_JOBS - runningCount;

    if (slotsAvailable <= 0 || queuedJobs.length === 0) return;

    const toRun = queuedJobs.slice(0, slotsAvailable);

    for (const job of toRun) {
      if (activeJobsRef.current.has(job.id)) continue;
      activeJobsRef.current.add(job.id);

      const updatedJob: AIJob = { ...job, status: 'running', progressText: 'Starting generation...' };
      setJobs(prev => prev.map(j => j.id === job.id ? updatedJob : j));
      await saveJobFirestore(updatedJob);

      const controller = new AbortController();
      abortControllersRef.current.set(job.id, controller);

      // Execute in background
      (async () => {
        const startTime = performance.now();
        try {
          const subject = subjects.find(s => s.id === job.subjectId);
          const subjectName = subject?.name || 'General Study';

          // Gather text from sourceMaterialIds if not passed
          let textToAnalyze = job.prompt || '';
          if (job.sourceMaterialIds && job.sourceMaterialIds.length > 0) {
            const parts: string[] = [];
            for (const mId of job.sourceMaterialIds) {
              const mat = materials.find(m => m.id === mId);
              if (mat) {
                parts.push(`=== Source: ${mat.title} ===\n${mat.contentPreview || mat.content || ''}`);
              }
            }
            if (parts.length > 0) {
              textToAnalyze = parts.join('\n\n') + (job.prompt ? `\n\nUser Question / Focus: ${job.prompt}` : '');
            }
          }

          const res = await executeAIRequest({
            text: textToAnalyze || 'Study material',
            actionType: job.type === 'ask' ? 'explain' : (job.type as any),
            subjectName,
            manualMode: 'auto',
            isOnline: navigator.onLine,
            answerLength: 'detailed',
            explainFocus: job.type === 'ask' ? job.prompt : undefined,
            onProgress: (statusText) => {
              setJobs(prev => prev.map(j => j.id === job.id ? { ...j, progressText: statusText } : j));
            }
          });

          const latencyMs = Math.round(performance.now() - startTime);

          // Save final result to Firestore results collection
          const resultRef = await addDoc(collection(db, `users/${user.uid}/results`), {
            subjectId: job.subjectId,
            title: job.title,
            type: job.type === 'quiz' ? 'quiz' : job.type === 'flashcards' ? 'flashcards' : job.type === 'summarize' ? 'summary' : 'explanation',
            content: res.response,
            prompt: job.prompt || textToAnalyze,
            materialIds: job.sourceMaterialIds,
            route: res.route,
            inferenceModeUsed: res.inferenceModeUsed,
            routingReason: res.routingReason,
            latencyMs,
            ttftMs: res.ttftMs,
            timestamp: Date.now()
          });

          const completedJob: AIJob = {
            ...job,
            status: 'done',
            progressText: 'Completed successfully',
            resultId: resultRef.id,
            answerContent: res.response,
            route: res.route,
            latencyMs,
            ttftMs: res.ttftMs
          };

          setJobs(prev => prev.map(j => j.id === job.id ? completedJob : j));
          await saveJobFirestore(completedJob);
        } catch (err: any) {
          if (controller.signal.aborted) {
            const cancelledJob: AIJob = { ...job, status: 'cancelled', progressText: 'Cancelled by user' };
            setJobs(prev => prev.map(j => j.id === job.id ? cancelledJob : j));
            await saveJobFirestore(cancelledJob);
          } else {
            const failedJob: AIJob = { ...job, status: 'failed', progressText: 'Failed', error: err?.message || String(err) };
            setJobs(prev => prev.map(j => j.id === job.id ? failedJob : j));
            await saveJobFirestore(failedJob);
          }
        } finally {
          activeJobsRef.current.delete(job.id);
          abortControllersRef.current.delete(job.id);
        }
      })();
    }
  }, [jobs, materials, subjects]);

  useEffect(() => {
    processQueue();
  }, [jobs, processQueue]);

  const enqueueJob = async (params: {
    subjectId: string;
    type: ActionType | 'ask';
    title: string;
    sourceMaterialIds: string[];
    prompt: string;
    materialsText: string;
    subjectName: string;
    manualMode: any;
    isOnline: boolean;
    answerLength?: 'short' | 'detailed';
    explainFocus?: string;
    explainLevel?: 'Beginner' | 'Student' | 'Advanced';
  }): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("Must be authenticated");

    const jobId = 'job-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const newJob: AIJob = {
      id: jobId,
      uid: user.uid,
      subjectId: params.subjectId,
      type: params.type,
      title: params.title,
      sourceMaterialIds: params.sourceMaterialIds,
      status: 'queued',
      progressText: 'Queued in background...',
      prompt: params.prompt,
      timestamp: Date.now()
    };

    // Instant optimistic UI update
    setJobs(prev => [newJob, ...prev]);
    await saveJobFirestore(newJob);
    return jobId;
  };

  const cancelJob = (jobId: string) => {
    const controller = abortControllersRef.current.get(jobId);
    if (controller) {
      controller.abort();
    }
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'cancelled', progressText: 'Cancelled' } : j));
    const job = jobs.find(j => j.id === jobId);
    if (job) saveJobFirestore({ ...job, status: 'cancelled', progressText: 'Cancelled' });
  };

  const retryJob = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const restarted: AIJob = { ...job, status: 'queued', progressText: 'Retrying...', error: undefined };
    setJobs(prev => prev.map(j => j.id === jobId ? restarted : j));
    await saveJobFirestore(restarted);
  };

  const resumeJob = async (jobId: string) => {
    await retryJob(jobId);
  };

  const deleteJob = async (jobId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/jobs`, jobId));
      setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (e) {
      console.warn("Failed to delete job:", e);
    }
  };

  return (
    <JobManagerContext.Provider value={{ jobs, enqueueJob, cancelJob, retryJob, resumeJob, deleteJob }}>
      {children}
    </JobManagerContext.Provider>
  );
};

export const useJobManager = () => {
  const context = useContext(JobManagerContext);
  if (!context) {
    throw new Error("useJobManager must be used within JobManagerProvider");
  }
  return context;
};
