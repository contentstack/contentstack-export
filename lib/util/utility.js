const sanitizePath = function (str) {
  return str
    ?.replace(/^([\/\\]){2,}/, "./") // Normalize leading slashes/backslashes to ''
    .replace(/[\/\\]+/g, "/") // Replace multiple slashes/backslashes with a single '/'
    .replace(/(\.\.(\/|\\|$))+/g, ""); // Remove directory traversal (../ or ..\)
};

module.exports = sanitizePath;
