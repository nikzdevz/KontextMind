export interface TopQuestion {
  question: string;
  count: number;
  averageConfidence: number;
}

export interface DailyStats {
  date: string;
  totalQuestions: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  averageConfidence: number;
  averageResponseTimeMs: number;
  tierDistribution: Record<string, number>;
}

export interface WeeklyStats {
  startDate: string;
  endDate: string;
  totalQuestions: number;
  totalCacheHits: number;
  hitRateTrend: number;
  topQuestions: TopQuestion[];
  dailyBreakdown: DailyStats[];
}

export interface AnalyticsReport {
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  summary: {
    totalQuestions: number;
    totalCacheHits: number;
    overallHitRate: number;
    averageConfidence: number;
    averageResponseTimeMs: number;
  };
  trends: {
    hitRateTrend: number;
    volumeTrend: number;
  };
  topQuestions: TopQuestion[];
  tierBreakdown: Record<string, number>;
}