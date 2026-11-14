import { 
  collection, 
  doc, 
  setDoc, 
  addDoc,
  deleteDoc,
  onSnapshot,
  writeBatch, 
  collectionGroup,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc
} from "firebase/firestore";
import { db } from "./firebaseService";
import { Material, Subject, AIInteraction, Page } from "../types";
import { saveMaterialPagesLocal, getMaterialPagesLocal, deleteMaterialPagesLocal } from "./mediaStorage";

const CHUNK_SIZE = 80 * 1024; // 80 KB chunks (well below Firestore 1MB document limit)

/**
 * Strips all undefined fields recursively so Firestore never throws
 * "Unsupported field value: undefined"
 */
function sanitizeForFirestore<T extends Record<string, any>>(obj: T): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item)).filter(item => item !== undefined);
  }
  const clean: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = (value && typeof value === 'object') ? sanitizeForFirestore(value) : value;
    }
  }
  return clean;
}

export async function saveMaterialWithChunks(
  uid: string, 
  material: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'status'>, 
  content: string,
  pages?: Page[]
): Promise<string> {
  const materialRef = doc(collection(db, `users/${uid}/materials`));
  const materialId = materialRef.id;

  const safeContent = content || '';
  const chunks: string[] = [];
  for (let i = 0; i < safeContent.length; i += CHUNK_SIZE) {
    chunks.push(safeContent.substring(i, i + CHUNK_SIZE));
  }
  if (chunks.length === 0) {
    chunks.push('');
  }

  // Save rich pages with images, charts, and diagrams locally in IndexedDB
  // (Ensures 100% offline access, zero Firestore 1MB limits, and fast rendering)
  if (pages && pages.length > 0) {
    await saveMaterialPagesLocal(materialId, pages);
  }

  const batch = writeBatch(db);
  
  // CRITICAL SANITIZATION:
  // Never save base64 images inside the Firestore document metadata!
  const { pages: _p, content: _c, ...safeMetadata } = material as any;

  const safeData = sanitizeForFirestore({
    ...safeMetadata,
    title: material.title || 'Untitled Material',
    subjectId: material.subjectId,
    status: (material as any).status || 'Ready',
    chunksCount: chunks.length,
    pageCount: pages?.length || 1,
    hasImages: pages?.some(p => !!p.image) || false,
    contentPreview: safeContent.slice(0, 300),
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  batch.set(materialRef, safeData);

  // Save Chunks into subcollection
  for (let i = 0; i < chunks.length; i++) {
    const chunkRef = doc(db, `users/${uid}/materials/${materialId}/chunks/${i}`);
    batch.set(chunkRef, { text: chunks[i] });
  }

  await batch.commit();
  return materialId;
}

export async function loadMaterialContent(uid: string, materialId: string): Promise<string> {
  try {
    const chunksCollection = collection(db, `users/${uid}/materials/${materialId}/chunks`);
    const querySnapshot = await getDocs(query(chunksCollection, orderBy("__name__")));
    
    if (querySnapshot.empty) {
      // Check if text is cached in IndexedDB
      const localPages = await getMaterialPagesLocal(materialId);
      if (localPages && localPages.length > 0) {
        return localPages.map(p => p.text).join('\n\n');
      }
      return "";
    }

    let content = "";
    querySnapshot.forEach((docSnap) => {
      content += docSnap.data().text;
    });
    return content;
  } catch (err) {
    console.error("Error loading material content:", err);
    // Fallback to local IndexedDB
    const localPages = await getMaterialPagesLocal(materialId);
    if (localPages) {
      return localPages.map(p => p.text).join('\n\n');
    }
    return "";
  }
}

export const subscribeSubjects = (uid: string, callback: (subjects: Subject[], hasPendingWrites: boolean, pendingCount: number) => void) => {
  const q = query(collection(db, `users/${uid}/subjects`), orderBy("name", "asc"));
  return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
    let docPendingCount = 0;
    const subjects = snapshot.docs.map(doc => {
      if (doc.metadata.hasPendingWrites) docPendingCount += 1;
      return { 
        id: doc.id, 
        ...doc.data(),
        hasPendingWrites: doc.metadata.hasPendingWrites || snapshot.metadata.hasPendingWrites 
      } as Subject;
    });
    const pendingCount = docPendingCount > 0 ? docPendingCount : (snapshot.metadata.hasPendingWrites ? 1 : 0);
    callback(subjects, snapshot.metadata.hasPendingWrites, pendingCount);
  });
};

