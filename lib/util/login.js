/*!
 * Contentstack Import
 * Copyright (c) 2019 Contentstack LLC
 * MIT Licensed
 */

var chalk = require('chalk');

var request = require('./request');
var pkg = require('../../package');

module.exports = function (config) {
  return new Promise(function (resolve, reject) {
    console.log(chalk.blue('Logging into Contentstack'));

    var options = {
      url: config.host + config.apis.userSession,
      json: {
        user: {
          email: config.email,
          password: config.password
        }
      },
      method: 'POST'
    };

    return request(options).then(function (response) {
      console.log(chalk.green('Contentstack account authenticated successfully!'));
      config.authtoken = response.body.user.authtoken;
      config.headers = {
        api_key: config.source_stack,
        access_token: config.access_token,
        authtoken: config.authtoken,
        'X-User-Agent': 'contentstack-import/v' + pkg.version
      };
      return resolve(config);
    }).catch(reject);
  });
};
