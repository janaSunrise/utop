/**
 * LRU Cache implementation for VTOP API responses.
 * Reduces load on VTOP by caching frequently accessed data.
 */

interface CacheEntry<T> {
  value: T;
  expiry: number;
  accessedAt: number;
}

interface CacheOptions {
  /** Max number of entries (default: 100) */
  maxSize?: number;
  /** Default TTL in milliseconds (default: 5 minutes) */
  defaultTTL?: number;
}

export class LRUCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private defaultTTL: number;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.defaultTTL = options.defaultTTL ?? 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiry
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Update access time for LRU
    entry.accessedAt = Date.now();
    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + (ttl ?? this.defaultTTL),
      accessedAt: Date.now(),
    });
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries matching a pattern
   */
  invalidatePattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.maxSize };
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Also clean up expired entries while we're here
      if (Date.now() > entry.expiry) {
        this.cache.delete(key);
        continue;
      }

      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

// Cache TTL presets (in milliseconds)
export const CacheTTL = {
  /** Very short-lived data (30 seconds) */
  SHORT: 30 * 1000,
  /** Standard cache (5 minutes) */
  MEDIUM: 5 * 60 * 1000,
  /** Long-lived data (30 minutes) */
  LONG: 30 * 60 * 1000,
  /** Very stable data (2 hours) */
  EXTENDED: 2 * 60 * 60 * 1000,
} as const;

// Global cache instances for different data types
export const vtopCache = {
  /** Profile data - stable, can cache longer */
  profile: new LRUCache({ maxSize: 50, defaultTTL: CacheTTL.LONG }),

  /** Attendance data - changes throughout the day */
  attendance: new LRUCache({ maxSize: 50, defaultTTL: CacheTTL.MEDIUM }),

  /** Timetable - very stable */
  timetable: new LRUCache({ maxSize: 50, defaultTTL: CacheTTL.EXTENDED }),

  /** Grades - changes rarely */
  grades: new LRUCache({ maxSize: 50, defaultTTL: CacheTTL.EXTENDED }),

  /** Marks - changes during exam periods */
  marks: new LRUCache({ maxSize: 50, defaultTTL: CacheTTL.MEDIUM }),

  /** Curriculum - very stable */
  curriculum: new LRUCache({ maxSize: 50, defaultTTL: CacheTTL.EXTENDED }),

  /** Semesters list - changes once per semester */
  semesters: new LRUCache({ maxSize: 10, defaultTTL: CacheTTL.EXTENDED }),
};

/**
 * Generate a cache key for user-specific data
 */
export function userCacheKey(registrationNumber: string, dataType: string, ...params: string[]): string {
  return `${registrationNumber}:${dataType}${params.length ? ':' + params.join(':') : ''}`;
}

/**
 * Clear all cached data for a user (e.g., on logout)
 */
export function clearUserCache(registrationNumber: string): void {
  const pattern = `^${registrationNumber}:`;
  vtopCache.profile.invalidatePattern(pattern);
  vtopCache.attendance.invalidatePattern(pattern);
  vtopCache.timetable.invalidatePattern(pattern);
  vtopCache.grades.invalidatePattern(pattern);
  vtopCache.marks.invalidatePattern(pattern);
  vtopCache.curriculum.invalidatePattern(pattern);
  vtopCache.semesters.invalidatePattern(pattern);
}

/**
 * Wrapper for cache-or-fetch pattern
 */
export async function cacheOrFetch<T>(
  cache: LRUCache<T>,
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cached = cache.get(key);
  if (cached !== null) {
    return cached;
  }

  const fresh = await fetcher();
  cache.set(key, fresh, ttl);
  return fresh;
}
