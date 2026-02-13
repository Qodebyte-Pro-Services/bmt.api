const crypto = require('crypto');



function generateOTP(length = 6) {
  return crypto.randomInt(0, Math.pow(10, length)).toString().padStart(length, '0');
}

module.exports = { generateOTP };