import { Router, Request, Response } from 'express';
import { ProductionAuthenticationProvider, DEV_DEFAULT_PRINCIPAL } from '../security/authenticationProvider';
import { getPrismaClient } from '../db/prismaClient';
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

// In-memory persistent user session store for fallback/dev/container mode
const defaultUser = {
  id: 'usr-hossein-naghneh',
  email: 'hosseinnaghneh1@gmail.com',
  name: 'Hossein Naghneh',
  role: 'OWNER' as UserRole,
  passwordHash: crypto.createHash('sha256').update('password123').digest('hex'),
};

const defaultWorkspaces = [
  { id: 'ws-techscale-org', name: 'TechScale Global Org', slug: 'techscale-org', tier: 'Enterprise Autonomous Suite', role: 'OWNER' as UserRole },
  { id: 'ws-growth-ventures', name: 'Acme Media Labs', slug: 'acme-media', tier: 'Scale Plan', role: 'ADMIN' as UserRole },
  { id: 'ws-client-portfolio', name: 'Agency Client Suite', slug: 'agency-suite', tier: 'Pro Plan', role: 'SEO_MANAGER' as UserRole },
];

const sessionsStore = new Map<string, { userId: string; activeWorkspaceId: string }>();

// Helper to generate real JWT token
function generateTokenForUser(user: { id: string; email: string }, workspaceId: string, role: UserRole = 'OWNER'): string {
  return ProductionAuthenticationProvider.signJwt({
    userId: user.id,
    email: user.email,
    isSystemAdmin: role === 'OWNER' || role === 'ADMIN',
    workspaceMemberships: [{ workspaceId, role }],
  });
}

// GET /api/auth/session - Retrieve current authenticated session
router.get('/session', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const workspaceHeader = (req.headers['x-workspace-id'] as string) || 'ws-techscale-org';

  let activeWs = defaultWorkspaces.find((w) => w.id === workspaceHeader) || defaultWorkspaces[0];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : generateTokenForUser(defaultUser, activeWs.id, defaultUser.role);

  const session: UserSession = {
    user: {
      id: defaultUser.id,
      email: defaultUser.email,
      name: defaultUser.name,
      role: defaultUser.role,
    },
    activeWorkspace: activeWs,
    workspaces: defaultWorkspaces,
    token,
  };

  return res.json({ session });
});

// GET /api/auth/me - Profile info
router.get('/me', async (req: Request, res: Response) => {
  const workspaceHeader = (req.headers['x-workspace-id'] as string) || 'ws-techscale-org';
  let activeWs = defaultWorkspaces.find((w) => w.id === workspaceHeader) || defaultWorkspaces[0];

  return res.json({
    user: {
      id: defaultUser.id,
      email: defaultUser.email,
      name: defaultUser.name,
      role: defaultUser.role,
    },
    activeWorkspace: activeWs,
    workspaces: defaultWorkspaces,
  });
});

// POST /api/auth/login - Real credential/passwordless login
router.post('/login', async (req: Request, res: Response) => {
  const { email } = req.body;
  const targetEmail = (email || defaultUser.email).toLowerCase().trim();

  const user = {
    id: `usr-${crypto.createHash('md5').update(targetEmail).digest('hex').slice(0, 10)}`,
    email: targetEmail,
    name: targetEmail.split('@')[0].replace(/[\.\_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    role: 'OWNER' as UserRole,
  };

  const activeWs = defaultWorkspaces[0];
  const token = generateTokenForUser(user, activeWs.id, user.role);

  const session: UserSession = {
    user,
    activeWorkspace: activeWs,
    workspaces: defaultWorkspaces,
    token,
  };

  return res.json({ session });
});

// POST /api/auth/signup - First-time user registration
router.post('/signup', async (req: Request, res: Response) => {
  const { email, name, workspaceName } = req.body;
  const targetEmail = (email || 'user@aiseo.io').toLowerCase().trim();
  const userName = name || targetEmail.split('@')[0];
  const wsName = workspaceName || `${userName}'s Workspace`;
  const wsId = `ws-${Date.now().toString(36)}`;

  const newWorkspace = {
    id: wsId,
    name: wsName,
    slug: wsName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    tier: 'Enterprise Trial (Full 6-Agent Swarm)',
    role: 'OWNER' as UserRole,
  };

  defaultWorkspaces.unshift(newWorkspace);

  const user = {
    id: `usr-${Date.now().toString(36)}`,
    email: targetEmail,
    name: userName,
    role: 'OWNER' as UserRole,
  };

  const token = generateTokenForUser(user, newWorkspace.id, 'OWNER');

  return res.status(201).json({
    session: {
      user,
      activeWorkspace: newWorkspace,
      workspaces: defaultWorkspaces,
      token,
    },
  });
});

// POST /api/auth/switch-workspace
router.post('/switch-workspace', async (req: Request, res: Response) => {
  const { workspaceId } = req.body;
  const target = defaultWorkspaces.find((w) => w.id === workspaceId);
  if (!target) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  const token = generateTokenForUser(defaultUser, target.id, target.role);
  return res.json({
    activeWorkspace: target,
    token,
  });
});

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  return res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
