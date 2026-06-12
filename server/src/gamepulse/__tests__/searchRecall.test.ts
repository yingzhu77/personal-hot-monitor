import { describe, test, expect, beforeEach, vi } from 'vitest';
import { searchFeedItems } from '../search.js';
import { prisma } from '../../db.js';

vi.mock('../../db.js', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn()
  }
}));

const mockPrisma = vi.mocked(prisma);

describe('searchFeedItems recall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockFtsExists() {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ name: 'FeedItemFTS' }]);
  }

  function mockFtsSearch(ids: string[], total: number) {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(
      ids.map(id => ({ feedItemId: id, rank: -1 }))
    );
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ total }]);
  }

  test('passes limit to FTS query', async () => {
    mockFtsExists();
    mockFtsSearch(['id-1', 'id-2'], 2);

    await searchFeedItems('test', { limit: 500 });

    // The LIMIT parameter in the FTS query should be 500
    const matchCall = mockPrisma.$queryRawUnsafe.mock.calls[1];
    expect(matchCall[2]).toBe(500);
  });

  test('uses default limit of 100 when not specified', async () => {
    mockFtsExists();
    mockFtsSearch(['id-1'], 1);

    await searchFeedItems('test');

    const matchCall = mockPrisma.$queryRawUnsafe.mock.calls[1];
    expect(matchCall[2]).toBe(100);
  });

  test('returns total from FTS count query', async () => {
    mockFtsExists();
    mockFtsSearch(['id-1', 'id-2', 'id-3'], 5000);

    const result = await searchFeedItems('popular query', { limit: 10000 });

    expect(result.feedItemIds).toEqual(['id-1', 'id-2', 'id-3']);
    expect(result.total).toBe(5000);
  });

  test('returns empty when FTS table does not exist', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

    const result = await searchFeedItems('test');

    expect(result.feedItemIds).toEqual([]);
    expect(result.total).toBe(0);
  });

  test('returns empty for empty query', async () => {
    const result = await searchFeedItems('');

    expect(result.feedItemIds).toEqual([]);
    expect(result.total).toBe(0);
  });

  test('handles FTS query error gracefully', async () => {
    mockFtsExists();
    mockPrisma.$queryRawUnsafe.mockRejectedValueOnce(new Error('FTS syntax error'));

    const result = await searchFeedItems('bad query!@#');

    expect(result.feedItemIds).toEqual([]);
    expect(result.total).toBe(0);
  });

  test('limit parameter affects result count but not total', async () => {
    mockFtsExists();
    // FTS has 5000 matches but limit is 100
    mockFtsSearch(Array.from({ length: 100 }, (_, i) => `id-${i}`), 5000);

    const result = await searchFeedItems('query', { limit: 100 });

    expect(result.feedItemIds.length).toBe(100);
    expect(result.total).toBe(5000);
  });
});
