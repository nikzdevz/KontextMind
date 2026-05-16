// Tenant Service - Multi-Tenant Support
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type {
  Tenant,
  TenantSettings,
  TenantUsage,
  CreateTenantRequest
} from '../types/index.js';

const PROJECTS_DIR = process.env.DATA_DIR || '/kontextmind/projects';
const TENANTS_DIR = join(PROJECTS_DIR, '.tenants');

interface TenantIndex {
  tenants: TenantMeta[];
}

interface TenantMeta {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
  suspendedAt?: string;
}

export class TenantService {
  private ensureDirectory(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private getTenantDir(tenantId: string): string {
    return join(TENANTS_DIR, tenantId);
  }

  private getTenantConfigPath(tenantDir: string): string {
    return join(tenantDir, 'tenant.json');
  }

  private getIndexPath(): string {
    return join(TENANTS_DIR, 'index.json');
  }

  // Create a new tenant
  async createTenant(request: CreateTenantRequest): Promise<Tenant> {
    this.ensureDirectory(TENANTS_DIR);

    const id = `tenant_${randomUUID().replace(/-/g, '').substring(0, 16)}`;
    const now = new Date().toISOString();

    const tenantDir = this.getTenantDir(id);
    this.ensureDirectory(tenantDir);

    const settings: TenantSettings = {
      maxUsers: request.settings?.maxUsers || 50,
      maxProjects: request.settings?.maxProjects || 10,
      currentUsers: 0,
      currentProjects: 0,
      allowUserSignups: request.settings?.allowUserSignups ?? true,
      requireEmailVerification: request.settings?.requireEmailVerification ?? false
    };

    const tenant: Tenant = {
      id,
      name: request.name,
      slug: request.slug,
      plan: (request.plan as Tenant['plan']) || 'free',
      status: 'active',
      createdAt: now,
      settings,
      billing: request.billing ? {
        email: request.billing.email,
        status: 'pending',
        paymentMethod: request.billing.paymentMethod
      } : undefined,
      usage: {
        requestsThisMonth: 0,
        storageMb: 0,
        apiCalls: 0
      }
    };

    // Save tenant config
    writeFileSync(this.getTenantConfigPath(tenantDir), JSON.stringify(tenant, null, 2), 'utf-8');

    // Update index
    const index = this.loadIndex();
    index.tenants.push({
      id,
      name: request.name,
      slug: request.slug,
      plan: request.plan || 'free',
      status: 'active',
      createdAt: now
    });
    this.saveIndex(index);

    return tenant;
  }

  // Get tenant by ID
  getTenant(tenantId: string): Tenant | null {
    const tenantDir = this.getTenantDir(tenantId);
    const configPath = this.getTenantConfigPath(tenantDir);

    if (!existsSync(configPath)) {
      return null;
    }

    try {
      return JSON.parse(readFileSync(configPath, 'utf-8')) as Tenant;
    } catch {
      return null;
    }
  }

  // List all tenants
  listTenants(options?: {
    status?: 'active' | 'suspended' | 'deleted';
    limit?: number;
    offset?: number;
  }): { tenants: Tenant[]; total: number } {
    const index = this.loadIndex();

    let filtered = index.tenants;
    if (options?.status) {
      filtered = filtered.filter(t => t.status === options.status);
    }

    const total = filtered.length;

    // Load full tenant data
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    const paginated = filtered.slice(offset, offset + limit);

    const tenants: Tenant[] = [];
    for (const meta of paginated) {
      const full = this.getTenant(meta.id);
      if (full) tenants.push(full);
    }

    return { tenants, total };
  }

  // Update tenant
  async updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant | null> {
    const tenant = this.getTenant(tenantId);
    if (!tenant) return null;

    const updated: Tenant = {
      ...tenant,
      ...updates,
      id: tenant.id // Don't allow ID change
    };

    const tenantDir = this.getTenantDir(tenantId);
    writeFileSync(this.getTenantConfigPath(tenantDir), JSON.stringify(updated, null, 2), 'utf-8');

    return updated;
  }

  // Delete tenant (soft delete)
  async deleteTenant(tenantId: string): Promise<boolean> {
    const tenant = this.getTenant(tenantId);
    if (!tenant) return false;

    tenant.status = 'deleted';
    tenant.suspendedAt = new Date().toISOString();

    const tenantDir = this.getTenantDir(tenantId);
    writeFileSync(this.getTenantConfigPath(tenantDir), JSON.stringify(tenant, null, 2), 'utf-8');

    return true;
  }

  // Suspend tenant
  async suspendTenant(tenantId: string): Promise<Tenant | null> {
    return this.updateTenant(tenantId, {
      status: 'suspended',
      suspendedAt: new Date().toISOString()
    });
  }

  // Resume tenant
  async resumeTenant(tenantId: string): Promise<Tenant | null> {
    return this.updateTenant(tenantId, {
      status: 'active',
      suspendedAt: undefined
    });
  }

  // Get tenant usage stats
  getTenantUsage(tenantId: string): {
    tenantId: string;
    period: string;
    usage: TenantUsage;
    billing?: {
      baseAmount: number;
      overageCharges: Record<string, number>;
      totalDue: number;
      dueDate: string;
    };
  } | null {
    const tenant = this.getTenant(tenantId);
    if (!tenant) return null;

    // Calculate usage from projects
    const usage: TenantUsage = {
      requestsThisMonth: 0,
      storageMb: 0,
      apiCalls: 0
    };

    // Count projects for this tenant
    const projectsDir = join(PROJECTS_DIR, tenantId, 'projects');
    if (existsSync(projectsDir)) {
      try {
        const projects = readdirSync(projectsDir);
        usage.storageMb = projects.length * 50; // Estimate 50MB per project
      } catch {}
    }

    return {
      tenantId,
      period: new Date().toISOString().substring(0, 7), // YYYY-MM
      usage,
      billing: tenant.billing ? {
        baseAmount: this.getPlanPrice(tenant.plan),
        overageCharges: {},
        totalDue: this.getPlanPrice(tenant.plan),
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10)
      } : undefined
    };
  }

