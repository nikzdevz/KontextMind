// Ask Routes
import { Router, Request, Response } from 'express';
import { askService } from '../services/ask-service.js';

const router = Router();

// POST /projects/:name/ask
router.post('/:name/ask', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { question, mode } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'question is required' });
    }

    if (typeof question !== 'string') {
      return res.status(400).json({ error: 'question must be a string' });
    }

    const result = await askService.ask(name, question, mode || 'chatbot-readonly');

    res.json(result);
  } catch (error) {
    console.error('Ask error:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not initialized')) {
      return res.status(404).json({ error: 'Project not found or not initialized' });
    }

    if (message.includes('not ready')) {
      return res.status(503).json({ error: 'Project KB not ready. Initialization in progress.' });
    }

    res.status(500).json({ error: 'Failed to process question', message });
  }
});

export default router;
