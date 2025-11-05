const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const prisma = require('../prismaClient');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateAccessToken, calculateRefreshExpiry } = require('../utils/jwt');
const { admin, hasFirebaseCredentials } = require('../firebaseAdmin');

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const issueTokens = async (userId) => {
  const accessToken = generateAccessToken(userId);
  const refreshToken = crypto.randomUUID();
  const expiresAt = calculateRefreshExpiry();
  const expiresIn = Math.max(
    0,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  );

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt,
    },
  });

  return { accessToken, refreshToken, expiresAt, expiresIn };
};

const register = async (req, res, next) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ message: 'Email, username and password are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: passwordHash,
      },
    });

    const tokens = await issueTokens(user.id);

    res.status(201).json({
      user: sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.expiresAt,
      expiresIn: tokens.expiresIn,
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const passwordValid = await comparePassword(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const tokens = await issueTokens(user.id);

    res.json({
      user: sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.expiresAt,
      expiresIn: tokens.expiresIn,
    });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'refreshToken is required' });
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored) {
      const tokensCount = await prisma.refreshToken.count();
      if (tokensCount === 0) {
        return res.status(503).json({ message: 'Authentication service temporarily unavailable. Please try again shortly.' });
      }
      return res.status(404).json({ message: 'Refresh token not found' });
    }

    if (stored.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
      return res.status(401).json({ message: 'Refresh token expired' });
    }

    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const tokens = await issueTokens(stored.userId);

    res.json({
      user: sanitizeUser(stored.user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.expiresAt,
      expiresIn: tokens.expiresIn,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError ||
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientRustPanicError
    ) {
      return res
        .status(503)
        .json({ message: 'Authentication service temporarily unavailable. Please try again shortly.' });
    }
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    } else if (req.userId) {
      await prisma.refreshToken.deleteMany({ where: { userId: req.userId } });
    }

    res.json({ message: 'Logged out' });
  } catch (error) {
    next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(sanitizeUser(user));
  } catch (error) {
    next(error);
  }
};

const loginWithGoogle = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: 'idToken is required' });
    }

    if (!hasFirebaseCredentials) {
      return res.status(500).json({ message: 'Firebase credentials are not configured on the server' });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const email = decoded.email;
    if (!email) {
      return res.status(400).json({ message: 'Google account does not provide an email address' });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const username =
        decoded.name ||
        (decoded.email ? decoded.email.split('@')[0] : `chef_${decoded.uid}`);
      const temporaryPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await hashPassword(temporaryPassword);

      user = await prisma.user.create({
        data: {
          email,
          username,
          password: passwordHash,
        },
      });
    }

    const tokens = await issueTokens(user.id);

    res.json({
      user: sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.expiresAt,
      expiresIn: tokens.expiresIn,
    });
  } catch (error) {
    if (error.code === 'auth/argument-error') {
      return res.status(400).json({ message: 'Invalid Firebase ID token' });
    }
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ message: 'Firebase ID token has expired' });
    }
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  loginWithGoogle,
};
