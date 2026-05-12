// Projects Routes
import { Router, Request, Response } from 'express';
import { projectService } from '../services/project-service.js';

const router = Router();

// POST /projects/setup-with-github
router.post('/setup-with-github', async (req: Request, res: Response) => {
  try {
    const { git_url, name, branch, callback_url } = req.body;

    if (!git_url) {
      return res.status(400).json({ error: 'git_url is required' });
    }

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Validate git URL format
    if (!git_url.includes('github.com') && !git_url.includes('gitlab.com') && !git_url.includes('bitbucket.org')) {
      return res.status(400).json({ error: 'Invalid git URL. Must be a GitHub, GitLab, or Bitbucket URL.' });
    }

    // Check if project already exists
    const existing = projectService.getProject(name);
    if (existing) {
      return res.status(409).json({ error: 'Project already exists', project_id: name });
    }

    const result = await projectService.setupProject(git_url, name, branch || 'main', callback_url);

    res.status(202).json(result);
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Failed to setup project', message: error instanceof Error ? error.message : String(error) });
  }
});

// GET /projects
router.get('/', async (_req: Request, res: Response) => {
  try {
    const projects = projectService.listProjects();
    res.json({ projects });
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// GET /projects/:name
router.get('/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const project = projectService.getProject(name);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check for active job
    const activeJob = projectService.getProjectJob(name);

    res.json({
      ...project,
      active_job: activeJob || null,
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// DELETE /projects/:name
router.delete('/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const deleted = await projectService.deleteProject(name);

    if (!deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ name, deleted: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// POST /projects/:name/reindex
router.post('/:name/reindex', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { full, callback_url } = req.body;

    const project = projectService.getProject(name);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await projectService.reindexProject(name, full !== false, callback_url);

    res.status(202).json({
      project_id: name,
      status: 'reindexing',
      job_id: result.job_id,
    });
  } catch (error) {
    console.error('Reindex project error:', error);
    res.status(500).json({ error: 'Failed to reindex project', message: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
