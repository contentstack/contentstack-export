const sanitizePath = function (str) {
  return str?.replace(/^(\.\.(\/|\\|$))+/, "");
};

module.exports = sanitizePath;
