import React, { createContext, useContext, useState, useEffect } from 'react';
import { ActionType, InferenceRoute, SavedResult } from '../types';
import { auth, db } from './firebaseService';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { executeAIRequest, getRouteLabel } from './aiService';
import { loadMaterialContent, addResultFirestore } from './firestoreService';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'interrupted';

export type BackgroundJob = {
  id: string;
  subjectId: string;
  type: 'summary' | 'explanation' | 'quiz' | 'flashcards' | 'ask';
  title: string;
  status: JobStatus;
  progressText: string;
  error?: string;
  resultId?: string;
  materialIds: string[];
  prompt?: string;
  explainFocus?: string;
  explainLevel?: 'Beginner' | 'Student' | 'Advanced';
  answerLength?: 'short' | 'detailed';
  createdAt: number;
  route?: InferenceRoute;
  latencyMs?: number;
  ttftMs?: number;
};

interface JobContextType {
  jobs: BackgroundJob[];
  startJob: (params: {
    subjectId: string;
    type: 'summary' | 'explanation' | 'quiz' | 'flashcards' | 'ask';
    title: string;
    materialIds: string[];
    prompt?: string;
    explainFocus?: string;
    explainLevel?: 'Beginner' | 'Student' | 'Advanced';
    answerLength?: 'short' | 'detailed';
  }) => Promise<string>;
  cancelJob: (jobId: string) => void;
  retryJob: (jobId: string) => void;
  resumeJob: (jobId: string) => void;
  removeJob: (jobId: string) => void;
}

const JobContext = createContext<JobContextType | null>(null);

