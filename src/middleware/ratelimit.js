const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const { ipKeyGenerator } = require("express-rate-limit");

const generateKey = (req) => {
  if (req.user?.admin_id) return `admin-${req.user.admin_id}`;
  if (req.user?.vendor_id) return `vendor-${req.user.vendor_id}`;
  if (req.user?.user_id) return `user-${req.user.user_id}`;
//  return ipKeyGenerator(req); 
return req.ip;
};


const rateLimitHandler = (req, res, _next, options) => {
  const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
  const keyType = req.user?.admin_id
    ? "admin"
    : "";

  res.status(429).json({
    success: false,
    message: options.message,
    retryAfter: `${retryAfterSeconds} seconds`,
    keyType,
  });
};


const createRateLimitMiddleware = ({ windowMs, max, message }) => {
  const limiter = rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
  keyGenerator: generateKey,
    handler: rateLimitHandler,
  });

  const slowDownMiddleware = slowDown({
    windowMs,
    delayAfter: Math.floor(max * 0.5),
     delayMs: () => 500,
   keyGenerator: generateKey,
  });

 
  return (req, res, next) => {
    slowDownMiddleware(req, res, (err) => {
      if (err) return next(err);
      limiter(req, res, next);
    });
  };
};


const getAdminLimiter = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: "Too many GET requests from admin. Please try again later.",
});


const adminLimiter = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  max: 150,
  message: "Too many admin requests. Please try again later.",
});




module.exports = { rateLimitMiddleware: (req, res, next) => {
    if (req.method === "GET") {
      if (req.user?.admin_id) return getAdminLimiter(req, res, next);
      return;
    }


    if (req.user?.admin_id) return adminLimiter(req, res, next);
    return;
  } };