export const addSubjectFirestore = async (uid: string, subject: Omit<Subject, 'id'>) => {
  const data = sanitizeForFirestore({
    ...subject,
    createdAt: Date.now()
  });
  return await addDoc(collection(db, `users/${uid}/subjects`), data);
};

export const updateSubjectFirestore = async (uid: string, subjectId: string, updates: Partial<Subject>) => {
  const ref = doc(db, `users/${uid}/subjects`, subjectId);
  return await setDoc(ref, sanitizeForFirestore(updates), { merge: true });
};

export const deleteSubjectFirestore = async (uid: string, subjectId: string) => {
  return await deleteDoc(doc(db, `users/${uid}/subjects`, subjectId));
};

export const deleteSubjectWithOptions = async (
  uid: string, 
  subjectId: string, 
  action: 'delete-materials' | 'move', 
  targetSubjectId?: string
) => {
  const materialsQuery = query(collection(db, `users/${uid}/materials`), where("subjectId", "==", subjectId));
  const snap = await getDocs(materialsQuery);

  if (action === 'delete-materials') {
    for (const matDoc of snap.docs) {
      await deleteMaterialFirestore(uid, matDoc.id);
    }
  } else if (action === 'move' && targetSubjectId) {
    const batch = writeBatch(db);
    snap.docs.forEach(matDoc => {
      batch.update(matDoc.ref, { subjectId: targetSubjectId, updatedAt: Date.now() });
    });
    await batch.commit();
  }

  // Finally delete the subject
  await deleteSubjectFirestore(uid, subjectId);
};

export const subscribeMaterials = (uid: string, callback: (materials: Material[], hasPendingWrites: boolean, pendingCount: number) => void) => {
  const q = query(collection(db, `users/${uid}/materials`), orderBy("createdAt", "desc"));
  return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
    let docPendingCount = 0;
    const materials = snapshot.docs.map(doc => {
      if (doc.metadata.hasPendingWrites) docPendingCount += 1;
      return { 
        id: doc.id, 
        ...doc.data(),
        hasPendingWrites: doc.metadata.hasPendingWrites || snapshot.metadata.hasPendingWrites
      } as Material;
    });
    const pendingCount = docPendingCount > 0 ? docPendingCount : (snapshot.metadata.hasPendingWrites ? 1 : 0);
    callback(materials, snapshot.metadata.hasPendingWrites, pendingCount);
  });
};

export const moveMaterialSubject = async (uid: string, materialId: string, newSubjectId: string) => {
  const ref = doc(db, `users/${uid}/materials`, materialId);
  return await setDoc(ref, { subjectId: newSubjectId, updatedAt: Date.now() }, { merge: true });
};

export const addMaterialFirestore = async (uid: string, material: Omit<Material, 'id'>) => {
  return await addDoc(collection(db, `users/${uid}/materials`), sanitizeForFirestore(material));
};

export const deleteMaterialFirestore = async (uid: string, materialId: string) => {
  // Clean up local IndexedDB pages
  try {
    await deleteMaterialPagesLocal(materialId);
  } catch (e) {
    console.warn("Could not delete local pages:", e);
  }
  // Delete subcollection chunks
  try {
    const chunksSnap = await getDocs(collection(db, `users/${uid}/materials/${materialId}/chunks`));
    const batch = writeBatch(db);
    chunksSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch (e) {
    console.warn("Could not delete chunks:", e);
  }
  return await deleteDoc(doc(db, `users/${uid}/materials`, materialId));
};

// Saved AI Results Collection (Summaries & Explanations)
export const subscribeResults = (uid: string, callback: (results: any[], hasPendingWrites: boolean, pendingCount: number) => void) => {
  const q = query(collection(db, `users/${uid}/results`), orderBy("timestamp", "desc"));
  return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
    let docPendingCount = 0;
    const results = snapshot.docs.map(doc => {
      if (doc.metadata.hasPendingWrites) docPendingCount += 1;
      return {
        id: doc.id,
        ...doc.data(),
        hasPendingWrites: doc.metadata.hasPendingWrites || snapshot.metadata.hasPendingWrites
      };
    });
    const pendingCount = docPendingCount > 0 ? docPendingCount : (snapshot.metadata.hasPendingWrites ? 1 : 0);
    callback(results, snapshot.metadata.hasPendingWrites, pendingCount);
  });
};

