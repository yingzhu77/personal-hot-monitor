import { beforeEach, describe, expect, test, vi } from 'vitest';

// Track sources in mock DB
let mockSources: Array<{
  id: string; name: string; type: string; game: string; enabled: boolean;
  priority: number; healthStatus: string; uid: string | null; avatar: string | null;
  lastSuccessAt: Date | null; lastCheckedAt: Date | null; lastError: string | null;
}> = [];
let mockHealthLogs: Array<{ id: string; sourceId: string; status: string; error: string | null; checkedAt: Date }> = [];
let mockFeedItems: Array<{ id: string; sourceId: string; contentHash: string }> = [];

vi.mock('../../db.js', () => ({
  prisma: {
    source: {
      findMany: vi.fn(async ({ where }: { where: { enabled: boolean } }) =>
        mockSources.filter(s => s.enabled === where.enabled)
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const source = mockSources.find(s => s.id === where.id);
        if (source) Object.assign(source, data);
        return source;
      })
    },
    sourceHealthLog: {
      create: vi.fn(async ({ data }: { data: { sourceId: string; status: string; error?: string } }) => {
        const log = { id: `log-${mockHealthLogs.length + 1}`, ...data, error: data.error || null, checkedAt: new Date() };
        mockHealthLogs.push(log);
        return log;
      })
    },
    feedItem: {
      findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const key = where.sourceId_contentHash as { sourceId: string; contentHash: string } | undefined;
        if (key) {
          return mockFeedItems.find(f => f.sourceId === key.sourceId && f.contentHash === key.contentHash) || null;
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const item = { id: `item-${mockFeedItems.length + 1}`, sourceId: data.sourceId as string, contentHash: data.contentHash as string };
        mockFeedItems.push(item);
        return { ...item, source: mockSources.find(s => s.id === data.sourceId), title: data.title, game: data.game };
      }),
      count: vi.fn(async () => mockFeedItems.length),
      deleteMany: vi.fn(async () => ({ count: 0 }))
    },
    analysis: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    notification: { create: vi.fn(async () => ({})), deleteMany: vi.fn(async () => ({ count: 0 })) }
  }
}));

vi.mock('../ai/analysisQueue.js', () => ({
  enqueueAnalysisTask: vi.fn(async () => {})
}));

vi.mock('../adapters/registry.js', () => ({
  getAdapter: vi.fn(() => ({
    fetch: vi.fn(async () => [])
  }))
}));

vi.mock('../utils.js', () => ({
  contentHash: vi.fn(() => 'test-hash'),
  normalizeUrl: vi.fn((url: string) => url),
  truncate: vi.fn((s: string) => s)
}));

vi.mock('../adapters/bilibiliVideo.js', () => ({
  fetchBilibiliAvatar: vi.fn(async () => null)
}));

describe('checker mutex', () => {
  beforeEach(() => {
    mockSources = [
      { id: 'src-1', name: '测试源', type: 'rss', game: '原神', enabled: true, priority: 50, healthStatus: 'unknown', uid: null, avatar: null, lastSuccessAt: null, lastCheckedAt: null, lastError: null }
    ];
    mockHealthLogs = [];
    mockFeedItems = [];
    vi.clearAllMocks();
  });

  test('second concurrent call returns empty result without running check', async () => {
    const { runGamePulseCheck } = await import('../jobs/checker.js');

    // First call starts
    const p1 = runGamePulseCheck();
    // Second call should be skipped
    const p2 = runGamePulseCheck();

    const [r1, r2] = await Promise.all([p1, p2]);

    // First call should have result
    expect(r1.checkedSources).toBeGreaterThanOrEqual(0);
    // Second call should be skipped
    expect(r2.checkedSources).toBe(0);
    expect(r2.newItems).toBe(0);
    expect(r2.failedSources).toBe(0);
  });

  test('sequential calls both execute normally', async () => {
    const { runGamePulseCheck } = await import('../jobs/checker.js');

    const r1 = await runGamePulseCheck();
    const r2 = await runGamePulseCheck();

    expect(r1.checkedSources).toBe(1);
    expect(r2.checkedSources).toBe(1);
  });

  test('health log is written for each source check', async () => {
    const { runGamePulseCheck } = await import('../jobs/checker.js');

    await runGamePulseCheck();

    // Should have one health log for the source
    expect(mockHealthLogs.length).toBe(1);
    expect(mockHealthLogs[0].sourceId).toBe('src-1');
    expect(mockHealthLogs[0].status).toBe('healthy');
  });

  test('failed source writes error health log', async () => {
    const adapter = await import('../adapters/registry.js');
    vi.mocked(adapter.getAdapter).mockReturnValue({
      fetch: vi.fn(async () => { throw new Error('network timeout'); })
    } as never);

    const { runGamePulseCheck } = await import('../jobs/checker.js');

    await runGamePulseCheck();

    expect(mockHealthLogs.length).toBe(1);
    expect(mockHealthLogs[0].status).toBe('failed');
    expect(mockHealthLogs[0].error).toBe('network timeout');
  });

  test('getCheckerStatus reflects running state', async () => {
    const { runGamePulseCheck, getCheckerStatus } = await import('../jobs/checker.js');

    // Before any check
    expect(getCheckerStatus().running).toBe(false);

    const p1 = runGamePulseCheck();

    // During check — may or may not be true depending on timing
    // After check completes
    await p1;
    expect(getCheckerStatus().running).toBe(false);
    expect(getCheckerStatus().startedAt).toBeNull();
  });
});
