// Jobs Routes
import { Router, Request, Response } from 'express';
import { projectService } from '../services/project-service.js';

const router = Router();

// GET /jobs/:job_id
router.get('/:job_id', async (req: Request, res: Response) => {
  try {
    const { job_id } = req.params;
    const job = projectService.getJob(job_id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      job_id: job.job_id,
      project_id: job.project_name,
      status: job.status,
      progress_percent: job.progress_percent,
      current_step: job.current_step,
      error: job.error || undefined,
      created_at: job.created_at,
      updated_at: job.updated_at,
      completed_at: job.completed_at || undefined,
    });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to get job' });
  }
});

export default router;