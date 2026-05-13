// Session Routes
import { Router, Request, Response } from 'express';
import { sessionService } from '../services/session-service.js';

const router = Router();

// POST /projects/:name/sessions - Create a new session
router.post('/:name/sessions', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const options = req.body;

    const result = await sessionService.createSession(name, options);
    res.status(201).json(result);
  } catch (error) {
    console.error('Create session error:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Project not found or not initialized' });
    }

    res.status(500).json({ error: 'Failed to create session', message });
  }
});

// GET /projects/:name/sessions - List all sessions for a project
router.get('/:name/sessions', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;

    const result = await sessionService.listSessions(name);
    res.json(result);
  } catch (error) {
    console.error('List sessions error:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.status(500).json({ error: 'Failed to list sessions', message });
  }
});

// GET /projects/:name/sessions/:sessionId - Get a specific session
router.get('/:name/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { name, sessionId } = req.params;

    const result = await sessionService.getSession(name, sessionId);
    res.json(result);
  } catch (error) {
    console.error('Get session error:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.status(500).json({ error: 'Failed to get session', message });
  }
});

// DELETE /projects/:name/sessions/:sessionId - Delete a session
router.delete('/:name/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { name, sessionId } = req.params;

    const result = await sessionService.deleteSession(name, sessionId);
    res.json(result);
  } catch (error) {
    console.error('Delete session error:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.status(500).json({ error: 'Failed to delete session', message });
  }
});

// GET /projects/:name/sessions/:sessionId/context - Get conversation context
router.get('/:name/sessions/:sessionId/context', async (req: Request, res: Response) => {
  try {
    const { name, sessionId } = req.params;
    const maxTurns = req.query.maxTurns ? parseInt(req.query.maxTurns as string) : undefined;

    const result = await sessionService.getContext(name, sessionId, maxTurns);
    res.json(result);
  } catch (error) {
    console.error('Get session context error:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.status(500).json({ error: 'Failed to get context', message });
  }
});

// GET /projects/:name/sessions/:sessionId/stats - Get session statistics
router.get('/:name/sessions/:sessionId/stats', async (req: Request, res: Response) => {
  try {
    const { name, sessionId } = req.params;

    const result = await sessionService.getSessionStats(name, sessionId);
    res.json(result);
  } catch (error) {
    console.error('Get session stats error:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.status(500).json({ error: 'Failed to get stats', message });
  }
});

// POST /projects/:name/sessions/:sessionId/messages - Add a message to session
router.post('/:name/sessions/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const { name, sessionId } = req.params;
    const { role, content } = req.body;

    if (!role || !content) {
      return res.status(400).json({ error: 'role and content are required' });
    }

    if (role !== 'user' && role !== 'assistant' && role !== 'system') {
      return res.status(400).json({ error: 'role must be user, assistant, or system' });
    }

    const result = await sessionService.addMessage(name, sessionId, { role, content });
    res.status(201).json(result);
  } catch (error) {
    console.error('Add message error:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.status(500).json({ error: 'Failed to add message', message });
  }
});

// POST /projects/:name/sessions/:sessionId/ask - Ask a question in a session
router.post('/:name/sessions/:sessionId/ask', async (req: Request, res: Response) => {
  try {
    const { name, sessionId } = req.params;
    const { question, mode } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'question is required' });
    }

    if (typeof question !== 'string') {
      return res.status(400).json({ error: 'question must be a string' });
    }

    const result = await sessionService.askWithSession(name, question, sessionId, mode || 'chatbot-readonly');
    res.json(result);
  } catch (error) {
    console.error('Session ask error:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not initialized')) {
      return res.status(404).json({ error: 'Project not found or not initialized' });
    }

    if (message.includes('not ready')) {
      return res.status(503).json({ error: 'Project KB not ready. Initialization in progress.' });
    }

    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.status(500).json({ error: 'Failed to process question', message });
  }
});

// POST /projects/:name/ask (with session support) - Ask with optional session
router.post('/:name/ask', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { question, mode, sessionId } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'question is required' });
    }

    if (typeof question !== 'string') {
      return res.status(400).json({ error: 'question must be a string' });
    }

    // If sessionId provided, use session-aware ask
    if (sessionId) {
      const result = await sessionService.askWithSession(name, question, sessionId, mode || 'chatbot-readonly');
      return res.json(result);
    }

    // Otherwise, use regular ask without session
    const { askService: basicAskService } = await import('../services/ask-service.js');
    const result = await basicAskService.ask(name, question, mode || 'chatbot-readonly');
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