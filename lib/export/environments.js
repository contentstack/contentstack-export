/*!
* Contentstack Export
* Copyright (c) 2019 Contentstack LLC
* MIT Licensed
*/

var mkdirp = require('mkdirp');
var path = require('path');
var chalk = require('chalk');

var request = require('../util/request');
var app = require('../../app')
var helper = require('../util/helper');
var log = require('../util/log');

var config = app.getConfig()
var environmentConfig = config.modules.environments;

var environmentsFolderPath = path.resolve(config.data, environmentConfig.dirName);

// Create folder for environments
mkdirp.sync(environmentsFolderPath);

function ExportEnvironments() {
  this.requestOptions = {
    url: config.host + config.apis.environments,
    headers: config.headers,
    qs: {
      include_count: true,
      asc: 'updated_at'
    },
    json: true
  };
  this.master = {};
  this.environments = {}
}

ExportEnvironments.prototype.start = function () {
  log.success(chalk.blue('Starting environment export'));
  var self = this;
  return new Promise(function (resolve, reject) {
    return request(self.requestOptions).then(function (response) {
      if (response.body.environments.length !== 0) {
        for (var i = 0, total = response.body.count; i < total; i++) {
          var env_uid = response.body.environments[i]['uid'];
          self.master[env_uid] = '';
          self.environments[env_uid] = response.body.environments[i];
          delete self.environments[env_uid]['uid'];
          delete self.environments[env_uid]['SYS_ACL'];
        }
        helper.writeFile(path.join(environmentsFolderPath, environmentConfig.fileName), self.environments);
        log.success(chalk.blue('All the environments have been exported successfully'));
        return resolve();
      } else {
        log.success(chalk.yellow('No environments were found in the Stack'));
        return resolve();
      }
    }).catch(reject);
  });
};

module.exports = new ExportEnvironments();
