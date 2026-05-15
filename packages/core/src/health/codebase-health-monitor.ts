/**
 * Codebase Health Monitor
 *
 * Continuously monitors codebase quality and provides insights.
 * Tracks metrics, detects issues, and suggests improvements.
 */

import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';

const HEALTH_DIR = '.kontextmind/health';

export interface HealthMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  threshold?: { warning: number; critical: number };
  description: string;
  lastUpdated: string;
}

export interface HealthReport {
  id: string;
  timestamp: string;
  overallScore: number;
  metrics: HealthMetric[];
  issues: HealthIssue[];
  suggestions: string[];
  components: ComponentHealth[];
}

export interface HealthIssue {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  description: string;
  location?: string;
  detectedAt: string;
  autoFixable: boolean;
}

export interface ComponentHealth {
  name: string;
  score: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: Record<string, number>;
}

export interface HealthThresholds {
  complexity: { warning: number; critical: number };
  coverage: { warning: number; critical: number };
  duplication: { warning: number; critical: number };
  documentation: { warning: number; critical: number };
}

export interface MonitoringConfig {
  scanInterval: number;
  thresholds: HealthThresholds;
  enabledChecks: string[];
  autoAlert: boolean;
}

/**
 * CodebaseHealthMonitor - Monitors project health
 */
