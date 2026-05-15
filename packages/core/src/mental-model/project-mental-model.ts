/**
 * Project Mental Model
 *
 * Maintains a structured understanding of the codebase architecture.
 * Tracks entities, relationships, and their properties.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../filesystem/ensure-dir.js';

const MENTAL_MODEL_DIR = '.kontextmind/mental-model';

export interface Entity {
  id: string;
  name: string;
  type: 'file' | 'function' | 'class' | 'interface' | 'module' | 'variable' | 'constant' | 'type' | 'enum' | 'event';
  filePath: string;
  lineNumber?: number;
  description: string;
  properties: Record<string, any>;
  relationships: EntityRelationship[];
  importance: number;
  lastSeen: string;
  confidence: number;
}

export interface EntityRelationship {
  targetId: string;
  type: 'imports' | 'exports' | 'extends' | 'implements' | 'calls' | 'references' | 'creates' | 'contains' | 'typeOf';
  strength: number;
}

export interface ArchitectureLayer {
  name: string;
  entities: string[];
  description: string;
  responsibilities: string[];
}

export interface MentalModel {
  projectRoot: string;
  entities: Map<string, Entity>;
  layers: ArchitectureLayer[];
  lastUpdated: string;
  version: string;
}

export interface ModelQuery {
  type?: string;
  filePath?: string;
  name?: string;
  minImportance?: number;
}

export interface ModelStats {
  totalEntities: number;
  byType: Record<string, number>;
  byFile: Record<string, number>;
  lastUpdate: string;
}

const ENTITY_INDEX_FILE = 'entities.json';
const LAYERS_FILE = 'layers.json';

/**
 * ProjectMentalModel - Maintains project understanding
 */
