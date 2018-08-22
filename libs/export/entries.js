var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var Promise = require('bluebird');
var chalk = require('chalk');
var mkdirp = require('mkdirp');

var request = Promise.promisify(require('request'));

var config = require('../../config');
var helper = require('../utils/helper');
var log = require('../utils/log');

var entriesConfig = config.modules.entries;
var entryFolderPath = path.resolve(config.data, config.modules.entries.dirName);

var localesFilePath = path.resolve(config.data, config.modules.locales.dirName, config.modules.locales
  .fileName);
var schemaFilePath = path.resolve(config.data, config.modules.content_types.dirName, 'schema.json');
var invalidKeys = entriesConfig.invalidKeys;
var limit = entriesConfig.limit;
var content_types;
var locales;

function exportEntries() {
  this.requestOptions = {
    headers: {
      api_key: config.source_stack,
      authtoken: client.authtoken
    },
    qs: {
      include_count: true,
      limit: limit
    },
    json: true
  };
}

exportEntries.prototype.start = function () {
  var self = this;
  log.success(chalk.blue('Starting entry migration'));
  return new Promise(function (resolve, reject) {
    try {
      locales = helper.readFile(localesFilePath);
      var apiBucket = [];
      content_types = helper.readFile(schemaFilePath);
      if (content_types.length !== 0) {
        content_types.forEach(function (content_type) {
          if (Object.keys(locales).length !== 0) {
            for (var _locale in locales) {
              apiBucket.push({
                content_type: content_type.uid,
                locale: locales[_locale].code
              });
            }
          }
          apiBucket.push({
            content_type: content_type.uid,
            locale: config.master_locale.code
          });
        });
        return Promise.map(apiBucket, function (apiDetails) {
          return self.getEntries(apiDetails);
        }, {
          concurrency: 1
        }).then(function () {
          log.success(chalk.blue('Entry migration completed successfully'));
          return resolve();
        }).catch(function (error) {
          log.error(chalk.red('Entry migration failed due to the following reason: ' + error));
          return reject();
        });
      } else {
        log.success(chalk.blue('No content_types were found in the Stack'));
        return resolve();
      }
    } catch (error) {
      return reject(error);
    }
  });
};

exportEntries.prototype.getEntry = function (apiDetails) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var requestObject = {
      url: client.endPoint + config.apis.content_types + apiDetails.content_type + config.apis.entries +
      apiDetails.uid,
      method: 'GET',
      headers: self.requestOptions.headers,
      qs: {
        locale: apiDetails.locale,
        except: {
          BASE: invalidKeys
        },
        version: apiDetails.version
      },
      json: true
    };
    return request(requestObject).then(function (response) {
      if (response.statusCode === 200) {
        var entryPath = path.join(entryFolderPath, apiDetails.locale, apiDetails.content_type,
          response.body.entry.uid);
        mkdirp.sync(entryPath);
        helper.writeFile(path.join(entryPath, 'version-' + response.body.entry._version +
          '.json'), response.body.entry);
        log.success('Completed version backup of entry: ' + response.body.entry.uid +
          ', version: ' + response.body.entry._version + ', content type: ' + apiDetails.content_type
        );
        if (--apiDetails.version !== 0) {
          return self.getEntry(apiDetails).then(function () {
            return resolve();
          }).catch(function (error) {
            return reject(error);
          });
        } else {
          return resolve();
        }
      } else if (response.statusCode >= 500) {
        return self.getEntry(apiDetails).then(resolve).catch(reject);
      } else if (response.statusCode >= 400 && response.statusCode <= 499) {
        log.error(chalk.red('Entry not found. API request made: ' + JSON.stringify(
          requestObject), ' - API Details: ' + JSON.stringify(apiDetails)));
        log.error(chalk.black.bgWhite(JSON.stringify(response.error) || JSON.stringify(
          response.body)));
        return reject(response.error || response.body);
      }
    }).catch(function (error) {
      return reject(error);
    });
  });
};

exportEntries.prototype.getEntries = function (apiDetails) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var requestObject = _.cloneDeep(self.requestOptions);
    requestObject.uri = client.endPoint + config.apis.content_types + apiDetails.content_type + config.apis.entries;
    if (typeof apiDetails.skip !== 'number') {
      apiDetails.skip = 0;
    }

    requestObject.qs = {
      locale: apiDetails.locale,
      skip: apiDetails.skip,
      limit: limit,
      include_count: true
    };

    return request(requestObject).then(function (response) {
      if (response.statusCode === 200) {
        // /entries/content_type_uid/locale.json
        if (!fs.existsSync(path.join(entryFolderPath, apiDetails.content_type))) {
          mkdirp.sync(path.join(entryFolderPath, apiDetails.content_type));
        }
        var entriesFilePath = path.join(entryFolderPath, apiDetails.content_type, apiDetails.locale + '.json');
        var entries = helper.readFile(entriesFilePath);
        entries = entries || {};
        response.body.entries.forEach(function (entry) {
          entries[entry.uid] = entry;
        });
        helper.writeFile(entriesFilePath, entries);

        if (typeof config.versioning === 'boolean' && config.versioning) {
          for (var locale in locales) {
            // make folders for each language
            content_types.forEach(function (content_type) {
              // make folder for each content type
              var versionedEntryFolderPath = path.join(entryFolderPath, locales[locale].code,
                content_type.uid);
              mkdirp.sync(versionedEntryFolderPath);
            });
          }
          return Promise.map(response.body.entries, function (entry) {
            var entryDetails = {
              content_type: apiDetails.content_type,
              uid: entry.uid,
              version: entry._version,
              locale: apiDetails.locale
            };
            return self.getEntry(entryDetails).then(function () {
              return;
            }).catch(function (error) {
              throw error;
            });
          }, {
            concurrency: 1
          }).then(function () {

            if (apiDetails.skip > response.body.count) {
              log.success(chalk.green('Completed fetching ' + apiDetails.content_type +
                ' content type\'s entries in ' + apiDetails.locale + ' locale'));
              return resolve();
            } else {
              apiDetails.skip += limit;
              return self.getEntries(apiDetails).then(function () {
                return resolve();
              }).catch(function (error) {
                return reject(error);
              });
            }
          });
        } else {
          if (apiDetails.skip > response.body.count) {
            log.success(chalk.green('Completed exporting ' + apiDetails.content_type +
              ' content type\'s entries in ' + apiDetails.locale + ' locale'));
            return resolve();
          } else {
            apiDetails.skip += limit;
            return self.getEntries(apiDetails).then(function () {
              return resolve();
            }).catch(function (error) {
              return reject(error);
            });
          }
        }
      } else if (response.statusCode >= 500) {
        return self.getEntries(apiDetails).then(function () {
          return resolve();
        }).catch(function (error) {
          return reject(error);
        });
      } else if (response.statusCode >= 400 && response.statusCode <= 499) {
        log.error(chalk.red('Content not found'));
        log.error(chalk.black.bgWhite(JSON.stringify(response.body)));
        return resolve();
      } else {
        log.error(chalk.red('Something went wrong while exporting entries'));
        log.error(chalk.black.bgWhite(response.error || JSON.stringify(response.body)));
        return reject(response.error || response.body);
      }
    }).catch(function (error) {
      log.error(chalk.red('Unknown error while exporting entries'));
      log.error(chalk.black.bgWhite(error));
      return reject(error);
    });
  });
};

module.exports = new exportEntries();
