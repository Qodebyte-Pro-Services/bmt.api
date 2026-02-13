const jwt = require('jsonwebtoken');

function generateTokenMainToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

function generateToken(payload, expiresIn = '1hr') {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}


module.exports = { generateToken, generateTokenMainToken };
