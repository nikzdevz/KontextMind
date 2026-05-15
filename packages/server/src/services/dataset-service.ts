// Dataset Service - API layer for dataset operations
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  collectData,
  mergeToTrainingRecords,
  filterRecords,
  deduplicateRecords,
  createVersion,
  getVersionHistory,
  getLatestVersion,
  loadVersionRecords,
  computeStatistics,
} from '@kontextmind/core';
import { jsonl, chatml, sharegpt } from '@kontextmind/core';
import type {
  TrainingRecord,
  DatasetFilters,
  DatasetVersion,
  DatasetStatistics,
  DatasetFormat,
} from '@kontextmind/core';

const PROJECTS_DIR = process.env.DATA_DIR || '/kontextmind/projects';

export interface DatasetExportOptions {
  format?: DatasetFormat;
  minConfidence?: number;
  includeCodeRequests?: boolean;
  apiOnly?: boolean;
  since?: string;
  outputPath?: string;
}

export interface DatasetStats {
  totalRecords: number;
  filteredRecords: number;
  statistics: DatasetStatistics;
  latestVersion: string | null;
  versions: string[];
}

export class DatasetService {
  private getProjectDir(name: string): string {
    return join(PROJECTS_DIR, name);
  }

  // Collect and prepare dataset
  async prepareDataset(
    projectName: string,
    filters: DatasetFilters
  ): Promise<{ records: TrainingRecord[]; statistics: DatasetStatistics }> {
    const projectDir = this.getProjectDir(projectName);

    if (!existsSync(projectDir)) {
      throw new Error('Project not found');
    }

    // Collect data from all sources
    const data = collectData(projectDir, {
      sources: ['qna-events', 'feedback', 'qa-history', 'sessions'],
    });

    // Merge to training records
    const mergedRecords = mergeToTrainingRecords(data, filters);

    // Apply filters
    const filterResult = filterRecords(mergedRecords, filters);

    // Deduplicate
    const dedupResult = deduplicateRecords(filterResult.passed);

    // Compute statistics
    const statistics = computeStatistics(dedupResult.records);

    return {
      records: dedupResult.records,
      statistics,
    };
  }

  // Export dataset to file
  async exportDataset(
    projectName: string,
    options: DatasetExportOptions
  ): Promise<{ path: string; recordCount: number; version: string }> {
    const projectDir = this.getProjectDir(projectName);

    if (!existsSync(projectDir)) {
      throw new Error('Project not found');
    }

    // Default filters
    const filters: DatasetFilters = {
      minConfidence: options.minConfidence ?? 0.5,
      maxAgeDays: 90,
      includeCodeRequests: options.includeCodeRequests ?? false,
      apiOnly: options.apiOnly ?? false,
      minQualityScore: 0.6,
      since: options.since,
    };

    // Prepare dataset
    const { records, statistics } = await this.prepareDataset(projectName, filters);

    // Create version
    const versionData = createVersion(projectDir, records, {
      format: 'semver',
    });

    // Format output
    let content: string;
    const format = options.format || 'jsonl';

    switch (format) {
      case 'jsonl':
        content = jsonl.toJSONL(records);
        break;
      case 'json':
        content = JSON.stringify(records, null, 2);
        break;
      case 'chatml':
        content = chatml.toChatML(records);
        break;
      case 'sharegpt':
        content = sharegpt.toShareGPT(records);
        break;
      default:
        content = jsonl.toJSONL(records);
    }

    // Write to file
    const outputPath = options.outputPath || join(projectDir, '.kontextmind/dataset/current/training.jsonl');
    writeFileSync(outputPath, content, 'utf-8');

    return {
      path: outputPath,
      recordCount: records.length,
      version: versionData.version,
    };
  }

  // Get dataset statistics
  async getStats(projectName: string, version?: string): Promise<DatasetStats> {
    const projectDir = this.getProjectDir(projectName);

    if (!existsSync(projectDir)) {
      throw new Error('Project not found');
    }

    let records: TrainingRecord[] = [];
    const versions = getVersionHistory(projectDir);

    if (version) {
      // Get specific version
      records = loadVersionRecords(projectDir, version);
    } else {
      // Get latest version
      const latestVersion = getLatestVersion(projectDir);
      if (latestVersion) {
        records = loadVersionRecords(projectDir, latestVersion);
      }
    }

    const statistics = computeStatistics(records);

    return {
      totalRecords: records.length,
      filteredRecords: records.length,
      statistics,
      latestVersion: getLatestVersion(projectDir),
      versions: versions.map(v => v.version),
    };
  }

  // Get version history
  async getVersionHistory(projectName: string): Promise<{ versions: DatasetVersion[] }> {
    const projectDir = this.getProjectDir(projectName);

    if (!existsSync(projectDir)) {
      throw new Error('Project not found');
    }

    const versions = getVersionHistory(projectDir);
    return { versions };
  }

  // Compare versions
  async compareVersions(
    projectName: string,
    version1: string,
    version2: string
  ): Promise<{ added: number; removed: number; modified: number }> {
    const projectDir = this.getProjectDir(projectName);

    if (!existsSync(projectDir)) {
      throw new Error('Project not found');
    }

    const records1 = loadVersionRecords(projectDir, version1);
    const records2 = loadVersionRecords(projectDir, version2);

    const oldIds = new Set(records1.map(r => r.id));
    const newIds = new Set(records2.map(r => r.id));

    let added = 0;
    let removed = 0;

    for (const id of newIds) {
      if (!oldIds.has(id)) added++;
    }

    for (const id of oldIds) {
      if (!newIds.has(id)) removed++;
    }

    // Count modified
    let modified = 0;
    for (const newRecord of records2) {
      const oldRecord = records1.find(r => r.id === newRecord.id);
      if (oldRecord) {
        if (oldRecord.question !== newRecord.question || oldRecord.answer !== newRecord.answer) {
          modified++;
        }
      }
    }

    return { added, removed, modified };
  }

  // Validate dataset quality
  async validateDataset(projectName: string, minQuality: number = 0.6): Promise<{
    valid: boolean;
    issues: string[];
    statistics: DatasetStatistics;
  }> {
    const projectDir = this.getProjectDir(projectName);

    if (!existsSync(projectDir)) {
      throw new Error('Project not found');
    }

    const latestVersion = getLatestVersion(projectDir);
    if (!latestVersion) {
      return {
        valid: false,
        issues: ['No dataset version found'],
        statistics: {} as DatasetStatistics,
      };
    }

    const records = loadVersionRecords(projectDir, latestVersion);
    const statistics = computeStatistics(records);

    const issues: string[] = [];

    // Check record count
    if (records.length === 0) {
      issues.push('No records in dataset');
    }

    // Check average quality
    if (statistics.averageQuality < minQuality) {
      issues.push(`Average quality (${statistics.averageQuality.toFixed(2)}) below threshold (${minQuality})`);
    }

    // Check source distribution
    if (!statistics.bySource['api'] && !statistics.bySource['cli']) {
      issues.push('No API or CLI sourced records');
    }

    // Check code request ratio
    if (statistics.codeRequests > 0) {
      const ratio = statistics.codeRequestDislikes / statistics.codeRequests;
      if (ratio > 0.8) {
        issues.push('High ratio of disliked code requests - consider filtering');
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      statistics,
    };
  }
}

export const datasetService = new DatasetService();