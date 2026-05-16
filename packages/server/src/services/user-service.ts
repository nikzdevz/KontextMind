// User Service - Anonymous User Isolation
import type { User, UserPreferences, UserStats } from '../types/index.js';

const PROJECTS_DIR = process.env.DATA_DIR || '/kontextmind/projects';

// In-memory user store (in production, use database)
const users = new Map<string, User>();

export class UserService {
  // Get or create user by ID
  getOrCreateUser(userId: string, projectId: string): User {
    const key = `${userId}:${projectId}`;
    let user = users.get(key);

    if (!user) {
      const now = new Date().toISOString();
      user = {
        userId,
        projectId,
        createdAt: now,
        lastSeen: now,
        visitCount: 1,
        preferences: {},
        stats: {
          conversationsCreated: 0,
          questionsAsked: 0,
          feedbackGiven: 0
        }
      };
      users.set(key, user);
    } else {
      user.lastSeen = new Date().toISOString();
      user.visitCount++;
    }

    return user;
  }

  // Get user profile
  getProfile(userId: string, projectId: string): User | null {
    const key = `${userId}:${projectId}`;
    return users.get(key) || null;
  }

  // Update user preferences
  updatePreferences(userId: string, projectId: string, prefs: UserPreferences): User | null {
    const key = `${userId}:${projectId}`;
    const user = users.get(key);

    if (!user) return null;

    user.preferences = { ...user.preferences, ...prefs };
    return user;
  }

  // Increment stats
  incrementStat(userId: string, projectId: string, stat: keyof UserStats): void {
    const key = `${userId}:${projectId}`;
    const user = users.get(key);

    if (user && stat in user.stats) {
      const statsRecord = user.stats as unknown as Record<string, number>;
      statsRecord[stat]++;
    }
  }

  // Delete user data (clear user from project)
  deleteUser(userId: string, projectId: string): boolean {
    const key = `${userId}:${projectId}`;
    return users.delete(key);
  }

  // Reset user (new ID generation)
  resetUser(userId: string, projectId: string): string {
    const key = `${userId}:${projectId}`;
    users.delete(key);

    // Generate new ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `usr_${timestamp}${random}`;
  }

  // Get all users for a project
  listProjectUsers(projectId: string): User[] {
    const projectUsers: User[] = [];
    for (const user of users.values()) {
      if (user.projectId === projectId) {
        projectUsers.push(user);
      }
    }
    return projectUsers;
  }

  // Get user count for project
  countProjectUsers(projectId: string): number {
    let count = 0;
    for (const user of users.values()) {
      if (user.projectId === projectId) {
        count++;
      }
    }
    return count;
  }

  // Get user stats
  getUserStats(userId: string, projectId: string): { visitCount: number; lastSeen: string; questionsAsked: number; conversationsCreated: number; feedbackGiven: number } | null {
    const key = `${userId}:${projectId}`;
    const user = users.get(key);

    if (!user) return null;

    return {
      visitCount: user.visitCount,
      lastSeen: user.lastSeen,
      questionsAsked: user.stats.questionsAsked,
      conversationsCreated: user.stats.conversationsCreated,
      feedbackGiven: user.stats.feedbackGiven
    };
  }

  // Active users today
  getActiveUsersToday(projectId: string): number {
    const today = new Date().toISOString().substring(0, 10);
    let count = 0;

    for (const user of users.values()) {
      if (user.projectId === projectId && user.lastSeen.substring(0, 10) === today) {
        count++;
      }
    }

    return count;
  }
}

export const userService = new UserService();