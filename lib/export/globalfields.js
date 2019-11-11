/*!
* Contentstack Export
* Copyright (c) 2019 Contentstack LLC
* MIT Licensed
*/

var mkdirp = require('mkdirp');
var path = require('path');
var chalk = require('chalk');

var request = require('../util/request');
var app = require('../../app');
var helper = require('../util/helper');
var log = require('../util/log');

var config = app.getConfig()
var globalfieldsConfig = config.modules.globalfields;

var globalfieldsFolderPath = path.resolve(config.data, globalfieldsConfig.dirName);

// Create folder for environments
mkdirp.sync(globalfieldsFolderPath);
//delete config.headers['access_token'];

function ExportGlobalFields() {
  this.requestOptions = {
    url: config.host + config.apis.globalfields,
    headers: config.headers,
    qs: {
      include_count: true,
      asc: 'updated_at'
    },
    json: true
  };
  this.master = {};
  this.globalfields = {}
}


ExportGlobalFields.prototype.start = function () {
  log.success(chalk.blue('Starting GlobalFields export'));
  var self = this;
  return new Promise(function (resolve, reject) {
    return request(self.requestOptions).then(function (response) {
      if (response.body.global_fields.length !== 0) {
        for (var i = 0, total = response.body.count; i < total; i++) {
          var snip_uid = response.body.global_fields[i]['uid'];
          self.master[snip_uid] = '';
          self.globalfields[snip_uid] = response.body.global_fields[i];
          //delete self.globalfields[snip_uid]['uid'];
          delete self.globalfields[snip_uid]['SYS_ACL'];
        }
        helper.writeFile(path.join(globalfieldsFolderPath, globalfieldsConfig.fileName), self.globalfields);
        log.success(chalk.blue('All the globalfields have been exported successfully'));
        return resolve();
      } else {
        log.success(chalk.yellow('No globalfields were found in the Stack'));
        return resolve();
      }
    }).catch(function (error) {
      if(error.statusCode == 401) {
        log.error(chalk.red('You are not allowed to export globalfields unless you provide email and password in config'));
        return resolve();
      } else {
        log.error(error);
        return resolve();
      }
    })
  });
};

module.exports = new ExportGlobalFields();
