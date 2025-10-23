const bcrypt = require('bcrypt');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);

const comparePassword = (password, hashedPassword) => bcrypt.compare(password, hashedPassword);

module.exports = {
  hashPassword,
  comparePassword,
};
