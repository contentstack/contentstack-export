/*!
 * Contentstack Export
 * Copyright (c) 2019 Contentstack LLC
 * MIT Licensed
 */

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var Promise = require('bluebird');
var chalk = require('chalk');
var mkdirp = require('mkdirp');

var request = require('../util/request');
var app = require('../../app');
var helper = require('../util/helper');
var log = require('../util/log');

var config = app.getConfig();
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
    headers: config.headers,
    qs: {
      include_count: true,
      include_publish_details: true,
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
        }).catch(reject);
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
      url: config.host + config.apis.content_types + apiDetails.content_type + config.apis.entries +
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
      var entryPath = path.join(entryFolderPath, apiDetails.locale, apiDetails.content_type,
        response.body.entry.uid);
      mkdirp.sync(entryPath);
      helper.writeFile(path.join(entryPath, 'version-' + response.body.entry._version +
        '.json'), response.body.entry);
      log.success('Completed version backup of entry: ' + response.body.entry.uid +
        ', version: ' + response.body.entry._version + ', content type: ' + apiDetails.content_type
      );
      if (--apiDetails.version !== 0) {
        return self.getEntry(apiDetails)
          .then(resolve)
          .catch(reject);
      } else {
        return resolve();
      }
    }).catch(reject);
  });
};

exportEntries.prototype.getEntries = function (apiDetails) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var requestObject = _.cloneDeep(self.requestOptions);
    requestObject.uri = config.host + config.apis.content_types + apiDetails.content_type + config.apis.entries;
    if (typeof apiDetails.skip !== 'number') {
      apiDetails.skip = 0;
    }

    requestObject.qs = {
      locale: apiDetails.locale,
      skip: apiDetails.skip,
      limit: limit,
      include_count: true,
      include_publish_details: true,
      query: {
        locale: apiDetails.locale
      }
    };

    requestObject.qs['query'] = JSON.stringify(requestObject.qs.query)
    return request(requestObject).then(function (response) {
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
          }).catch(reject);
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
          return self.getEntries(apiDetails)
            .then(resolve)
            .catch(reject);
        }
      }
    }).catch(reject);
  });
};

module.exports = new exportEntries();