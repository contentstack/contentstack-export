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
var validKeys = globalfieldsConfig.validKeys;
var limit = 100;


// Create folder for Global Fields
mkdirp.sync(globalfieldsFolderPath);
//delete config.headers['access_token'];

function ExportGlobalFields() {
  this.global_fields = [];
  this.requestOptions = {
    url: config.host + config.apis.globalfields,
    headers: config.headers,
    qs: {
      include_count: true,
      asc: 'updated_at',
      limit: limit
    },
    json: true
  };
  this.master = {};
  this.globalfields = {}
}


ExportGlobalFields.prototype = {
  start: function () {
    var self = this;
    log.success(chalk.blue('Starting Global Fields export'));
    return new Promise(function (resolve, reject) {
      try {
        return self.getGlobalFields().then(function () {
          return self.writeGlobalFields()
            .then(resolve)
            .catch(reject);
        }).catch(reject);
      } catch (error) {
        return reject(error);
      }
    });
  },
  getGlobalFields: function (skip) {
    var self = this;
    
    if (typeof skip !== 'number') {
      skip = 0;
      self.requestOptions.qs.skip = skip;
    } else {
      self.requestOptions.qs.skip = skip;
    }

    return new Promise(function (resolve, reject) {
      return request(self.requestOptions).then(function (response) {
        //  console.log("response", response.body)
        try {
          if (response.body.global_fields.length === 0) {
            log.success(chalk.green('No Global Fields were found in the Stack'));
            return resolve();
          }
          response.body.global_fields.forEach(function (global_field) {
            for (var key in global_field) {
              if (validKeys.indexOf(key) === -1) {
                delete global_field[key];
              }
            }
            self.global_fields.push(global_field);
          });

          skip += limit;

          if (skip > response.body.count) {
            return resolve();
          } else {
            
            return self.getGlobalFields(skip)
              .then(resolve)
              .catch(reject);
          }
        } catch (error) {
          return reject(error);
        }
      }).catch(reject);
    });
  },
  writeGlobalFields: function () {
    var self = this;
    return new Promise(function (resolve) {
      helper.writeFile(path.join(globalfieldsFolderPath,globalfieldsConfig.fileName), self.global_fields);
      log.success(chalk.blue('Global Fields export completed successfully'));
      return resolve();
    });
  }
};

module.exports = new ExportGlobalFields();
