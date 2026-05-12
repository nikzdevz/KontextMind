// Prompt Instructions Routes
import { Router, Request, Response } from 'express';
import { promptInstructionsService } from '../services/prompt-instructions-service.js';
import { projectService } from '../services/project-service.js';

const router = Router();

// GET /projects/:name/prompt - Get prompt instructions for a project
router.get('/:name/prompt', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;

    const project = projectService.getProject(name);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const instructions = promptInstructionsService.getInstructions(name);

    res.json({
      project: name,
      ...instructions,
    });
  } catch (error) {
    console.error('Get prompt instructions error:', error);
    res.status(500).json({ error: 'Failed to get prompt instructions' });
  }
});

// PUT /projects/:name/prompt - Update prompt instructions for a project
router.put('/:name/prompt', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { systemPrompt, userInstructions, responseStyle } = req.body;

    const project = projectService.getProject(name);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updated = promptInstructionsService.updateInstructions(name, {
      systemPrompt,
      userInstructions,
      responseStyle,
    });

    res.json({
      project: name,
      ...updated,
      message: 'Prompt instructions updated successfully',
    });
  } catch (error) {
    console.error('Update prompt instructions error:', error);
    res.status(500).json({ error: 'Failed to update prompt instructions' });
  }
});

// DELETE /projects/:name/prompt - Reset to default instructions
router.delete('/:name/prompt', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;

    const project = projectService.getProject(name);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const deleted = promptInstructionsService.deleteInstructions(name);

    res.json({
      project: name,
      deleted,
      message: deleted ? 'Prompt instructions reset to defaults' : 'No custom instructions to delete',
    });
  } catch (error) {
    console.error('Delete prompt instructions error:', error);
    res.status(500).json({ error: 'Failed to reset prompt instructions' });
  }
});

export default router;