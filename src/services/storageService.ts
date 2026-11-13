import { Subject, Material, AIInteraction, RoutingMode } from '../types';

const STORAGE_KEYS = {
  SUBJECTS: 'studybridge_subjects_v2',
  MATERIALS: 'studybridge_materials_v2',
  INTERACTIONS: 'studybridge_interactions_v2',
  MANUAL_ROUTE: 'studybridge_manual_route_v2'
};

// --- Firestore Services (retained from previous step) ---
// Note: As per user request, we are now using Firestore exclusively.
// Keeping these to ensure the app continues to work if localStorage is still used
// for temporary caching until Firestore syncs.

export function getStoredSubjects(): Subject[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
    if (data) return JSON.parse(data);
  } catch (e) { console.error(e); }
  return [];
}

export function saveSubjects(subjects: Subject[]): void {
  localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
}

export function getStoredMaterials(): Material[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MATERIALS);
    if (data) return JSON.parse(data);
  } catch (e) { console.error(e); }
  return [];
}

export function saveMaterials(materials: Material[]): void {
  localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials));
}

export function getStoredInteractions(): AIInteraction[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.INTERACTIONS);
    if (data) return JSON.parse(data);
  } catch (e) { console.error(e); }
  return [];
}

export function saveInteractions(interactions: AIInteraction[]): void {
  localStorage.setItem(STORAGE_KEYS.INTERACTIONS, JSON.stringify(interactions));
}

export function clearStoredInteractions(): void {
  localStorage.removeItem(STORAGE_KEYS.INTERACTIONS);
}

export function getStoredManualRoute(): RoutingMode {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MANUAL_ROUTE);
    if (data) return JSON.parse(data);
  } catch (e) { console.error(e); }
  return 'auto';
}

export function saveManualRoute(mode: RoutingMode): void {
  localStorage.setItem(STORAGE_KEYS.MANUAL_ROUTE, JSON.stringify(mode));
}
