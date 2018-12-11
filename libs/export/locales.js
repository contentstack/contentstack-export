/**
 * External module Dependencies.
 */
//var request = require('request');
var mkdirp = require('mkdirp');
var path = require('path');
var when = require('when');
var chalk = require('chalk');

/**
 * Internal module Dependencies.
 */
var request = require('../utils/request'); 
var config = require('../../config');
var helper = require('../utils/helper');
var log = require('../utils/log');

var localeConfig = config.modules.locales;
var localesFolderPath = path.resolve(config.data, localeConfig.dirName);
var master_locale = config.master_locale;
var requiredKeys = localeConfig.requiredKeys;

// Create locale folder
mkdirp.sync(localesFolderPath);

function ExportLocales() {
  this.requestOptions = {
    url: client.endPoint + config.apis.locales,
    headers: {
      api_key: config.source_stack,
      authtoken: client.authtoken
    },
    qs: {
      include_count: true,
      asc: 'updated_at',
      query: {
        code: {
          '$nin': [master_locale.code]
        }
      },
      only: {
        BASE: ['uid', 'name', 'code']
      }
    },
    json: true
  };
  this.locales = {};
}


ExportLocales.prototype.start = function () {
  log.success(chalk.blue('Starting locale export'));
  var self = this;
  return when.promise(function (resolve, reject) {
    return request(self.requestOptions).then(function (res) {
      if (res.statusCode === 200) {
        if (res.body.locales.length !== 0) {
          log.success(chalk.green('Found ' + chalk.magenta(res.body.count) +
            ' locales in the Stack'));
          res.body.locales.forEach(function (locale) {
            log.success(chalk.green('Exported ' + locale.name +
              ' locale successfully'));
            for (var key in locale) {
              if (requiredKeys.indexOf(key) === -1) {
                delete locale.key;
              }
            }
            self.locales[locale.uid] = locale;
          });
          log.success(chalk.blue('All the locales have been exported successfully'));
        } else {
          log.success(chalk.yellow(
            'No locales, other than master-locale were found in the Stack'));
        }
        helper.writeFile(path.join(localesFolderPath, localeConfig.fileName), self.locales);
        return resolve();
      } else if (res.statusCode >= 500) {
        return self.start().then(resolve).catch(reject);
      } else {
        log.error(chalk.red('Ran into errors while exporting locales'));
        log.error(chalk.red(err || JSON.stringify(res.body)));
        return reject(err || res.body);
      }
    })
    .catch (function (error) { 
        log.error(chalk.red('Ran into errors while exporting locales'));
        log.error(chalk.red(err));
        return reject(err);
    });
  });
};

module.exports = new ExportLocales();