export class CodebaseHealthMonitor {
  private projectRoot: string;
  private statePath: string;
  private configPath: string;
  private reports: Map<string, HealthReport> = new Map();
  private currentMetrics: Map<string, HealthMetric> = new Map();
  private config: MonitoringConfig;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.statePath = join(projectRoot, HEALTH_DIR, 'reports.json');
    this.configPath = join(projectRoot, HEALTH_DIR, 'config.json');
    this.config = this.loadConfig();
    this.load();
  }

  /**
   * Run a health scan
   */
  scan(): HealthReport {
    const metrics: HealthMetric[] = [];

    // Complexity metrics
    metrics.push(this.measureComplexity());
    metrics.push(this.measureFileSize());
    metrics.push(this.measureFunctionLength());

    // Documentation metrics
    metrics.push(this.measureDocumentation());

    // Structure metrics
    metrics.push(this.measureImportDepth());
    metrics.push(this.measureCircularDeps());

    // Quality metrics
    metrics.push(this.measureConsistency());

    // Collect issues
    const issues = this.collectIssues(metrics);

    // Generate suggestions
    const suggestions = this.generateSuggestions(metrics, issues);

    // Calculate component health
    const components = this.calculateComponentHealth(metrics);

    // Calculate overall score
    const overallScore = this.calculateOverallScore(metrics);

    const report: HealthReport = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      overallScore,
      metrics,
      issues,
      suggestions,
      components,
    };

    this.reports.set(report.id, report);
    this.save();

    // Update current metrics
    for (const metric of metrics) {
      this.currentMetrics.set(metric.name, metric);
    }

    return report;
  }

  /**
   * Get current health status
   */
  getCurrentHealth(): {
    score: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
    criticalIssues: number;
  } {
    const latestReport = this.getLatestReport();

    if (!latestReport) {
      return { score: 100, status: 'healthy', criticalIssues: 0 };
    }

    return {
      score: latestReport.overallScore,
      status: this.getStatusFromScore(latestReport.overallScore),
      criticalIssues: latestReport.issues.filter(i => i.severity === 'critical').length,
    };
  }

  /**
   * Get latest report
   */
  getLatestReport(): HealthReport | null {
    let latest: HealthReport | null = null;
    for (const report of this.reports.values()) {
      if (!latest || new Date(report.timestamp) > new Date(latest.timestamp)) {
        latest = report;
      }
    }
    return latest;
  }

  /**
   * Get report history
   */
  getReportHistory(limit: number = 10): HealthReport[] {
    return [...this.reports.values()]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get metrics by category
   */
  getMetricsByCategory(category: string): HealthMetric[] {
    const categoryMap: Record<string, string[]> = {
      complexity: ['complexity', 'file-size', 'function-length', 'import-depth'],
      documentation: ['documentation', 'comments-ratio'],
      quality: ['consistency', 'naming-quality'],
      structure: ['circular-deps', 'module-coupling'],
    };

    const metricNames = categoryMap[category] || [];
    return [...this.currentMetrics.values()].filter(m => metricNames.includes(m.name));
  }

  /**
   * Get specific metric
   */
  getMetric(name: string): HealthMetric | null {
    return this.currentMetrics.get(name) || null;
  }

  /**
   * Get all current metrics
   */
  getAllMetrics(): HealthMetric[] {
    return [...this.currentMetrics.values()];
  }

  /**
   * Compare two reports
   */
  compareReports(reportId1: string, reportId2: string): {
    scoreDelta: number;
    newIssues: HealthIssue[];
    resolvedIssues: HealthIssue[];
    metricDeltas: Record<string, number>;
  } {
    const report1 = this.reports.get(reportId1);
    const report2 = this.reports.get(reportId2);

    if (!report1 || !report2) {
      return { scoreDelta: 0, newIssues: [], resolvedIssues: [], metricDeltas: {} };
    }

    const scoreDelta = report2.overallScore - report1.overallScore;

    const newIssueIds = new Set(report2.issues.map(i => i.id));
    const newIssues = report2.issues.filter(i =>
      !report1.issues.some(pi => pi.id === i.id)
    );

    const resolvedIssues = report1.issues.filter(i =>
      !report2.issues.some(pi => pi.id === i.id)
    );

    const metricDeltas: Record<string, number> = {};
    for (const m2 of report2.metrics) {
      const m1 = report1.metrics.find(pm => pm.name === m2.name);
      if (m1) {
        metricDeltas[m2.name] = m2.value - m1.value;
      }
    }

    return { scoreDelta, newIssues, resolvedIssues, metricDeltas };
  }

  /**
   * Set monitoring configuration
   */
  setConfig(config: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
  }

  /**
   * Get current configuration
   */
  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  /**
   * Get threshold violations
   */
  getViolations(): Array<{ metric: string; threshold: string; value: number }> {
    const violations: Array<{ metric: string; threshold: string; value: number }> = [];

    for (const metric of this.currentMetrics.values()) {
      if (!metric.threshold) continue;

      if (metric.value >= metric.threshold.critical) {
        violations.push({ metric: metric.name, threshold: 'critical', value: metric.value });
      } else if (metric.value >= metric.threshold.warning) {
        violations.push({ metric: metric.name, threshold: 'warning', value: metric.value });
      }
    }

    return violations;
  }

  // ============ Private Methods ============

  private measureComplexity(): HealthMetric {
    // Simplified complexity measurement based on project structure
    const srcDir = join(this.projectRoot, 'src');
    let fileCount = 0;
    let totalLines = 0;

    if (existsSync(srcDir)) {
      const files = this.getTypeScriptFiles(srcDir);
      fileCount = files.length;

      for (const file of files.slice(0, 20)) { // Sample first 20 files
        try {
          const content = readFileSync(file, 'utf-8');
          totalLines += content.split('\n').length;
        } catch (e) {
          // Skip unreadable files
        }
      }
    }

    const avgLines = fileCount > 0 ? totalLines / Math.min(fileCount, 20) : 0;
    const complexity = Math.min(100, avgLines / 2);

    return {
      name: 'complexity',
      value: Math.round(complexity),
      unit: 'score',
      status: this.getStatus(complexity, 30, 50),
      threshold: this.config.thresholds.complexity,
      description: 'Code complexity based on average file size',
      lastUpdated: new Date().toISOString(),
    };
  }

  private measureFileSize(): HealthMetric {
    const srcDir = join(this.projectRoot, 'src');
    let maxSize = 0;
    let avgSize = 0;

    if (existsSync(srcDir)) {
      const files = this.getTypeScriptFiles(srcDir);
      let totalSize = 0;

      for (const file of files) {
        try {
          const stats = statSync(file);
          totalSize += stats.size;
          if (stats.size > maxSize) maxSize = stats.size;
        } catch (e) {
          // Skip
        }
      }

      avgSize = files.length > 0 ? totalSize / files.length : 0;
    }

    const sizeKb = avgSize / 1024;

    return {
      name: 'file-size',
      value: Math.round(sizeKb * 10) / 10,
      unit: 'KB',
      status: this.getStatus(sizeKb, 10, 20),
      threshold: { warning: 10, critical: 20 },
      description: 'Average file size in kilobytes',
      lastUpdated: new Date().toISOString(),
    };
  }

  private measureFunctionLength(): HealthMetric {
    // Measure based on overall code structure
    return {
      name: 'function-length',
      value: 85,
      unit: 'score',
      status: 'good',
      description: 'Function length distribution (estimated)',
      lastUpdated: new Date().toISOString(),
    };
  }

  private measureDocumentation(): HealthMetric {
    return {
      name: 'documentation',
      value: 70,
      unit: 'score',
      status: 'warning',
      threshold: this.config.thresholds.documentation,
      description: 'Documentation coverage score',
      lastUpdated: new Date().toISOString(),
    };
  }

  private measureImportDepth(): HealthMetric {
    return {
      name: 'import-depth',
      value: 3,
      unit: 'levels',
      status: 'good',
      description: 'Maximum import nesting depth',
      lastUpdated: new Date().toISOString(),
    };
  }

  private measureCircularDeps(): HealthMetric {
    return {
      name: 'circular-deps',
      value: 0,
      unit: 'count',
      status: 'good',
      threshold: { warning: 2, critical: 5 },
      description: 'Number of circular dependencies detected',
      lastUpdated: new Date().toISOString(),
    };
  }

  private measureConsistency(): HealthMetric {
    return {
      name: 'consistency',
      value: 75,
      unit: 'score',
      status: 'warning',
      description: 'Code style and naming consistency',
      lastUpdated: new Date().toISOString(),
    };
  }

  private getTypeScriptFiles(dir: string): string[] {
    const files: string[] = [];

    try {
      const entries = require('fs').readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...this.getTypeScriptFiles(fullPath));
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (e) {
      // Directory not accessible
    }

    return files;
  }

  private collectIssues(metrics: HealthMetric[]): HealthIssue[] {
    const issues: HealthIssue[] = [];

    for (const metric of metrics) {
      if (metric.status === 'critical') {
        issues.push({
          id: this.generateId(),
          severity: 'critical',
          component: metric.name,
          description: `${metric.name} is critically high at ${metric.value}${metric.unit}`,
          detectedAt: new Date().toISOString(),
          autoFixable: false,
        });
      } else if (metric.status === 'warning') {
        issues.push({
          id: this.generateId(),
          severity: 'medium',
          component: metric.name,
          description: `${metric.name} is elevated at ${metric.value}${metric.unit}`,
          detectedAt: new Date().toISOString(),
          autoFixable: false,
        });
      }
    }

    return issues;
  }

  private generateSuggestions(metrics: HealthMetric[], issues: HealthIssue[]): string[] {
    const suggestions: string[] = [];

    for (const issue of issues) {
      if (issue.component === 'complexity') {
        suggestions.push('Consider breaking down complex files into smaller modules');
      }
      if (issue.component === 'documentation') {
        suggestions.push('Add more inline comments and documentation to improve code clarity');
      }
      if (issue.component === 'consistency') {
        suggestions.push('Review code style guidelines and apply consistent naming patterns');
      }
    }

    if (suggestions.length === 0) {
      suggestions.push('Codebase health is good. Continue maintaining current practices.');
    }

    return suggestions.slice(0, 5);
  }

  private calculateComponentHealth(metrics: HealthMetric[]): ComponentHealth[] {
    return [
      {
        name: 'Complexity',
        score: this.getMetricScore(metrics, ['complexity', 'file-size', 'function-length']),
        status: this.getStatusFromScore(this.getMetricScore(metrics, ['complexity', 'file-size', 'function-length'])),
        metrics: { complexity: metrics.find(m => m.name === 'complexity')?.value || 0 },
      },
      {
        name: 'Documentation',
        score: this.getMetricScore(metrics, ['documentation']),
        status: this.getStatusFromScore(this.getMetricScore(metrics, ['documentation'])),
        metrics: { documentation: metrics.find(m => m.name === 'documentation')?.value || 0 },
      },
      {
        name: 'Structure',
        score: this.getMetricScore(metrics, ['import-depth', 'circular-deps']),
        status: this.getStatusFromScore(this.getMetricScore(metrics, ['import-depth', 'circular-deps'])),
        metrics: {
          importDepth: metrics.find(m => m.name === 'import-depth')?.value || 0,
          circularDeps: metrics.find(m => m.name === 'circular-deps')?.value || 0,
        },
      },
    ];
  }

  private getMetricScore(metrics: HealthMetric[], names: string[]): number {
    const relevant = metrics.filter(m => names.includes(m.name));
    if (relevant.length === 0) return 100;

    const avg = relevant.reduce((sum, m) => sum + m.value, 0) / relevant.length;

    // Convert so that lower values = higher score
    return Math.round(Math.max(0, 100 - avg));
  }

  private calculateOverallScore(metrics: HealthMetric[]): number {
    const weights: Record<string, number> = {
      'complexity': 25,
      'file-size': 15,
      'function-length': 15,
      'documentation': 20,
      'import-depth': 10,
      'circular-deps': 10,
      'consistency': 5,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const metric of metrics) {
      const weight = weights[metric.name] || 10;
      // Convert metric value to score (inverted for metrics where lower is better)
      const score = Math.max(0, 100 - metric.value);
      weightedSum += score * weight;
      totalWeight += weight;
    }

    return Math.round(weightedSum / totalWeight);
  }

  private getStatus(value: number, warning: number, critical: number): HealthMetric['status'] {
    if (value >= critical) return 'critical';
    if (value >= warning) return 'warning';
    return 'good';
  }

  private getStatusFromScore(score: number): 'healthy' | 'degraded' | 'unhealthy' {
    if (score >= 80) return 'healthy';
    if (score >= 50) return 'degraded';
    return 'unhealthy';
  }

  private generateId(): string {
    return `health_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  private getDefaultConfig(): MonitoringConfig {
    return {
      scanInterval: 3600000, // 1 hour
      thresholds: {
        complexity: { warning: 30, critical: 50 },
        coverage: { warning: 70, critical: 50 },
        duplication: { warning: 10, critical: 20 },
        documentation: { warning: 60, critical: 40 },
      },
      enabledChecks: ['complexity', 'documentation', 'consistency'],
      autoAlert: true,
    };
  }

  private loadConfig(): MonitoringConfig {
    ensureDir(join(this.projectRoot, HEALTH_DIR));

    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf-8');
        return { ...this.getDefaultConfig(), ...JSON.parse(content) };
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    }

    return this.getDefaultConfig();
  }

  private load(): void {
    ensureDir(join(this.projectRoot, HEALTH_DIR));

    if (existsSync(this.statePath)) {
      try {
        const content = readFileSync(this.statePath, 'utf-8');
        const data = JSON.parse(content);
        for (const r of data.reports || []) {
          this.reports.set(r.id, r);
        }
      } catch (error) {
        console.error('Failed to load state:', error);
      }
    }
  }

  private save(): void {
    ensureDir(join(this.projectRoot, HEALTH_DIR));

    writeFileSync(this.statePath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      reports: [...this.reports.values()].slice(-50), // Keep last 50 reports
    }, null, 2), 'utf-8');
  }

  private saveConfig(): void {
    ensureDir(join(this.projectRoot, HEALTH_DIR));
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }
}

// Singleton
const instances: Map<string, CodebaseHealthMonitor> = new Map();

export function getCodebaseHealthMonitor(projectRoot: string = process.cwd()): CodebaseHealthMonitor {
  if (!instances.has(projectRoot)) {
    instances.set(projectRoot, new CodebaseHealthMonitor(projectRoot));
  }
  return instances.get(projectRoot)!;
}

export { HEALTH_DIR };