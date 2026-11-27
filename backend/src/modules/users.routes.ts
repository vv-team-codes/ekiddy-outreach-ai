import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth.middleware.js';
import { User } from '../models/index.js';
import { BadRequestError, NotFoundError, ok } from '../utils/errors.js';
import { ok as okResp } from '../utils/errors.js';

export const usersRouter = Router();
usersRouter.use(authenticate);

usersRouter.get('/profile', async (req, res, next) => {
  try {
    const user = await User.findById(req.auth!.userId);
    if (!user) throw new NotFoundError('User not found');
    okResp(res, user);
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/profile', async (req, res, next) => {
  try {
    const { fullName, jobTitle, timezone, avatarUrl } = req.body as Record<string, string | undefined>;
    const user = await User.findByIdAndUpdate(
      req.auth!.userId,
      {
        ...(fullName ? { fullName: fullName.trim() } : {}),
        ...(jobTitle !== undefined ? { jobTitle: jobTitle.trim() } : {}),
        ...(timezone ? { timezone } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {})
      },
      { new: true }
    );
    if (!user) throw new NotFoundError('User not found');
    ok(res, user);
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      throw new BadRequestError('Current password and new password (min 8 chars) are required');
    }
    const user = await User.findById(req.auth!.userId).select('+passwordHash');
    if (!user || !user.passwordHash) throw new NotFoundError('User not found');

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) throw new BadRequestError('Current password is incorrect');

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    ok(res, { updated: true });
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/preferences', async (req, res, next) => {
  try {
    const { theme, notificationsEnabled } = req.body as {
      theme?: 'light' | 'dark' | 'system';
      notificationsEnabled?: boolean;
    };
    const user = await User.findById(req.auth!.userId);
    if (!user) throw new NotFoundError('User not found');

    if (theme && ['light', 'dark', 'system'].includes(theme)) {
      user.preferences.theme = theme;
    }
    if (typeof notificationsEnabled === 'boolean') {
      user.preferences.notificationsEnabled = notificationsEnabled;
    }
    await user.save();
    ok(res, user.preferences);
  } catch (err) {
    next(err);
  }
});
