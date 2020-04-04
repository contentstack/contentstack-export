/*!
 * Contentstack Export
 * Copyright (c) 2019 Contentstack LLC
 * MIT Licensed
 */

var mkdirp = require('mkdirp');
var path = require('path');
var chalk = require('chalk');
var Promise = require('bluebird');

var request = require('../util/request');
var app = require('../../app');
var helper = require('../util/helper');
var log = require('../util/log');

var config = app.getConfig()
var contentTypeConfig = config.modules.content_types;
var contentTypesFolderPath = path.resolve(config.data, contentTypeConfig.dirName);
var validKeys = contentTypeConfig.validKeys;

// Create folder for content types
mkdirp.sync(contentTypesFolderPath);

function ExportContentTypes () {
  this.content_types = [];

  this.requestOptions = {
    url: config.host + config.apis.content_types,
    headers: config.headers,
    qs: {
      include_count: true,
      asc: 'updated_at',
      limit: config.modules.content_types.limit,
      include_global_field_schema: true
    },
    json: true
  };
}

ExportContentTypes.prototype = {
  start: function () {
    var self = this;
    log.success(chalk.blue('Starting content type export'));
    return new Promise(function (resolve, reject) {
      try {
        return self.getContentTypes().then(function () {
          return self.writeContentTypes()
            .then(resolve)
            .catch(reject);
        }).catch(reject);
      } catch (error) {
        return reject(error);
      }
    });
  },
  getContentTypes: function (skip) {
    var self = this;
    if (typeof skip !== 'number') {
      skip = 0;
      self.requestOptions.qs.skip = skip;
    } else {
      self.requestOptions.qs.skip = skip;
    }

    return new Promise(function (resolve, reject) {
      return request(self.requestOptions).then(function (response) {

        try {
          if (response.body.content_types.length === 0) {
            log.success(chalk.green('No content types were found in the Stack'));
            return resolve();
          }
          response.body.content_types.forEach(function (content_type) {
            for (var key in content_type) {
              if (validKeys.indexOf(key) === -1) {
                delete content_type[key];
              }
            }
            self.content_types.push(content_type);
          });

          skip += config.modules.content_types.limit;
          if (skip > response.body.count) {
            return resolve();
          } else {
            return self.getContentTypes(skip)
              .then(resolve)
              .catch(reject);
          }
        } catch (error) {
          return reject(error);
        }
      }).catch(reject);
    });
  },
  writeContentTypes: function () {
    var self = this;
    return new Promise(function (resolve) {
      helper.writeFile(path.join(contentTypesFolderPath, 'schema.json'), self.content_types);
      self.content_types.forEach(function (content_type) {
        helper.writeFile(path.join(contentTypesFolderPath, content_type.uid + '.json'),
          content_type);
      });
      log.success(chalk.blue('Content type export completed successfully'));
      return resolve();
    });
  }
};

module.exports = new ExportContentTypes();
