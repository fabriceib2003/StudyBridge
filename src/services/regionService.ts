import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebaseService';
import { RESTRICTED_DISTRICTS, FAIL_OPEN, RESTRICTION_CODE } from '../config/regionRestriction';
import restrictedData from '../data/restricted-districts.json';

export type RegionStatus = 'allowed' | 'restricted' | 'unknown';

export interface RegionState {
  status: RegionStatus;
  district?: string | null;
  checkedAt: string;
  errorCode?: string;
  errorMessage?: string;
  needsPermission?: boolean;
}

interface GeoPoint {
  lng: number;
  lat: number;
}

/**
 * Ray-casting algorithm to test whether a [lng, lat] point is inside a polygon ring
 */
function isPointInRing(point: [number, number], ring: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function isPointInPolygon(point: [number, number], rings: [number, number][][]): boolean {
  if (!rings || rings.length === 0) return false;
  // Must be inside the outer boundary (ring 0)
  if (!isPointInRing(point, rings[0])) return false;
  // Must not be inside any holes (rings 1..n)
  for (let i = 1; i < rings.length; i++) {
    if (isPointInRing(point, rings[i])) return false;
  }
  return true;
}

function isPointInMultiPolygon(point: [number, number], polygons: [number, number][][][]): boolean {
  for (const poly of polygons) {
    if (isPointInPolygon(point, poly)) return true;
  }
  return false;
}

/**
 * Checks if a given coordinate falls within any of the restricted districts.
 * Returns the matching district name if restricted, or null if allowed.
 */
export function checkCoordinatesInRestrictedDistricts(lng: number, lat: number): string | null {
  const point: [number, number] = [lng, lat];
  const features = (restrictedData as any).features || [];

  for (const feature of features) {
    const districtName = feature.properties?.district || feature.properties?.shapeName || feature.properties?.name;
    const geometry = feature.geometry;

    if (!geometry) continue;

    let isInside = false;
    if (geometry.type === 'Polygon') {
      isInside = isPointInPolygon(point, geometry.coordinates);
    } else if (geometry.type === 'MultiPolygon') {
      isInside = isPointInMultiPolygon(point, geometry.coordinates);
    }

    if (isInside) {
      // Check if it matches configured restricted districts (case-insensitive)
      const isRestricted = RESTRICTED_DISTRICTS.some(
        d => d.toLowerCase() === (districtName || '').toLowerCase()
      );
      if (isRestricted) {
        return districtName;
      }
    }
  }

  return null;
}

/**
 * Logs the check result to Firestore under users/{uid}/region
 * CRITICAL: NEVER store latitude or longitude.
 */
export async function logRegionCheckToFirestore(uid: string, result: {
  status: RegionStatus;
  district?: string | null;
  checkedAt: string;
}): Promise<void> {
  try {
    const payload = {
      status: result.status,
      district: result.district || null,
      checkedAt: result.checkedAt
    };
    // Save to users/{uid}/region document path
    await setDoc(doc(db, `users/${uid}/region/current`), payload, { merge: true });
    await setDoc(doc(db, `users/${uid}/region/status`), payload, { merge: true });
  } catch (error) {
    console.warn('Failed to log region check to Firestore:', error);
  }
}

/**
 * Checks if geolocation is allowed by container Permissions Policy
 */
export async function isGeolocationAvailable(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return false;
  }
  try {
    if (typeof document !== 'undefined' && 'permissionsPolicy' in document) {
      const pp = (document as any).permissionsPolicy;
      if (pp && typeof pp.allowsFeature === 'function' && !pp.allowsFeature('geolocation')) {
        return false;
      }
    }
    if (typeof document !== 'undefined' && 'featurePolicy' in document) {
      const fp = (document as any).featurePolicy;
      if (fp && typeof fp.allowsFeature === 'function' && !fp.allowsFeature('geolocation')) {
        return false;
      }
    }
  } catch {
    // Continue to standard check if policy query fails
  }
  return true;
}

/**
 * Performs geolocation check with low accuracy via navigator.geolocation.
 * Handles FAIL_OPEN logic and returns RegionState.
 */
export async function performRegionCheck(uid?: string): Promise<RegionState> {
  const checkedAt = new Date().toISOString();

  const isAvailable = await isGeolocationAvailable();
  if (!isAvailable || !navigator.geolocation) {
    const fallbackStatus: RegionStatus = FAIL_OPEN ? 'allowed' : 'unknown';
    const state: RegionState = {
      status: fallbackStatus,
      district: null,
      checkedAt,
      needsPermission: !FAIL_OPEN,
      errorMessage: 'Geolocation is unavailable or disabled by container permissions policy.'
    };
    if (uid) {
      await logRegionCheckToFirestore(uid, { status: state.status, district: null, checkedAt });
    }
    return state;
  }

  return new Promise<RegionState>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;

        // Perform point-in-polygon strictly on device, zero network calls
        const restrictedDistrict = checkCoordinatesInRestrictedDistricts(lng, lat);

        let state: RegionState;
        if (restrictedDistrict) {
          state = {
            status: 'restricted',
            district: restrictedDistrict,
            checkedAt,
            errorCode: RESTRICTION_CODE,
            errorMessage: `StudyBridge is currently restricted in ${RESTRICTED_DISTRICTS.join(', ')}.`
          };
        } else {
          state = {
            status: 'allowed',
            district: null,
            checkedAt
          };
        }

        // Log to Firestore without ever storing lat/long
        if (uid) {
          await logRegionCheckToFirestore(uid, {
            status: state.status,
            district: state.district,
            checkedAt
          });
        }

        resolve(state);
      },
      async (err) => {
        // Informative log that FAIL_OPEN is applied when location is unavailable
        console.info(`[RegionCheck] Location unavailable (${err.message}). FAIL_OPEN applied:`, FAIL_OPEN);

        let state: RegionState;
        if (FAIL_OPEN) {
          state = {
            status: 'allowed',
            district: null,
            checkedAt,
            errorMessage: err.message
          };
        } else {
          state = {
            status: 'unknown',
            district: null,
            checkedAt,
            needsPermission: true,
            errorMessage: 'Location access is required to verify region availability.'
          };
        }

        if (uid) {
          await logRegionCheckToFirestore(uid, {
            status: state.status,
            district: null,
            checkedAt
          });
        }

        resolve(state);
      },
      {
        enableHighAccuracy: false, // Low accuracy as requested
        timeout: 10000,
        maximumAge: 300000 // 5 minutes cache
      }
    );
  });
}
