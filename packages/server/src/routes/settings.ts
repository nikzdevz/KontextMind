// Settings Routes
import { Router, Request, Response } from 'express';

const router = Router();

// In-memory settings (could be persisted to file)
const settings = {
  llm_provider: process.env.LLM_PROVIDER || 'openai',
  llm_model: process.env.LLM_MODEL || 'gpt-4o',
  llm_base_url: process.env.LLM_BASE_URL || null,
  github_token_configured: Boolean(process.env.GITHUB_TOKEN),
};

// GET /settings
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { projectService } = await import('../services/project-service.js');
    const projects = projectService.listProjects();

    res.json({
      ...settings,
      projects_count: projects.length,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// PUT /settings
router.put('/', async (req: Request, res: Response) => {
  try {
    const { llm_provider, llm_model, llm_api_key, llm_base_url } = req.body;

    // Validate
    if (llm_provider && !['openai', 'anthropic', 'ollama', 'bedrock'].includes(llm_provider)) {
      return res.status(400).json({ error: 'Invalid LLM provider' });
    }

    // Update in-memory settings
    if (llm_provider) {
      settings.llm_provider = llm_provider;
      process.env.LLM_PROVIDER = llm_provider;
    }

    if (llm_model) {
      settings.llm_model = llm_model;
      process.env.LLM_MODEL = llm_model;
    }

    if (llm_base_url !== undefined) {
      settings.llm_base_url = llm_base_url;
      process.env.LLM_BASE_URL = llm_base_url;
    }

    if (llm_api_key) {
      // Would need to persist this securely in production
      process.env.LLM_API_KEY = llm_api_key;
    }

    res.json({
      updated: true,
      llm_provider: settings.llm_provider,
      llm_model: settings.llm_model,
      llm_base_url: settings.llm_base_url,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
