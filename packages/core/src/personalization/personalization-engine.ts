/**
 * Personalization Engine
 *
 * Learns user preferences and adapts accordingly.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';

const PERSONAL_DIR = '.kontextmind/personal';

export interface PreferenceSet {
  codingStyle: string;
  communicationStyle: 'terse' | 'detailed' | 'mixed';
  explanationLevel: 'minimal' | 'standard' | 'comprehensive';
  riskTolerance: 'safe' | 'balanced' | 'aggressive';
  preferredPatterns: string[];
  antiPatterns: string[];
  timePreference: 'speed' | 'quality' | 'balanced';
  feedbackStyle: 'direct' | 'gentle' | 'analytical';
}

export interface PreferenceHistory {
  key: string;
  value: any;
  confidence: number;
  evidence: string[];
  lastUpdated: string;
  changeCount: number;
}

export interface UserProfile {
  preferences: PreferenceSet;
  history: Map<string, PreferenceHistory>;
  sessionCount: number;
  firstSeen: string;
  lastSeen: string;
}

export interface Adaptation {
  trigger: string;
  previousValue: any;
  newValue: any;
  reason: string;
  timestamp: string;
}

/**
 * PersonalizationEngine - Learns and adapts to user preferences
 */
export class PersonalizationEngine {
  private profile: UserProfile;
  private adaptations: Adaptation[] = [];
  private projectRoot: string;
  private profilePath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.profilePath = join(projectRoot, PERSONAL_DIR, 'profile.json');
    this.profile = this.createDefaultProfile();
    this.load();
  }

  /**
   * Track a preference
   */
  track(key: string, value: any, evidence?: string): void {
    const existing = this.profile.history.get(key);

    if (existing) {
      // Check if value changed
      if (existing.value !== value) {
        // Record adaptation
        this.adaptations.push({
          trigger: key,
          previousValue: existing.value,
          newValue: value,
          reason: `Detected change from ${existing.value} to ${value}`,
          timestamp: new Date().toISOString(),
        });
        existing.changeCount++;
      }

      existing.value = value;
      existing.lastUpdated = new Date().toISOString();
      existing.confidence = Math.min(1, existing.confidence + 0.1);

      if (evidence) {
        existing.evidence.push(evidence);
        if (existing.evidence.length > 10) {
          existing.evidence = existing.evidence.slice(-10);
        }
      }
    } else {
      this.profile.history.set(key, {
        key,
        value,
        confidence: 0.3,
        evidence: evidence ? [evidence] : [],
        lastUpdated: new Date().toISOString(),
        changeCount: 0,
      });
    }

    // Update core preferences
    this.updateCorePreferences();
    this.save();
  }

  /**
   * Get preferences for context
   */
  getPreferences(context?: { taskType?: string; action?: string }): PreferenceSet {
    // Return learned preferences
    return { ...this.profile.preferences };
  }

  /**
   * Detect preference changes
   */
  detectChange(key: string, newValue: any): boolean {
    const history = this.profile.history.get(key);
    if (!history) return false;
    return history.value !== newValue;
  }

  /**
   * Adapt to preference changes
   */
  adapt(change: PreferenceChange): void {
    // Apply change and update confidence
    this.track(change.key, change.value, change.reason);

    // Update core preferences
    this.updateCorePreferences();
  }

  /**
   * Get preference history
   */
  getHistory(key?: string): PreferenceHistory | PreferenceHistory[] {
    if (key) {
      return this.profile.history.get(key) || this.createDefaultHistory(key);
    }
    return [...this.profile.history.values()];
  }

  /**
   * Get recent adaptations
   */
  getRecentAdaptations(limit: number = 10): Adaptation[] {
    return this.adaptations
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get user profile summary
   */
  getProfileSummary(): {
    sessionCount: number;
    preferencesLearned: number;
    adaptationsApplied: number;
    topPreferences: Array<{ key: string; confidence: number }>;
    firstSeen: string;
    lastSeen: string;
  } {
    const topPreferences = [...this.profile.history.entries()]
      .map(([key, hist]) => ({ key, confidence: hist.confidence }))
      .filter(p => p.confidence > 0.3)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    return {
      sessionCount: this.profile.sessionCount,
      preferencesLearned: this.profile.history.size,
      adaptationsApplied: this.adaptations.length,
      topPreferences,
      firstSeen: this.profile.firstSeen,
      lastSeen: this.profile.lastSeen,
    };
  }

  /**
   * Increment session count
   */
  incrementSession(): void {
    this.profile.sessionCount++;
    this.profile.lastSeen = new Date().toISOString();
    this.save();
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.profile = this.createDefaultProfile();
    this.adaptations = [];
    this.save();
  }

  // ============ Private Methods ============

  private createDefaultProfile(): UserProfile {
    return {
      preferences: {
        codingStyle: 'standard',
        communicationStyle: 'mixed',
        explanationLevel: 'standard',
        riskTolerance: 'balanced',
        preferredPatterns: [],
        antiPatterns: [],
        timePreference: 'balanced',
        feedbackStyle: 'direct',
      },
      history: new Map(),
      sessionCount: 0,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };
  }

  private createDefaultHistory(key: string): PreferenceHistory {
    return {
      key,
      value: null,
      confidence: 0,
      evidence: [],
      lastUpdated: '',
      changeCount: 0,
    };
  }

  private updateCorePreferences(): void {
    const history = this.profile.history;

    // Communication style
    const explanationHistory = history.get('explanation');
    if (explanationHistory && explanationHistory.confidence > 0.5) {
      this.profile.preferences.explanationLevel = explanationHistory.value as any;
    }

    // Code style
    const styleHistory = history.get('codingStyle');
    if (styleHistory && styleHistory.confidence > 0.5) {
      this.profile.preferences.codingStyle = styleHistory.value as string;
    }

    // Risk tolerance
    const riskHistory = history.get('riskTolerance');
    if (riskHistory && riskHistory.confidence > 0.5) {
      this.profile.preferences.riskTolerance = riskHistory.value as any;
    }

    // Time preference
    const timeHistory = history.get('timePreference');
    if (timeHistory && timeHistory.confidence > 0.5) {
      this.profile.preferences.timePreference = timeHistory.value as any;
    }
  }

  private load(): void {
    ensureDir(join(this.projectRoot, PERSONAL_DIR));

    if (existsSync(this.profilePath)) {
      try {
        const content = readFileSync(this.profilePath, 'utf-8');
        const data = JSON.parse(content);
        this.profile = {
          ...this.createDefaultProfile(),
          ...data,
          history: new Map(data.history || []),
        };
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    }
  }

  private save(): void {
    ensureDir(join(this.projectRoot, PERSONAL_DIR));

    const data = {
      ...this.profile,
      history: [...this.profile.history.entries()],
      adaptations: this.adaptations.slice(-50), // Keep last 50
    };

    writeFileSync(this.profilePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

export interface PreferenceChange {
  key: string;
  value: any;
  reason: string;
}

// Singleton
const instances: Map<string, PersonalizationEngine> = new Map();

export function getPersonalizationEngine(
  projectRoot: string = process.cwd()
): PersonalizationEngine {
  if (!instances.has(projectRoot)) {
    instances.set(projectRoot, new PersonalizationEngine(projectRoot));
  }
  return instances.get(projectRoot)!;
}

export { PERSONAL_DIR };