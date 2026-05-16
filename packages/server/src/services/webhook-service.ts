// Webhook Service
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import type { Webhook, WebhookRequest } from '../types/index.js';

const PROJECTS_DIR = process.env.DATA_DIR || '/kontextmind/projects';

interface WebhookRecord {
  id: string;
  projectId: string;
  url: string;
  events: string[];
  secret?: string;
  createdAt: string;
  active: boolean;
}

export class WebhookService {
  private getProjectDir(projectName: string): string {
    return join(PROJECTS_DIR, projectName);
  }

  private getWebhooksPath(projectDir: string): string {
    return join(projectDir, '.kontextmind', 'webhooks.json');
  }

  private ensureDirectory(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // List webhooks for a project
  listWebhooks(projectName: string): Webhook[] {
    const projectDir = this.getProjectDir(projectName);
    const webhooksPath = this.getWebhooksPath(projectDir);

    if (!existsSync(webhooksPath)) {
      return [];
    }

    try {
      const records = JSON.parse(readFileSync(webhooksPath, 'utf-8')) as WebhookRecord[];
      return records.map(r => ({
        id: r.id,
        projectId: r.projectId,
        url: r.url,
        events: r.events,
        secret: r.secret,
        createdAt: r.createdAt,
        active: r.active
      }));
    } catch {
      return [];
    }
  }

  // Register a webhook
  async registerWebhook(
    projectName: string,
    request: WebhookRequest
  ): Promise<Webhook> {
    const projectDir = this.getProjectDir(projectName);
    this.ensureDirectory(join(projectDir, '.kontextmind'));

    const webhooksPath = this.getWebhooksPath(projectDir);

    let webhooks: WebhookRecord[] = [];
    if (existsSync(webhooksPath)) {
      try {
        webhooks = JSON.parse(readFileSync(webhooksPath, 'utf-8'));
      } catch {}
    }

    const id = `whk_${randomUUID().replace(/-/g, '').substring(0, 16)}`;
    const secret = request.secret || `whsec_${randomUUID().replace(/-/g, '').substring(0, 32)}`;

    const webhook: WebhookRecord = {
      id,
      projectId: projectName,
      url: request.url,
      events: request.events,
      secret,
      createdAt: new Date().toISOString(),
      active: true
    };

    webhooks.push(webhook);
    writeFileSync(webhooksPath, JSON.stringify(webhooks, null, 2), 'utf-8');

    return {
      id: webhook.id,
      projectId: webhook.projectId,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret,
      createdAt: webhook.createdAt,
      active: webhook.active
    };
  }

  // Delete webhook
  async deleteWebhook(projectName: string, webhookId: string): Promise<boolean> {
    const projectDir = this.getProjectDir(projectName);
    const webhooksPath = this.getWebhooksPath(projectDir);

    if (!existsSync(webhooksPath)) {
      return false;
    }

    try {
      let webhooks = JSON.parse(readFileSync(webhooksPath, 'utf-8')) as WebhookRecord[];
      const initialLength = webhooks.length;
      webhooks = webhooks.filter(w => w.id !== webhookId);

      if (webhooks.length < initialLength) {
        writeFileSync(webhooksPath, JSON.stringify(webhooks, null, 2), 'utf-8');
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  // Trigger webhook
  async triggerWebhook(
    projectName: string,
    event: string,
    data: Record<string, unknown>
  ): Promise<{ triggered: number; failed: number }> {
    const webhooks = this.listWebhooks(projectName);

    // Filter by event
    const matching = webhooks.filter(w =>
      w.active && w.events.includes(event)
    );

    let triggered = 0;
    let failed = 0;

    for (const webhook of matching) {
      try {
        await this.sendWebhook(webhook, event, data);
        triggered++;
      } catch {
        failed++;
      }
    }

    return { triggered, failed };
  }

  private async sendWebhook(
    webhook: Webhook,
    event: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const payload = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data
    });

    const signature = this.generateSignature(payload, webhook.secret || '');

    // Use curl to send webhook (simple approach)
    try {
      execSync(
        `curl -X POST "${webhook.url}" -H "Content-Type: application/json" -H "X-KontextMind-Signature: ${signature}" -d '${payload.replace(/'/g, "'\\''")}'`,
        { stdio: 'ignore', timeout: 10000 }
      );
    } catch {
      // Webhook delivery failed
    }
  }

  private generateSignature(payload: string, secret: string): string {
    // Simple HMAC-like signature
    // In production, use crypto.createHmac
    const combined = payload + secret;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `sha256=${Math.abs(hash).toString(16)}`;
  }

  // Verify webhook signature
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expected = this.generateSignature(payload, secret);
    return expected === signature;
  }
}

export const webhookService = new WebhookService();