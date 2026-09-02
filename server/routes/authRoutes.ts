import { Router, Request, Response } from 'express';
import { ProductionAuthenticationProvider, AuthenticatedPrincipal } from '../security/authenticationProvider';
import { resolvePrincipal } from '../security/authMiddleware';
import { prisma } from '../db/prisma';
import { UserRole } from '@prisma/client';
import crypto from 'crypto';

const router = Router();

export interface UserSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
  activeWorkspace: {
    id: string;
    name: string;
    slug: string;
    tier: string;
  };
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    role: UserRole;
    tier: string;
  }>;
  token: string;
}

// Helper to generate signed JWT token for a user with their memberships
function generateTokenForPrincipal(
  user: { id: string; email: string },
  memberships: Array<{ workspaceId: string; role: UserRole }>
): string {
  const isSystemAdmin = memberships.some((m) => m.role === 'OWNER' || m.role === 'ADMIN');
  return ProductionAuthenticationProvider.signJwt({
    userId: user.id,
    email: user.email,
    isSystemAdmin,
    workspaceMemberships: memberships,
    exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
  });
}

// GET /api/auth/session - Retrieve and validate current authenticated session
router.get('/session', async (req: Request, res: Response) => {
  try {
    const principal = await resolvePrincipal(req);
    if (!principal) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'No valid active session or authentication token provided.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: principal.userId },
    });

    if (!user) {
      return res.status(401).json({
        error: 'USER_NOT_FOUND',
        message: 'Authenticated user record no longer exists.',
      });
    }

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
    });

    // If user has no workspaces, return error or empty
    if (memberships.length === 0) {
      return res.status(403).json({
        error: 'NO_WORKSPACE_MEMBERSHIP',
        message: 'User is not a member of any workspace.',
      });
    }

    const workspaceIds = memberships.map((m) => m.workspaceId);
    const workspaceRecords = await prisma.workspace.findMany({
      where: { id: { in: workspaceIds } },
    });

    const workspacesWithRole = workspaceRecords.map((ws) => {
      const mem = memberships.find((m) => m.workspaceId === ws.id);
      return {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        role: (mem?.role || 'VIEWER') as UserRole,
        tier: 'Enterprise Autonomous Suite',
      };
    });

    const requestedWsId = req.headers['x-workspace-id'] as string;
    const activeWs =
      workspacesWithRole.find((w) => w.id === requestedWsId) || workspacesWithRole[0];

    const currentRole = activeWs.role;
    const token = generateTokenForPrincipal(
      user,
      memberships.map((m) => ({ workspaceId: m.workspaceId, role: m.role }))
    );

    const session: UserSession = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: currentRole,
      },
      activeWorkspace: activeWs,
      workspaces: workspacesWithRole,
      token,
    };

    return res.json({ session });
  } catch (err: any) {
    return res.status(500).json({ error: 'SESSION_FETCH_ERROR', message: err.message });
  }
});

