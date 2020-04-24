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
var webhooksConfig = config.modules.webhooks;

var webhooksFolderPath = path.resolve(config.data, webhooksConfig.dirName);

// Create folder for environments
mkdirp.sync(webhooksFolderPath);
//delete config.headers['access_token'];

function ExportWebhooks() {
  this.requestOptions = {
    url: config.host + config.apis.webhooks,
    headers: config.headers,
    qs: {
      include_count: true,
      asc: 'updated_at'
    },
    json: true
  };
  this.master = {};
  this.webhooks = {}
}

ExportWebhooks.prototype.start = function () {
  log.success(chalk.blue('Starting webhooks export'));
  var self = this;
  return new Promise(function (resolve, reject) {
    return request(self.requestOptions).then(function (response) {
      if (response.body.webhooks.length !== 0) {
        for (var i = 0, total = response.body.count; i < total; i++) {
          var web_uid = response.body.webhooks[i]['uid'];
          self.master[web_uid] = '';
          self.webhooks[web_uid] = response.body.webhooks[i];
          delete self.webhooks[web_uid]['uid'];
          delete self.webhooks[web_uid]['SYS_ACL'];
        }
        helper.writeFile(path.join(webhooksFolderPath, webhooksConfig.fileName), self.webhooks);
        log.success(chalk.blue('All the webhooks have been exported successfully'));
        return resolve();
      } else {
        log.success(chalk.yellow('No webhooks were found in the Stack'));
        return resolve();
      }
    }).catch(function (error) {
      if(error.statusCode == 401) {
        log.error(chalk.red('You are not allowed to export webhooks, Unless you provide email and password in config'));
        return resolve();
      } else {
        log.error(error);
      }
      return reject();
    })
  });
};

module.exports = new ExportWebhooks();
