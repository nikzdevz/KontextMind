// Dataset Routes - API endpoints for dataset operations
import { Router, Request, Response } from 'express';
import { datasetService } from '../services/dataset-service.js';

const router = Router();

// POST /projects/:name/dataset/export - Export dataset
router.post('/:name/dataset/export', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const options = req.body;

    const result = await datasetService.exportDataset(name, options);

    res.json({
      success: true,
      path: result.path,
      recordCount: result.recordCount,
      version: result.version,
    });
  } catch (error) {
    console.error('Export dataset error:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.status(500).json({ error: 'Failed to export dataset', message });
  }
});

// GET /projects/:name/dataset/stats - Get dataset statistics
router.get('/:name/dataset/stats', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { version } = req.query;

    const stats = await datasetService.getStats(name, version as string | undefined);
    res.json(stats);
  } catch (error) {
    console.error('Get dataset stats error:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.status(500).json({ error: 'Failed to get stats', message });
  }
});

// GET /projects/:name/dataset/versions - List dataset versions
router.get('/:name/dataset/versions', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;

    const result = await datasetService.getVersionHistory(name);
    res.json(result);
  } catch (error) {
    console.error('List dataset versions error:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.status(500).json({ error: 'Failed to list versions', message });
  }
});

// GET /projects/:name/dataset/versions/:version - Get specific version
router.get('/:name/dataset/versions/:version', async (req: Request, res: Response) => {
  try {
    const { name, version } = req.params;

    const stats = await datasetService.getStats(name, version);
    res.json(stats);
  } catch (error) {
    console.error('Get dataset version error:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.status(500).json({ error: 'Failed to get version', message });
  }
});

// GET /projects/:name/dataset/compare - Compare two versions
router.get('/:name/dataset/compare', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { v1, v2 } = req.query;

    if (!v1 || !v2) {
      return res.status(400).json({ error: 'v1 and v2 query parameters are required' });
    }

    const result = await datasetService.compareVersions(name, v1 as string, v2 as string);
    res.json(result);
  } catch (error) {
    console.error('Compare versions error:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.status(500).json({ error: 'Failed to compare versions', message });
  }
});

// POST /projects/:name/dataset/validate - Validate dataset quality
router.post('/:name/dataset/validate', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { minQuality } = req.body;

    const result = await datasetService.validateDataset(name, minQuality);
    res.json(result);
  } catch (error) {
    console.error('Validate dataset error:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.status(500).json({ error: 'Failed to validate dataset', message });
  }
});

export default router;