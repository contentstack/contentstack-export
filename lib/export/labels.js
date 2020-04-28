/*!
 * Contentstack Export
 * Copyright (c) 2019 Contentstack LLC
 * MIT Licensed
 */

var mkdirp = require('mkdirp');
var path = require('path');
var chalk = require('chalk');

var app = require('../../app')
var request = require('../util/request');
var helper = require('../util/helper');
var log = require('../util/log');

var config = app.getConfig()
var labelConfig = config.modules.labels;
var labelsFolderPath = path.resolve(config.data, labelConfig.dirName);

// Create locale folder
mkdirp.sync(labelsFolderPath);

function ExportLabels () {
  this.requestOptions = {
    url: config.host + config.apis.labels,
    headers: config.headers,
    json: true
  };
  this.labels = {};
}

ExportLabels.prototype.start = function () {
  log.success(chalk.blue('Starting labels export'));
  var self = this;
  return new Promise(function (resolve, reject) {
    return request(self.requestOptions).then(function (response) {
      if (response.body.labels.length !== 0) {
        response.body.labels.forEach(function (label) {            
          log.success(chalk.green(label.name + ' labels was exported successfully'));
          self.labels[label.uid] = label;
        });
      } else {
        log.success(chalk.yellow(
          'No labels, other than master-labels were found in the Stack'));
      }
      helper.writeFile(path.join(labelsFolderPath, labelConfig.fileName), self.labels);
      log.success(chalk.blue('All the labels have been exported successfully'));
      return resolve();
    }).catch(function (error) {
      if(error.statusCode == 401) {
        log.error(chalk.red('You are not allowed to export label, Unless you provide email and password in config'));
        return resolve();
      } else {
        log.error(error);
      }
      return reject();
    })
  });
};

module.exports = new ExportLabels();