  private getPlanPrice(plan: string): number {
    const prices: Record<string, number> = {
      free: 0,
      starter: 29,
      pro: 99,
      business: 299,
      enterprise: 0
    };
    return prices[plan] || 0;
  }

  // Tenant user management
  async addUser(tenantId: string, user: {
    email: string;
    name: string;
    role: string;
    permissions?: Record<string, boolean>;
  }): Promise<{ id: string; email: string; name: string; role: string }> {
    const tenantDir = this.getTenantDir(tenantId);
    const usersPath = join(tenantDir, 'users.json');

    let users: Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      permissions: Record<string, boolean>;
      createdAt: string;
    }> = [];

    if (existsSync(usersPath)) {
      try {
        users = JSON.parse(readFileSync(usersPath, 'utf-8'));
      } catch {}
    }

    const newUser = {
      id: `usr_${randomUUID().replace(/-/g, '').substring(0, 16)}`,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions || {},
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8');

    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role
    };
  }

  // List tenant users
  listTenantUsers(tenantId: string): { users: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
  }>; total: number } {
    const tenantDir = this.getTenantDir(tenantId);
    const usersPath = join(tenantDir, 'users.json');

    if (!existsSync(usersPath)) {
      return { users: [], total: 0 };
    }

    try {
      const users = JSON.parse(readFileSync(usersPath, 'utf-8'));
      return { users, total: users.length };
    } catch {
      return { users: [], total: 0 };
    }
  }

  private loadIndex(): TenantIndex {
    const indexPath = this.getIndexPath();

    if (existsSync(indexPath)) {
      try {
        return JSON.parse(readFileSync(indexPath, 'utf-8'));
      } catch {}
    }

    return { tenants: [] };
  }

  private saveIndex(index: TenantIndex): void {
    this.ensureDirectory(TENANTS_DIR);
    writeFileSync(this.getIndexPath(), JSON.stringify(index, null, 2), 'utf-8');
  }
}

export const tenantService = new TenantService();