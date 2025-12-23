// src/middlewares/errorHandler.js
export function errorHandler(err, req, res, next) {
    console.error("❌ Error handler:", err.stack);
    if (res.headersSent) {
      return; // ⛔ tuyệt đối không gửi lại response
    }
    res.status(500).json({
      status: "error",
      error: "Internal Server Error",
      message: err.message || "Internal Server Error"
    });
  }
  