export const JobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);

  // Subscribe to jobs in Firestore for current user
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setJobs([]);
      return;
    }

    const q = query(collection(db, `users/${user.uid}/jobs`), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const serverJobs: BackgroundJob[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as any;
        // If any job was running when page reloaded, mark as interrupted
        let status = data.status;
        if (status === 'running' || status === 'queued') {
          status = 'interrupted';
        }
        serverJobs.push({
          id: docSnap.id,
          ...data,
          status
        });
      });
      setJobs(serverJobs);
    }, (err) => {
      console.warn("Error subscribing jobs:", err);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  // Queue runner & background worker
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Find running jobs count
    const runningCount = jobs.filter(j => j.status === 'running').length;
    const maxConcurrent = 3;

    if (runningCount < maxConcurrent) {
      // Find next queued job
      const nextJob = jobs.find(j => j.status === 'queued');
      if (nextJob) {
        runJob(nextJob);
      }
    }
  }, [jobs, auth.currentUser]);

  const persistJobState = async (job: BackgroundJob) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, `users/${user.uid}/jobs`, job.id);
      await setDoc(ref, {
        subjectId: job.subjectId,
        type: job.type,
        title: job.title,
        status: job.status,
        progressText: job.progressText,
        error: job.error || null,
        resultId: job.resultId || null,
        materialIds: job.materialIds || [],
        prompt: job.prompt || null,
        explainFocus: job.explainFocus || null,
        explainLevel: job.explainLevel || null,
        answerLength: job.answerLength || null,
        createdAt: job.createdAt,
        route: job.route || null,
        latencyMs: job.latencyMs || null,
        ttftMs: job.ttftMs || null
      }, { merge: true });
    } catch (e) {
      console.warn("Failed to persist job state:", e);
    }
  };

  const startJob = async (params: {
    subjectId: string;
    type: 'summary' | 'explanation' | 'quiz' | 'flashcards' | 'ask';
    title: string;
    materialIds: string[];
    prompt?: string;
    explainFocus?: string;
    explainLevel?: 'Beginner' | 'Student' | 'Advanced';
    answerLength?: 'short' | 'detailed';
  }): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("Must be logged in to run jobs.");

    const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newJob: BackgroundJob = {
      id: jobId,
      subjectId: params.subjectId,
      type: params.type,
      title: params.title,
      status: 'queued',
      progressText: 'Queued in background...',
      materialIds: params.materialIds,
      prompt: params.prompt,
      explainFocus: params.explainFocus,
      explainLevel: params.explainLevel,
      answerLength: params.answerLength,
      createdAt: Date.now()
    };

    // Instant optimistic UI update
    setJobs(prev => [newJob, ...prev]);
    await persistJobState(newJob);
    return jobId;
  };

  const runJob = async (job: BackgroundJob) => {
    const user = auth.currentUser;
    if (!user) return;

    // Update status to running
    job.status = 'running';
    job.progressText = 'Gathering material sources...';
    setJobs(prev => prev.map(j => j.id === job.id ? { ...job } : j));
    await persistJobState(job);

    try {
      // Load content from ticked materials
      const textParts: string[] = [];
      for (const matId of job.materialIds) {
        try {
          const content = await loadMaterialContent(user.uid, matId);
          if (content) {
            textParts.push(content);
          }
        } catch {
          // ignore
        }
      }

      const combinedText = [textParts.join('\n\n'), job.prompt].filter(Boolean).join('\n\n');
      if (!combinedText.trim()) {
        throw new Error("No text content found in selected sources.");
      }

      job.progressText = 'Running hybrid AI inference...';
      setJobs(prev => prev.map(j => j.id === job.id ? { ...job } : j));

      const actionMap: Record<string, ActionType> = {
        summary: 'summarize',
        explanation: 'explain',
        quiz: 'quiz',
        flashcards: 'flashcards',
        ask: 'explain'
      };

      const aiResult = await executeAIRequest({
        text: combinedText,
        actionType: actionMap[job.type] || 'summarize',
        subjectName: 'Subject',
        manualMode: 'auto',
        isOnline: navigator.onLine,
        answerLength: job.answerLength || 'detailed',
        explainFocus: job.explainFocus,
        explainLevel: job.explainLevel || 'Student',
        onProgress: (status) => {
          job.progressText = status;
          setJobs(prev => prev.map(j => j.id === job.id ? { ...job } : j));
        }
      });

      if (!aiResult.response || !aiResult.response.trim()) {
        throw new Error("AI returned empty response.");
      }

      job.progressText = 'Saving result...';
      setJobs(prev => prev.map(j => j.id === job.id ? { ...job } : j));

      // Save result in Firestore
      const resultType = job.type === 'summary' ? 'summary' : 'explanation';
      const resultId = await addResultFirestore(user.uid, {
        subjectId: job.subjectId,
        title: job.title,
        type: resultType,
        content: aiResult.response,
        prompt: combinedText,
        materialIds: job.materialIds,
        route: aiResult.route,
        inferenceModeUsed: aiResult.inferenceModeUsed,
        routingReason: aiResult.routingReason,
        latencyMs: aiResult.latencyMs,
        ttftMs: aiResult.ttftMs,
        timestamp: Date.now(),
        level: job.explainLevel,
        focus: job.explainFocus
      });

      job.status = 'done';
      job.progressText = 'Completed successfully';
      job.resultId = resultId;
      job.route = aiResult.route;
      job.latencyMs = aiResult.latencyMs;
      job.ttftMs = aiResult.ttftMs;

      setJobs(prev => prev.map(j => j.id === job.id ? { ...job } : j));
      await persistJobState(job);

    } catch (err: any) {
      if ((job.status as string) === 'cancelled') return;
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : String(err);
      job.progressText = 'Failed: ' + job.error;
      setJobs(prev => prev.map(j => j.id === job.id ? { ...job } : j));
      await persistJobState(job);
    }
  };

  const cancelJob = async (jobId: string) => {
    const target = jobs.find(j => j.id === jobId);
    if (!target) return;
    target.status = 'cancelled';
    target.progressText = 'Cancelled by user';
    setJobs(prev => prev.map(j => j.id === jobId ? { ...target } : j));
    await persistJobState(target);
  };

  const retryJob = async (jobId: string) => {
    const target = jobs.find(j => j.id === jobId);
    if (!target) return;
    target.status = 'queued';
    target.error = undefined;
    target.progressText = 'Retrying...';
    setJobs(prev => prev.map(j => j.id === jobId ? { ...target } : j));
    await persistJobState(target);
  };

  const resumeJob = async (jobId: string) => {
    retryJob(jobId);
  };

  const removeJob = async (jobId: string) => {
    const user = auth.currentUser;
    if (user) {
      try {
        await deleteDoc(doc(db, `users/${user.uid}/jobs`, jobId));
      } catch (e) {
        console.warn("Failed to delete job doc:", e);
      }
    }
    setJobs(prev => prev.filter(j => j.id !== jobId));
  };

  return (
    <JobContext.Provider value={{ jobs, startJob, cancelJob, retryJob, resumeJob, removeJob }}>
      {children}
    </JobContext.Provider>
  );
};

export const useJobs = () => {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error("useJobs must be used within a JobProvider");
  }
  return context;
};
