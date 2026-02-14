import { mockData } from '@/data/mockData';

/**
 * Normalize a phone number by stripping all non-digit characters except leading +.
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
}

/**
 * Validate phone number format: must have at least 8 digits, optionally starting with +.
 */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^\+?\d{8,15}$/.test(normalized);
}

/**
 * Check if a phone number already exists in orders.
 */
export function findDuplicatePhoneInOrders(phone: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const match = mockData.orders.find(o => normalizePhone(o.customerPhone) === normalized);
  return match ? match.id : null;
}

/**
 * Check for duplicate phones within a list of entries.
 * Returns a Set of indices that are duplicates (keeps first occurrence).
 */
export function findDuplicatePhoneIndices(phones: string[]): Set<number> {
  const seen = new Map<string, number>();
  const dupes = new Set<number>();
  phones.forEach((phone, i) => {
    const norm = normalizePhone(phone);
    if (!norm) return;
    if (seen.has(norm)) {
      dupes.add(i);
    } else {
      seen.set(norm, i);
    }
  });
  return dupes;
}

/**
 * Check if a phone exists in any prediction list entry.
 */
export function findDuplicatePhoneInPredictions(phone: string, excludeListId?: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  for (const list of mockData.predictionLists) {
    if (list.id === excludeListId) continue;
    const match = list.entries.find(e => normalizePhone(e.telephone) === normalized);
    if (match) return list.name;
  }
  return null;
}

/**
 * Validate that required fields are not empty.
 */
export function hasEmptyRequiredFields(row: { name: string; telephone: string }): boolean {
  return !row.name.trim() || !row.telephone.trim();
}
