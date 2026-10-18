// Har route ka response ek jaisa: { success, message, data }
const sendResponse = (res, status, message, data = null) => {
  return res.status(status).json({ success: status < 400, message, data });
};

module.exports = { sendResponse };
