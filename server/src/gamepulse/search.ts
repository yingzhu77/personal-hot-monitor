import { prisma } from '../db.js';

const FTS_TABLE = 'FeedItemFTS';

/**
 * Check if FTS5 virtual table exists
 */
async function ftsExists(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    FTS_TABLE
  );
  return rows.length > 0;
}

/**
 * Create FTS5 virtual table and sync triggers
 * Uses feedItemId as the link back to FeedItem (UUID primary key)
 */
export async function ensureFTS5(): Promise<void> {
  if (await ftsExists()) return;

  await prisma.$executeRawUnsafe(`
    CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(
      feedItemId UNINDEXED,
      title,
      content,
      authorName,
      sourceName,
      tokenize='unicode61'
    )
  `);

  // Sync triggers
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS FeedItem_ai AFTER INSERT ON FeedItem BEGIN
      INSERT INTO ${FTS_TABLE}(feedItemId, title, content, authorName, sourceName)
      SELECT new.id, new.title, new.content, new.authorName, s.name
      FROM Source s WHERE s.id = new.sourceId;
    END
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS FeedItem_ad AFTER DELETE ON FeedItem BEGIN
      INSERT INTO ${FTS_TABLE}(${FTS_TABLE}, feedItemId, title, content, authorName, sourceName)
      VALUES('delete', old.id, old.title, old.content, old.authorName, '');
    END
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS FeedItem_au AFTER UPDATE ON FeedItem BEGIN
      INSERT INTO ${FTS_TABLE}(${FTS_TABLE}, feedItemId, title, content, authorName, sourceName)
      VALUES('delete', old.id, old.title, old.content, old.authorName, '');
      INSERT INTO ${FTS_TABLE}(feedItemId, title, content, authorName, sourceName)
      SELECT new.id, new.title, new.content, new.authorName, s.name
      FROM Source s WHERE s.id = new.sourceId;
    END
  `);

  // Initial population
  await rebuildFTS5();
}

/**
 * Rebuild FTS5 index from scratch
 */
export async function rebuildFTS5(): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM ${FTS_TABLE}`);
  await prisma.$executeRawUnsafe(`
    INSERT INTO ${FTS_TABLE}(feedItemId, title, content, authorName, sourceName)
    SELECT f.id, f.title, f.content, f.authorName, s.name
    FROM FeedItem f
    JOIN Source s ON s.id = f.sourceId
  `);
}

/**
 * Escape FTS5 special characters for safe querying
 */
function escapeFTS5(query: string): string {
  return query
    .replace(/[""]/g, '""')
    .trim();
}

/**
 * Search feed items using FTS5
 * Returns matching feedItemIds ranked by relevance
 */
export async function searchFeedItems(
  query: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ feedItemIds: string[]; total: number }> {
  const { limit = 100, offset = 0 } = options;
  const safeQuery = escapeFTS5(query);

  if (!safeQuery) {
    return { feedItemIds: [], total: 0 };
  }

  if (!(await ftsExists())) {
    return { feedItemIds: [], total: 0 };
  }

  try {
    const results = await prisma.$queryRawUnsafe<Array<{ feedItemId: string; rank: number }>>(
      `SELECT feedItemId, rank FROM ${FTS_TABLE} WHERE ${FTS_TABLE} MATCH ? ORDER BY rank LIMIT ? OFFSET ?`,
      safeQuery,
      limit,
      offset
    );

    const countResult = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COUNT(*) as total FROM ${FTS_TABLE} WHERE ${FTS_TABLE} MATCH ?`,
      safeQuery
    );

    return {
      feedItemIds: results.map(r => r.feedItemId),
      total: Number(countResult[0]?.total || 0)
    };
  } catch (error) {
    console.warn('FTS5 search failed, falling back:', error);
    return { feedItemIds: [], total: 0 };
  }
}

/**
 * Check if FTS5 is available and populated
 */
export async function isFTS5Ready(): Promise<boolean> {
  if (!(await ftsExists())) return false;
  const count = await prisma.$queryRawUnsafe<Array<{ cnt: number }>>(
    `SELECT COUNT(*) as cnt FROM ${FTS_TABLE}`
  );
  return Number(count[0]?.cnt || 0) > 0;
}

/**
 * Drop FTS5 table and triggers (for rollback)
 */
export async function dropFTS5(): Promise<void> {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS FeedItem_ai`);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS FeedItem_ad`);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS FeedItem_au`);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${FTS_TABLE}`);
}
