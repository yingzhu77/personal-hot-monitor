/**
 * Community hot topics API endpoint.
 * Returns sentiment-analyzed community topics from Bilibili + NGA + Xiaoheihe.
 * Data is persisted in SQLite; fetched lazily with 30-min TTL.
 * On refresh failure, falls back to stale DB data.
 */

import { Router } from 'express';
import { hasRecentData, loadTopics, getLastFetchTime } from '../db/communityDb.js';
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
    console.error('[Community] Refresh failed, serving stale data:', err);
    isStale = true;
  }

  const { sentiment, category, source, page = '1', limit = '100' } = req.query;

  const filters = {
    sentiment: sentiment && sentiment !== 'all' && VALID_SENTIMENTS.has(String(sentiment)) ? String(sentiment) : undefined,
    category: category && category !== 'all' ? String(category) : undefined,
    source: source && source !== 'all' && VALID_SOURCES.has(String(source)) ? String(source) : undefined
  };

  // Load all matching topics (sorted by heatScore desc)
  const allFiltered = await loadTopics(filters);

  // Pagination
  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 100));
  const total = allFiltered.length;
  const start = (pageNum - 1) * limitNum;
  const paged = allFiltered.slice(start, start + limitNum);

  // Summary stats — computed from the same dataset the client sees
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
  let totalHeat = 0;
  for (const t of allFiltered) {
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
      avgHeat: allFiltered.length > 0 ? Math.round(totalHeat / allFiltered.length) : 0,
      totalTopics: allFiltered.length
    },
    lastUpdated: lastFetchTime > 0 ? new Date(lastFetchTime).toISOString() : null,
    stale: isStale || undefined
  });
}));

export default router;