export const addResultFirestore = async (uid: string, result: any): Promise<string> => {
  const ref = await addDoc(collection(db, `users/${uid}/results`), sanitizeForFirestore(result));
  return ref.id;
};

export const getResultFirestore = async (uid: string, resultId: string): Promise<any | null> => {
  const snap = await getDocs(query(collection(db, `users/${uid}/results`), where("__name__", "==", resultId)));
  if (!snap.empty) {
    const docData = snap.docs[0];
    return {
      id: docData.id,
      ...docData.data(),
      hasPendingWrites: docData.metadata.hasPendingWrites
    };
  }
  return null;
};

export const updateResultFirestore = async (uid: string, resultId: string, updates: any) => {
  if (!uid || !resultId) return;
  return await updateDoc(doc(db, `users/${uid}/results`, resultId), sanitizeForFirestore(updates));
};

export const deleteResultFirestore = async (uid: string, resultId: string) => {
  if (!uid || !resultId) {
    throw new Error("Missing user ID or result ID to delete result.");
  }
  // Safely clear any local or session storage cached data tied to this result
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`result_${resultId}`);
      sessionStorage.removeItem(`result_cache_${resultId}`);
      localStorage.removeItem(`result_${resultId}`);
      localStorage.removeItem(`result_cache_${resultId}`);
    }
  } catch (e) {
    console.warn("Could not clear local cache for result:", e);
  }
  return await deleteDoc(doc(db, `users/${uid}/results`, resultId));
};

// Section summary caching for long materials
export const getCachedSection = async (uid: string, hash: string): Promise<string | null> => {
  try {
    const snap = await getDocs(query(collection(db, `users/${uid}/sectionCache`), where("__name__", "==", hash)));
    if (!snap.empty) {
      return snap.docs[0].data().summary || null;
    }
  } catch (e) {
    console.warn("Cache lookup error:", e);
  }
  return null;
};

export const setCachedSection = async (uid: string, hash: string, summary: string): Promise<void> => {
  try {
    const ref = doc(db, `users/${uid}/sectionCache`, hash);
    await setDoc(ref, sanitizeForFirestore({ summary, cachedAt: Date.now() }), { merge: true });
  } catch (e) {
    console.warn("Cache write error:", e);
  }
};

export const subscribeInteractions = (uid: string, callback: (interactions: AIInteraction[], hasPendingWrites: boolean, pendingCount: number) => void) => {
  const q = query(collection(db, `users/${uid}/interactions`), orderBy("timestamp", "asc"));
  return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
    let docPendingCount = 0;
    const interactions = snapshot.docs.map(doc => {
      if (doc.metadata.hasPendingWrites) docPendingCount += 1;
      return { 
        id: doc.id, 
        ...doc.data(),
        hasPendingWrites: doc.metadata.hasPendingWrites || snapshot.metadata.hasPendingWrites
      } as AIInteraction;
    });
    const pendingCount = docPendingCount > 0 ? docPendingCount : (snapshot.metadata.hasPendingWrites ? 1 : 0);
    callback(interactions, snapshot.metadata.hasPendingWrites, pendingCount);
  });
};

export const addInteractionFirestore = async (uid: string, interaction: Omit<AIInteraction, 'id'>) => {
  return await addDoc(collection(db, `users/${uid}/interactions`), sanitizeForFirestore(interaction));
};

export const clearInteractionsFirestore = async (uid: string) => {
  const q = query(collection(db, `users/${uid}/interactions`));
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
};

export const getPreferences = async (uid: string) => {
  try {
    const snap = await getDocs(query(collection(db, `users/${uid}/preferences`)));
    if (!snap.empty) {
      return snap.docs[0].data();
    }
  } catch (e) {
    console.warn("Error getting preferences:", e);
  }
  return {};
};

export const updatePreferences = async (uid: string, prefs: any) => {
  try {
    const prefDoc = doc(db, `users/${uid}/preferences/settings`);
    await setDoc(prefDoc, sanitizeForFirestore(prefs), { merge: true });
  } catch (e) {
    console.warn("Error updating preferences:", e);
  }
};

