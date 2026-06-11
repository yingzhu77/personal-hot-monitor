import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ensureFTS5,
  rebuildFTS5,
  searchFeedItems,
  isFTS5Ready,
  dropFTS5
} from '../search.js';
import { prisma } from '../../db.js';

// Mock Prisma for unit tests
vi.mock('../../db.js', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn()
  }
}));

const mockPrisma = vi.mocked(prisma);

describe('FTS5 Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup
    vi.clearAllMocks();
  });

  describe('ensureFTS5', () => {
    it('should create FTS5 table if not exists', async () => {
      // Mock: table does not exist
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      // Mock: table creation succeeds
      mockPrisma.$executeRawUnsafe.mockResolvedValue(0);
      // Mock: rebuild succeeds
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      await ensureFTS5();

      // Should check if table exists
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('sqlite_master'),
        'FeedItemFTS'
      );

      // Should create virtual table
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('CREATE VIRTUAL TABLE')
      );

      // Should create triggers
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TRIGGER IF NOT EXISTS FeedItem_ai')
      );
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TRIGGER IF NOT EXISTS FeedItem_ad')
      );
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TRIGGER IF NOT EXISTS FeedItem_au')
      );
    });

    it('should skip creation if FTS5 already exists', async () => {
      // Mock: table exists
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ name: 'FeedItemFTS' }]);

      await ensureFTS5();

      // Should not create table
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalledWith(
        expect.stringContaining('CREATE VIRTUAL TABLE')
      );
    });
  });

  describe('searchFeedItems', () => {
    it('should return empty for empty query', async () => {
      const result = await searchFeedItems('');
      expect(result.feedItemIds).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should search and return matching feedItemIds', async () => {
      // Mock: FTS exists
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ name: 'FeedItemFTS' }]) // ftsExists
        .mockResolvedValueOnce([
          { feedItemId: 'id1', rank: -0.5 },
          { feedItemId: 'id2', rank: -0.3 }
        ]) // search results
        .mockResolvedValueOnce([{ total: 2 }]); // count

      const result = await searchFeedItems('原神', { limit: 10, offset: 0 });

      expect(result.feedItemIds).toEqual(['id1', 'id2']);
      expect(result.total).toBe(2);
    });

    it('should fallback gracefully on FTS query error', async () => {
      // Mock: FTS exists
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ name: 'FeedItemFTS' }]) // ftsExists
        .mockRejectedValueOnce(new Error('FTS syntax error')); // search fails

      const result = await searchFeedItems('invalid [query');

      expect(result.feedItemIds).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should return empty if FTS table does not exist', async () => {
      // Mock: FTS does not exist
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      const result = await searchFeedItems('test');

      expect(result.feedItemIds).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('isFTS5Ready', () => {
    it('should return true if FTS exists and has data', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ name: 'FeedItemFTS' }]) // ftsExists
        .mockResolvedValueOnce([{ cnt: 100 }]); // count

      const ready = await isFTS5Ready();
      expect(ready).toBe(true);
    });

    it('should return false if FTS does not exist', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      const ready = await isFTS5Ready();
      expect(ready).toBe(false);
    });

    it('should return false if FTS exists but is empty', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ name: 'FeedItemFTS' }])
        .mockResolvedValueOnce([{ cnt: 0 }]);

      const ready = await isFTS5Ready();
      expect(ready).toBe(false);
    });
  });

  describe('dropFTS5', () => {
    it('should drop triggers and table', async () => {
      mockPrisma.$executeRawUnsafe.mockResolvedValue(0);

      await dropFTS5();

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('DROP TRIGGER IF EXISTS FeedItem_ai')
      );
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('DROP TRIGGER IF EXISTS FeedItem_ad')
      );
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('DROP TRIGGER IF EXISTS FeedItem_au')
      );
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('DROP TABLE IF EXISTS FeedItemFTS')
      );
    });
  });
});
