import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { Project } from '../models/index.js';
import { BadRequestError, NotFoundError, ok } from '../utils/errors.js';

export const projectsRouter = Router();
projectsRouter.use(authenticate);

projectsRouter.get('/', async (req, res, next) => {
  try {
    const projects = await Project.find({ organizationId: req.auth!.organizationId }).sort({ createdAt: -1 });
    ok(res, projects);
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/', async (req, res, next) => {
  try {
    const { name, websiteUrl, description } = req.body as {
      name?: string;
      websiteUrl?: string;
      description?: string;
    };
    if (!name || name.trim().length < 2) throw new BadRequestError('Project name is required');
    const project = await Project.create({
      organizationId: req.auth!.organizationId,
      name: name.trim(),
      websiteUrl: websiteUrl?.trim(),
      description: description?.trim(),
      createdBy: req.auth!.userId
    });
    ok(res, project, undefined, 201);
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/:id', async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, organizationId: req.auth!.organizationId });
    if (!project) throw new NotFoundError('Project not found');
    ok(res, project);
  } catch (err) {
    next(err);
  }
});

projectsRouter.patch('/:id', async (req, res, next) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.auth!.organizationId },
      req.body,
      { new: true }
    );
    if (!project) throw new NotFoundError('Project not found');
    ok(res, project);
  } catch (err) {
    next(err);
  }
});

projectsRouter.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Project.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.auth!.organizationId
    });
    if (!deleted) throw new NotFoundError('Project not found');
    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});
