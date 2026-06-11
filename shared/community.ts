/**
 * Shared types for community hot topics.
 * Source of truth for client. Server has a mirrored copy — keep in sync.
 * See server/src/gamepulse/adapters/community.ts
 */

export interface CommunityTopic {
  id: string;
  title: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number; // -1 to 1
  heatScore: number;
  category: string;
  source: string;
  trend: number[];
  summary: string;
  url: string;
  publishedAt: string;
}
