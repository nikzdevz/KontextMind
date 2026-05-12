// Feedback Routes
import { Router, Request, Response } from 'express';
import { feedbackService } from '../services/feedback-service.js';
import { projectService } from '../services/project-service.js';

const router = Router();

// POST /feedback
router.post('/', async (req: Request, res: Response) => {
  try {
    const { qa_id, project, signal, reason, metadata } = req.body;

    if (!qa_id) {
      return res.status(400).json({ error: 'qa_id is required' });
    }

    if (!project) {
      return res.status(400).json({ error: 'project is required' });
    }

    if (!signal || !['helpful', 'not_helpful', 'neutral'].includes(signal)) {
      return res.status(400).json({ error: 'signal must be one of: helpful, not_helpful, neutral' });
    }

    // Verify project exists
    const projectExists = projectService.getProject(project);
    if (!projectExists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await feedbackService.recordFeedback({
      qa_id,
      project,
      signal,
      reason,
      metadata: metadata || {},
    });

    res.json(result);
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

// GET /feedback-export/:name
router.get('/export/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { format, since } = req.query;

    // Verify project exists
    const projectExists = projectService.getProject(name);
    if (!projectExists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await feedbackService.exportFeedback(
      name,
      (format as 'jsonl' | 'json') || 'json',
      since as string | undefined
    );

    if (format === 'jsonl') {
      // Return as newline-delimited JSON
      const lines = result.data.map(r => JSON.stringify(r)).join('\n');
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.send(lines);
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Feedback export error:', error);
    res.status(500).json({ error: 'Failed to export feedback' });
  }
});

// GET /feedback-stats/:name
router.get('/stats/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;

    // Verify project exists
    const projectExists = projectService.getProject(name);
    if (!projectExists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const stats = feedbackService.getFeedbackStats(name);
    res.json({ project: name, stats });
  } catch (error) {
    console.error('Feedback stats error:', error);
    res.status(500).json({ error: 'Failed to get feedback stats' });
  }
});

export default router;
