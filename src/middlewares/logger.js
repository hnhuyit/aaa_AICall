// src/middlewares/logger.js
// exports.logRequest = (req, res, next) => {
//     console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
//     next();
// };
  
// src/middlewares/logger.js
export function logRequest(req, res, next) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  }
  