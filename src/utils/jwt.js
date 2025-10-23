const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET ||
  process.env.JWT_ACCESS_SECRET ||
  'access-secret';
const ACCESS_TOKEN_TTL =
  process.env.ACCESS_TOKEN_TTL ||
  process.env.JWT_ACCESS_TTL ||
  '15m';
const REFRESH_TOKEN_TTL_DAYS = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10);

const generateAccessToken = (userId) =>
  jwt.sign({ userId }, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

const verifyAccessToken = (token) => jwt.verify(token, ACCESS_TOKEN_SECRET);

const calculateRefreshExpiry = () => {
  const expires = new Date();
  expires.setDate(expires.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return expires;
};

module.exports = {
  generateAccessToken,
  verifyAccessToken,
  calculateRefreshExpiry,
};
