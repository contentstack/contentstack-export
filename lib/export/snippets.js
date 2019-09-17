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
var snippetConfig = config.modules.snippets;

var snippetFolderPath = path.resolve(config.data, snippetConfig.dirName);

// Create folder for environments
mkdirp.sync(snippetFolderPath);
//delete config.headers['access_token'];

function ExportSnippets() {
  this.requestOptions = {
    url: config.host + config.apis.snippets,
    headers: config.headers,
    qs: {
      include_count: true,
      asc: 'updated_at'
    },
    json: true
  };
  this.master = {};
  this.snippets = {}
}

ExportSnippets.prototype.start = function () {
  log.success(chalk.blue('Starting Snippet export'));
  var self = this;
  return new Promise(function (resolve, reject) {
    return request(self.requestOptions).then(function (response) {
      if (response.body.content_type_snippets.length !== 0) {
        for (var i = 0, total = response.body.count; i < total; i++) {
          var snip_uid = response.body.content_type_snippets[i]['uid'];
          self.master[snip_uid] = '';
          self.snippets[snip_uid] = response.body.content_type_snippets[i];
          delete self.snippets[snip_uid]['uid'];
          delete self.snippets[snip_uid]['SYS_ACL'];
        }
        helper.writeFile(path.join(snippetFolderPath, snippetConfig.fileName), self.snippets);
        log.success(chalk.blue('All the snippets have been exported successfully'));
        return resolve();
      } else {
        log.success(chalk.yellow('No snippets were found in the Stack'));
        return resolve();
      }
    }).catch(function (error) {
      if(error.statusCode == 401) {
        log.error(chalk.red('You are not allowed to export snippets unless you provide email and password in config'));
        return resolve();
      } else {
        log.error(error);
      }
      return reject();
    })
  });
};

module.exports = new ExportSnippets();
