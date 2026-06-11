/**
 * Community hot topics API endpoint.
 * Returns sentiment-analyzed community topics from Bilibili + NGA + Xiaoheihe.
 * Data is persisted in SQLite; fetched lazily with 30-min TTL.
 * On refresh failure, falls back to stale DB data.
 */

import { Router } from 'express';
import { hasRecentData, loadTopics, loadAllTopics, getLastFetchTime } from '../db/communityDb.js';
import { refreshCommunityData } from '../services/communityService.js';
import { asyncHandler } from './asyncHandler.js';

const router = Router();

const VALID_SENTIMENTS = new Set(['positive', 'negative', 'neutral']);
const VALID_SOURCES = new Set(['bilibili', 'nga', 'xiaoheihe']);

router.get('/topics', asyncHandler(async (req, res) => {
  let isStale = false;

  try {
    const fresh = await hasRecentData();
    if (!fresh) {
      await refreshCommunityData();
    }
  } catch (err) {
    // Refresh failed — serve whatever is in the DB (stale is better than 500)
    console.error('[Community] Refresh failed, serving stale data:', err);
    isStale = true;
  }

  const { sentiment, category, source, page = '1', limit = '50' } = req.query;

  const filters = {
    sentiment: sentiment && sentiment !== 'all' && VALID_SENTIMENTS.has(String(sentiment)) ? String(sentiment) : undefined,
    category: category && category !== 'all' ? String(category) : undefined,
    source: source && source !== 'all' && VALID_SOURCES.has(String(source)) ? String(source) : undefined
  };

  const filtered = await loadTopics(filters);

  // Pagination
  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
  const total = filtered.length;
  const start = (pageNum - 1) * limitNum;
  const paged = filtered.slice(start, start + limitNum);

  // Summary stats (from full dataset)
  const allTopics = await loadAllTopics();
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
  let totalHeat = 0;
  for (const t of allTopics) {
    sentimentCounts[t.sentiment]++;
    totalHeat += t.heatScore;
  }

  const lastFetchTime = await getLastFetchTime();

  res.json({
    data: paged,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    },
    summary: {
      sentimentCounts,
      avgHeat: allTopics.length > 0 ? Math.round(totalHeat / allTopics.length) : 0,
      totalTopics: allTopics.length
    },
    lastUpdated: lastFetchTime > 0 ? new Date(lastFetchTime).toISOString() : null,
    stale: isStale || undefined
  });
}));

export default router;
