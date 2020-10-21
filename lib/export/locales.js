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
var localeConfig = config.modules.locales;
var localesFolderPath = path.resolve(config.data, localeConfig.dirName);
var master_locale = config.master_locale;
var requiredKeys = localeConfig.requiredKeys;

// Create locale folder
mkdirp.sync(localesFolderPath);

function ExportLocales () {
  this.requestOptions = {
    url: config.host + config.apis.locales,
    headers: config.headers,
    qs: {
      include_count: true,
      asc: 'updated_at',
      query: {
        code: {
          $nin: [master_locale.code]
        }
      },
      only: {
        BASE: requiredKeys
      }
    },
    json: true
  };
  this.locales = {};
}

ExportLocales.prototype.start = function () {
  log.success(chalk.blue('Starting locale export'));
  var self = this;
  self.requestOptions.qs['query'] = JSON.stringify(self.requestOptions.qs.query)
  return new Promise(function (resolve, reject) {
    return request(self.requestOptions).then(function (response) {
      if (response.body.locales.length !== 0) {
        response.body.locales.forEach(function (locale) {
          log.success(chalk.green(locale.name + ' locale was exported successfully'));
          for (var key in locale) {
            if (requiredKeys.indexOf(key) === -1) {
              delete locale.key;
            }
          }
          self.locales[locale.uid] = locale;
        });
      } else {
        log.success(chalk.yellow(
          'No locales, other than master-locale were found in the Stack'));
      }
      helper.writeFile(path.join(localesFolderPath, localeConfig.fileName), self.locales);
      log.success(chalk.blue('All the locales have been exported successfully'));
      return resolve();
    }).catch(reject);
  });
};

module.exports = new ExportLocales();