// GET /api/auth/me - Profile info
router.get('/me', async (req: Request, res: Response) => {
  try {
    const principal = await resolvePrincipal(req);
    if (!principal) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const user = await prisma.user.findUnique({
      where: { id: principal.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
    });

    const workspaceIds = memberships.map((m) => m.workspaceId);
    const workspaceRecords = await prisma.workspace.findMany({
      where: { id: { in: workspaceIds } },
    });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      workspaces: workspaceRecords.map((ws) => {
        const mem = memberships.find((m) => m.workspaceId === ws.id);
        return {
          id: ws.id,
          name: ws.name,
          slug: ws.slug,
          role: mem?.role || 'VIEWER',
        };
      }),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/signup - First-time user registration & workspace creation
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, name, workspaceName } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'VALID_EMAIL_REQUIRED', message: 'A valid email address is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    let user = existingUser;
    if (!user) {
      const displayName = name || normalizedEmail.split('@')[0].replace(/[\.\_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      user = await prisma.user.create({
        data: {
          id: `usr-${crypto.randomBytes(6).toString('hex')}`,
          email: normalizedEmail,
          name: displayName,
        },
      });
    }

    // Create workspace
    const wsName = workspaceName || `${user.name}'s Organization`;
    const wsSlug = `${wsName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
    const workspace = await prisma.workspace.create({
      data: {
        id: `ws-${crypto.randomBytes(6).toString('hex')}`,
        name: wsName,
        slug: wsSlug,
      },
    });

    // Create membership
    await prisma.workspaceMember.create({
      data: {
        id: `mem-${crypto.randomBytes(6).toString('hex')}`,
        userId: user.id,
        workspaceId: workspace.id,
        role: 'OWNER' as UserRole,
      },
    });

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
    });

    const token = generateTokenForPrincipal(
      user,
      memberships.map((m) => ({ workspaceId: m.workspaceId, role: m.role }))
    );

    const activeWorkspace = {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      tier: 'Enterprise Trial (Full 6-Agent Swarm)',
      role: 'OWNER' as UserRole,
    };

    const session: UserSession = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'OWNER' as UserRole,
      },
      activeWorkspace,
      workspaces: [activeWorkspace],
      token,
    };

    return res.status(201).json({ session });
  } catch (err: any) {
    return res.status(500).json({ error: 'SIGNUP_FAILED', message: err.message });
  }
});

// POST /api/auth/login - Credential / Magic-link login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'VALID_EMAIL_REQUIRED', message: 'A valid email address is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // If user does not exist yet, automatically provision user and initial workspace
    if (!user) {
      const displayName = normalizedEmail.split('@')[0].replace(/[\.\_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      user = await prisma.user.create({
        data: {
          id: `usr-${crypto.randomBytes(6).toString('hex')}`,
          email: normalizedEmail,
          name: displayName,
        },
      });

      const wsName = `${displayName}'s Organization`;
      const workspace = await prisma.workspace.create({
        data: {
          id: `ws-${crypto.randomBytes(6).toString('hex')}`,
          name: wsName,
          slug: `${wsName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`,
        },
      });

      await prisma.workspaceMember.create({
        data: {
          id: `mem-${crypto.randomBytes(6).toString('hex')}`,
          userId: user.id,
          workspaceId: workspace.id,
          role: 'OWNER' as UserRole,
        },
      });
    }

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
    });

    const workspaceIds = memberships.map((m) => m.workspaceId);
    const workspaceRecords = await prisma.workspace.findMany({
      where: { id: { in: workspaceIds } },
    });

    const workspacesWithRole = workspaceRecords.map((ws) => {
      const mem = memberships.find((m) => m.workspaceId === ws.id);
      return {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        role: (mem?.role || 'VIEWER') as UserRole,
        tier: 'Enterprise Autonomous Suite',
      };
    });

    const activeWorkspace = workspacesWithRole[0];
    const token = generateTokenForPrincipal(
      user,
      memberships.map((m) => ({ workspaceId: m.workspaceId, role: m.role }))
    );

    const session: UserSession = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: activeWorkspace.role,
      },
      activeWorkspace,
      workspaces: workspacesWithRole,
      token,
    };

    return res.json({ session });
  } catch (err: any) {
    return res.status(500).json({ error: 'LOGIN_FAILED', message: err.message });
  }
});

// POST /api/auth/workspaces - Create a new workspace for the current user
router.post('/workspaces', async (req: Request, res: Response) => {
  try {
    const principal = await resolvePrincipal(req);
    if (!principal) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'WORKSPACE_NAME_REQUIRED' });
    }

    const wsName = name.trim();
    const wsSlug = `${wsName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
    const workspace = await prisma.workspace.create({
      data: {
        id: `ws-${crypto.randomBytes(6).toString('hex')}`,
        name: wsName,
        slug: wsSlug,
      },
    });

    await prisma.workspaceMember.create({
      data: {
        id: `mem-${crypto.randomBytes(6).toString('hex')}`,
        userId: principal.userId,
        workspaceId: workspace.id,
        role: 'OWNER' as UserRole,
      },
    });

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: principal.userId },
    });

    const token = generateTokenForPrincipal(
      { id: principal.userId, email: principal.email },
      memberships.map((m) => ({ workspaceId: m.workspaceId, role: m.role }))
    );

    return res.status(201).json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: 'OWNER',
        tier: 'Enterprise Autonomous Suite',
      },
      token,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'WORKSPACE_CREATION_FAILED', message: err.message });
  }
});

// POST /api/auth/switch-workspace
router.post('/switch-workspace', async (req: Request, res: Response) => {
  try {
    const principal = await resolvePrincipal(req);
    if (!principal) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const { workspaceId } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ error: 'WORKSPACE_ID_REQUIRED' });
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: principal.userId, workspaceId },
    });

    if (!membership && !principal.isSystemAdmin) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You are not a member of the requested workspace.',
      });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return res.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
    }

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: principal.userId },
    });

    const token = generateTokenForPrincipal(
      { id: principal.userId, email: principal.email },
      memberships.map((m) => ({ workspaceId: m.workspaceId, role: m.role }))
    );

    return res.json({
      activeWorkspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: membership?.role || 'VIEWER',
        tier: 'Enterprise Autonomous Suite',
      },
      token,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'SWITCH_WORKSPACE_FAILED', message: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  return res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
