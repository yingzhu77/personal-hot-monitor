import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { aggregateFeedItemsToStories } from '../storyAggregation.js';
import { normalizeImportance } from '../storyAggregation.js';
import { generateMarkdownReport, type ReportMeta } from '../reports/markdownExport.js';
import { validateOrThrow } from '../validation.js';
import type { PrismaWhereClause } from '../types.js';
import {
  toArray,
  appendAnd,
  applyAnalysisFilters,
  applyLowValueNoticeFilter
} from './helpers.js';

const router = Router();

const ReportQuerySchema = z.object({
  type: z.enum(['daily', 'weekly']).default('daily'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekStart must be YYYY-MM-DD').optional(),
  game: z.string().optional(),
  category: z.string().optional(),
  importance: z.string().optional(),
  visibility: z.string().optional()
});

type ReportQuery = z.infer<typeof ReportQuerySchema>;

function parseDate(dateStr?: string): Date {
  if (dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

function getDateRange(type: string, dateStr?: string, weekStartStr?: string): { start: Date; end: Date } {
  const now = new Date();

  if (type === 'weekly') {
    let start: Date;
    if (weekStartStr) {
      start = parseDate(weekStartStr);
    } else {
      // Default: last 7 days
      start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    }
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // Daily
  const target = parseDate(dateStr);
  const start = new Date(target);
  start.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function fetchStoriesForReport(query: ReportQuery) {
  const { type, date, weekStart, game, category, importance, visibility } = query;
  const { start, end } = getDateRange(type, date, weekStart);

  const where: PrismaWhereClause = {
    hidden: false,
    createdAt: { gte: start, lte: end }
  };

  if (game) where.game = game;

  const catFilter = category || undefined;
  applyAnalysisFilters(where, { category: catFilter, importance: undefined, visibility });
  applyLowValueNoticeFilter(where, visibility);

  const items = await prisma.feedItem.findMany({
    where,
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 1000,
    include: {
      source: {
        select: {
          id: true,
          name: true,
          type: true,
          game: true,
          isOfficial: true,
          followed: true,
          healthStatus: true
        }
      },
      analysis: true
    }
  });

  let stories = aggregateFeedItemsToStories(items);

  // Apply importance filter
  if (importance) {
    const impSet = new Set(importance.split(',').map(v => normalizeImportance(v)));
    stories = stories.filter(s => impSet.has(s.importance));
  }

  return { stories, dateRange: { start, end } };
}

/**
 * GET /reports/daily - 获取日报 JSON 数据
 */
router.get('/daily', async (req, res) => {
  try {
    const query = validateOrThrow(ReportQuerySchema, { ...req.query, type: 'daily' }, 'daily report');
    const { stories, dateRange } = await fetchStoriesForReport(query);

    const meta: ReportMeta = {
      type: 'daily',
      dateRange,
      game: query.game,
      category: query.category,
      importance: query.importance
    };

    res.json({
      meta,
      stories,
      summary: {
        total: stories.length,
        high: stories.filter(s => s.importance === 'high').length,
        medium: stories.filter(s => s.importance === 'medium').length,
        low: stories.filter(s => s.importance === 'low').length,
        games: [...new Set(stories.map(s => s.game))],
        categories: [...new Set(stories.map(s => s.category).filter(Boolean))]
      }
    });
  } catch (error) {
    console.error('Daily report failed:', error);
    if (error instanceof Error && error.message.startsWith('Validation failed')) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to generate daily report' });
  }
});

/**
 * GET /reports/weekly - 获取周报 JSON 数据
 */
router.get('/weekly', async (req, res) => {
  try {
    const query = validateOrThrow(ReportQuerySchema, { ...req.query, type: 'weekly' }, 'weekly report');
    const { stories, dateRange } = await fetchStoriesForReport(query);

    const meta: ReportMeta = {
      type: 'weekly',
      dateRange,
      game: query.game,
      category: query.category,
      importance: query.importance
    };

    res.json({
      meta,
      stories,
      summary: {
        total: stories.length,
        high: stories.filter(s => s.importance === 'high').length,
        medium: stories.filter(s => s.importance === 'medium').length,
        low: stories.filter(s => s.importance === 'low').length,
        games: [...new Set(stories.map(s => s.game))],
        categories: [...new Set(stories.map(s => s.category).filter(Boolean))]
      }
    });
  } catch (error) {
    console.error('Weekly report failed:', error);
    if (error instanceof Error && error.message.startsWith('Validation failed')) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to generate weekly report' });
  }
});

/**
 * GET /reports/export - 导出 Markdown 报告
 */
router.get('/export', async (req, res) => {
  try {
    const query = validateOrThrow(ReportQuerySchema, req.query, 'report export');
    const { stories, dateRange } = await fetchStoriesForReport(query);

    const meta: ReportMeta = {
      type: query.type,
      dateRange,
      game: query.game,
      category: query.category,
      importance: query.importance
    };

    const markdown = generateMarkdownReport(stories, meta);
    const typeLabel = query.type === 'daily' ? '日报' : '周报';
    const dateLabel = query.type === 'daily'
      ? (query.date || new Date().toISOString().slice(0, 10))
      : `week-${query.weekStart || 'latest'}`;
    const filename = `acg-pulse-${query.type}-${dateLabel}.md`;

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(markdown);
  } catch (error) {
    console.error('Report export failed:', error);
    if (error instanceof Error && error.message.startsWith('Validation failed')) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to export report' });
  }
});

export default router;