export class ProjectMentalModel {
  private projectRoot: string;
  private entities: Map<string, Entity> = new Map();
  private layers: ArchitectureLayer[] = [];
  private entitiesPath: string;
  private layersPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.entitiesPath = join(projectRoot, MENTAL_MODEL_DIR, ENTITY_INDEX_FILE);
    this.layersPath = join(projectRoot, MENTAL_MODEL_DIR, LAYERS_FILE);
    this.load();
  }

  /**
   * Add or update an entity in the model
   */
  addEntity(entity: Omit<Entity, 'lastSeen' | 'confidence'>): Entity {
    const now = new Date().toISOString();
    const existing = this.entities.get(entity.id);

    const fullEntity: Entity = {
      ...entity,
      lastSeen: now,
      confidence: existing ? Math.min(1, existing.confidence + 0.1) : 0.5,
    };

    this.entities.set(entity.id, fullEntity);
    this.save();
    return fullEntity;
  }

  /**
   * Add relationship between entities
   */
  addRelationship(sourceId: string, targetId: string, type: EntityRelationship['type'], strength: number = 0.8): void {
    const source = this.entities.get(sourceId);
    const target = this.entities.get(targetId);

    if (!source || !target) return;

    // Update or add relationship
    const existingIdx = source.relationships.findIndex(r => r.targetId === targetId);
    if (existingIdx >= 0) {
      source.relationships[existingIdx] = { targetId, type, strength };
    } else {
      source.relationships.push({ targetId, type, strength });
    }

    this.entities.set(sourceId, source);
    this.save();
  }

  /**
   * Query entities by criteria
   */
  query(query: ModelQuery): Entity[] {
    let results = [...this.entities.values()];

    if (query.type) {
      results = results.filter(e => e.type === query.type);
    }

    if (query.filePath) {
      results = results.filter(e => e.filePath.includes(query.filePath!));
    }

    if (query.name) {
      const nameLower = query.name.toLowerCase();
      results = results.filter(e => e.name.toLowerCase().includes(nameLower));
    }

    if (query.minImportance !== undefined) {
      results = results.filter(e => e.importance >= query.minImportance!);
    }

    return results;
  }

  /**
   * Find related entities
   */
  findRelated(entityId: string, depth: number = 1): Entity[] {
    const visited = new Set<string>();
    const result: Entity[] = [];
    const queue: Array<{ id: string; level: number }> = [{ id: entityId, level: 0 }];

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;

      if (visited.has(id)) continue;
      visited.add(id);

      if (level > 0) {
        const entity = this.entities.get(id);
        if (entity) result.push(entity);
      }

      if (level < depth) {
        const entity = this.entities.get(id);
        if (entity) {
          for (const rel of entity.relationships) {
            if (!visited.has(rel.targetId)) {
              queue.push({ id: rel.targetId, level: level + 1 });
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Get entity by ID
   */
  getEntity(id: string): Entity | null {
    return this.entities.get(id) || null;
  }

  /**
   * Get entity by name and optionally type
   */
  getEntityByName(name: string, type?: string): Entity | null {
    for (const entity of this.entities.values()) {
      if (entity.name === name) {
        if (type && entity.type !== type) continue;
        return entity;
      }
    }
    return null;
  }

  /**
   * Get entities in a file
   */
  getFileEntities(filePath: string): Entity[] {
    return [...this.entities.values()].filter(e => e.filePath === filePath);
  }

  /**
   * Add or update architecture layer
   */
  addLayer(layer: ArchitectureLayer): void {
    const existingIdx = this.layers.findIndex(l => l.name === layer.name);
    if (existingIdx >= 0) {
      this.layers[existingIdx] = layer;
    } else {
      this.layers.push(layer);
    }
    this.save();
  }

  /**
   * Get all layers
   */
  getLayers(): ArchitectureLayer[] {
    return [...this.layers];
  }

  /**
   * Get layer by name
   */
  getLayer(name: string): ArchitectureLayer | null {
    return this.layers.find(l => l.name === name) || null;
  }

  /**
   * Get model statistics
   */
  getStats(): ModelStats {
    const byType: Record<string, number> = {};
    const byFile: Record<string, number> = {};
    let lastUpdate = '';

    for (const entity of this.entities.values()) {
      byType[entity.type] = (byType[entity.type] || 0) + 1;

      const fileKey = entity.filePath;
      byFile[fileKey] = (byFile[fileKey] || 0) + 1;

      if (!lastUpdate || entity.lastSeen > lastUpdate) {
        lastUpdate = entity.lastSeen;
      }
    }

    return {
      totalEntities: this.entities.size,
      byType,
      byFile,
      lastUpdate,
    };
  }

  /**
   * Remove entity
   */
  removeEntity(id: string): boolean {
    return this.entities.delete(id);
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.entities.clear();
    this.layers = [];
    this.save();
  }

  /**
   * Get all entities
   */
  getAllEntities(): Entity[] {
    return [...this.entities.values()];
  }

  // ============ Private Methods ============

  private load(): void {
    ensureDir(join(this.projectRoot, MENTAL_MODEL_DIR));

    if (existsSync(this.entitiesPath)) {
      try {
        const content = readFileSync(this.entitiesPath, 'utf-8');
        const data = JSON.parse(content);
        for (const e of data.entities || []) {
          this.entities.set(e.id, e);
        }
      } catch (error) {
        console.error('Failed to load entities:', error);
      }
    }

    if (existsSync(this.layersPath)) {
      try {
        const content = readFileSync(this.layersPath, 'utf-8');
        const data = JSON.parse(content);
        this.layers = data.layers || [];
      } catch (error) {
        console.error('Failed to load layers:', error);
      }
    }
  }

  private save(): void {
    ensureDir(join(this.projectRoot, MENTAL_MODEL_DIR));

    writeFileSync(this.entitiesPath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      entities: [...this.entities.values()],
    }, null, 2), 'utf-8');

    writeFileSync(this.layersPath, JSON.stringify({
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      layers: this.layers,
    }, null, 2), 'utf-8');
  }
}

// Singleton
const instances: Map<string, ProjectMentalModel> = new Map();

export function getProjectMentalModel(projectRoot: string = process.cwd()): ProjectMentalModel {
  if (!instances.has(projectRoot)) {
    instances.set(projectRoot, new ProjectMentalModel(projectRoot));
  }
  return instances.get(projectRoot)!;
}

export { MENTAL_MODEL_DIR };