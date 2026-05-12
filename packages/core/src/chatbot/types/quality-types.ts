export type QualitySignal = 'helpful' | 'notHelpful' | 'reasked' | 'skipped';

export interface QualityScore {
  answerId: string;
  helpful: number;
  notHelpful: number;
  reasked: number;
  averageScore: number;
  lastUpdated: string;
}

export interface QualityConfig {
  minScoreThreshold: number;
  decayDays: number;
  signalsEnabled: boolean;
}

export const DEFAULT_QUALITY_CONFIG: QualityConfig = {
  minScoreThreshold: 0.6,
  decayDays: 30,
  signalsEnabled: true,
};

export interface QualityStats {
  totalRated: number;
  helpful: number;
  notHelpful: number;
  averageScore: number;
  topRated: Array<{ answerId: string; score: number }>;
  lastUpdated: string;
}