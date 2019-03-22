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
var extensionConfig = config.modules.extensions;

var extensionsFolderPath = path.resolve(config.data, extensionConfig.dirName);

// Create folder for extensions
mkdirp.sync(extensionsFolderPath);

function ExportExtensions() {
  this.requestOptions = {
    url: config.host + config.apis.extension,
    headers: config.headers,
    qs: {
      include_count: true,
      asc: 'updated_at'
    },
    json: true
  };
  this.master = {};
  this.extensions = {}
}

ExportExtensions.prototype.start = function () {
  log.success(chalk.blue('Starting extension export'));
  var self = this;
  return new Promise(function (resolve, reject) {
    return request(self.requestOptions).then(function (response) {
      if (response.body.extensions.length !== 0) {
        for (var i = 0, total = response.body.count; i < total; i++) {
          var ext_uid = response.body.extensions[i]['uid'];
          self.master[ext_uid] = '';
          self.extensions[ext_uid] = response.body.extensions[i];
          delete self.extensions[ext_uid]['uid'];
          delete self.extensions[ext_uid]['SYS_ACL'];
        }
        helper.writeFile(path.join(extensionsFolderPath, extensionConfig.fileName), self.extensions);
        log.success(chalk.blue('All the extensions have been exported successfully'));
        return resolve();
      } else {
        log.success(chalk.yellow('No extensions were found in the Stack'));
        return resolve();
      }
    }).catch(reject);
  });
};

module.exports = new ExportExtensions();
