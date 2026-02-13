function getClientIP(req) {
  
  if (req.headers['x-forwarded-for']) {
    return req.headers['x-forwarded-for'].split(',')[0].trim();
  }
  
 
  if (req.headers['cf-connecting-ip']) {
    return req.headers['cf-connecting-ip'];
  }
  
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'];
  }
  
  
  if (req.ip) {
    return req.ip;
  }
  
  
  return req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.connection?.socket?.remoteAddress ||
         'Unknown';
}

module.exports = { getClientIP };