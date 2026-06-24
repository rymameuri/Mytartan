const {
  getUserCanvasConnection,
  setUserCanvasConnection,
  clearUserCanvasConnection,
} = require("./userStore");

function setConnection(sessionKey, canvasUrl, token) {
  setUserCanvasConnection(sessionKey, canvasUrl, token);
}

function getConnection(sessionKey) {
  return getUserCanvasConnection(sessionKey);
}

function clearConnection(sessionKey) {
  clearUserCanvasConnection(sessionKey);
}

module.exports = { setConnection, getConnection, clearConnection };
