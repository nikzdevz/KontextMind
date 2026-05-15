// Health Routes
import { Router, Request, Response } from 'express';
import { projectService } from '../services/project-service.js';

const router = Router();
const startTime = Date.now();
const VERSION = '0.1.0';

// GET /health
router.get('/', async (_req: Request, res: Response) => {
  try {
    const projects = projectService.listProjects();

    const ready = projects.filter(p => p.status === 'ready').length;
    const initializing = projects.filter(p =>
      ['initializing', 'cloning', 'indexing', 'summarizing', 'kb_building', 'reindexing'].includes(p.status)
    ).length;

    const status = ready > 0 ? 'healthy' : (initializing > 0 ? 'degraded' : 'unhealthy');

    res.json({
      status,
      version: VERSION,
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      projects: {
        total: projects.length,
        ready,
        initializing,
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      version: VERSION,
      error: 'Failed to check health',
    });
  }
});

// GET /health/live
router.get('/live', async (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// GET /health/ready
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check if server is ready to accept requests
    const projects = projectService.listProjects();

    res.json({
      ok: true,
      ready: true,
      projects_loaded: projects.length,
    });
  } catch (error) {
    res.status(503).json({ ok: false, ready: false });
  }
});

export default router;
