import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Page } from '../types';

interface StudyBridgeDB extends DBSchema {
  materialPages: {
    key: string; // materialId
    value: {
      materialId: string;
      pages: Page[];
      updatedAt: number;
    };
  };
}

const DB_NAME = 'studybridge_media_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<StudyBridgeDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<StudyBridgeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('materialPages')) {
          db.createObjectStore('materialPages', { keyPath: 'materialId' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Save pages (with their images and text) locally in IndexedDB.
 * Completely immune to Firestore 1MB document limits and works offline.
 */
export async function saveMaterialPagesLocal(materialId: string, pages: Page[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('materialPages', {
      materialId,
      pages,
      updatedAt: Date.now()
    });
  } catch (err) {
    console.error('Failed to save material pages to IndexedDB:', err);
  }
}

/**
 * Retrieve pages (with images and text) locally from IndexedDB.
 */
export async function getMaterialPagesLocal(materialId: string): Promise<Page[] | null> {
  try {
    const db = await getDB();
    const entry = await db.get('materialPages', materialId);
    return entry ? entry.pages : null;
  } catch (err) {
    console.error('Failed to load material pages from IndexedDB:', err);
    return null;
  }
}

/**
 * Remove pages from local IndexedDB when material is deleted.
 */
export async function deleteMaterialPagesLocal(materialId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('materialPages', materialId);
  } catch (err) {
    console.error('Failed to delete material pages from IndexedDB:', err);
  }
}
