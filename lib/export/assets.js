/*!
 * Contentstack Export
 * Copyright (c) 2019 Contentstack LLC
 * MIT Licensed
 */

var nativeRequest = require('request');
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var Promise = require('bluebird');
var _ = require('lodash');
var chalk = require('chalk');

var request = require('../util/request');
var app = require('../../app')
var helper = require('../util/helper');
var log = require('../util/log');

var config = app.getConfig();


var assetConfig = config.modules.assets;
var invalidKeys = assetConfig.invalidKeys;

// The no. of assets fetched and processed in a batch
var bLimit = assetConfig.batchLimit || 15;

// The no. of asset files downloaded at a time
var vLimit = assetConfig.downloadLimit || 3;
var assetsFolderPath = path.resolve(config.data, assetConfig.dirName);
var assetContentsFile = path.resolve(assetsFolderPath, 'assets.json');
var folderJSONPath = path.resolve(assetsFolderPath, 'folders.json');

// Create asset folder
mkdirp.sync(assetsFolderPath);

function ExportAssets () {
  this.assetContents = {};
  this.folderData = [];
  this.requestOption = {
    uri: config.host + config.apis.assets,
    qs: {
      skip: 0,
      limit: assetConfig.limit,
      asc: 'updated_at',
      relative_urls: true,
      include_count: true,
      include_publish_details: true,
      except: {
        BASE: invalidKeys
      }
    },
    headers: config.headers,
    json: true
  };
}

ExportAssets.prototype = {
  start: function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      return self.getAssetCount().then(function (count) {
        if (typeof count !== 'number' || count === 0) {
          log.success(chalk.yellow('There were no assets to be download'));
          return resolve();
        } else {
          var assetBatches = [];
          for (var i = 0; i <= count; i += bLimit) {
            assetBatches.push(i);
          }
          return Promise.map(assetBatches, function (batch) {
            return self.getAssetJSON(batch).then(function (assetsJSON) {
              return Promise.map(assetsJSON, function (assetJSON) {
                return self.getVersionedAssetJSON(assetJSON.uid, assetJSON._version).then(
                  function () {
                    self.assetContents[assetJSON.uid] = assetJSON;
                    log.success(chalk.green('The following asset has been downloaded successfully: ' +
                      assetJSON.uid));
                    return;
                  }).catch(function (error) {
                  log.error(chalk.red('The following asset failed to download\n' + JSON.stringify(
                    assetJSON)));
                  log.error(error);
                  return;
                });
              }, {
                concurrency: vLimit
              }).then(function () {
                log.success('Batch no ' + (batch + 1) + ' of assets is complete');
                helper.writeFile(assetContentsFile, self.assetContents);
                return;
              }).catch(function (error) {
                log.error('Asset batch ' + (batch + 1) + ' failed to download');
                log.error(error);
                // log this error onto a file - send over retries
                return;
              });
            }).catch(function (error) {
              return reject(error);
            });
          }, {
            concurrency: 1
          }).then(function () {
            return self.exportFolders().then(function () {
              log.success(chalk.green('Asset export completed successfully'));
              return resolve();
            }).catch(function (error) {
              return reject(error)
            });
          }).catch(function (error) {
            log.error(chalk.red('Asset export failed due to the following errrors ' + JSON.stringify(
              error)));
            return reject(error);
          });
        }
      }).catch(function (error) {
        // log.error(chalk.red('Failed to download assets due to the following error: ' + JSON.stringify(
        //   error)));
        return reject(error);
      });
    });
  },
  exportFolders: function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      return self.getAssetCount(true).then(function (fCount) {
        if (fCount === 0) {
          log.success('No folders were found in the stack!');
          return resolve();
        }
        return self.getFolderJSON(0, fCount).then(function () {
          // asset folders have been successfully exported
          log.success(chalk.green('Asset-folders have been successfully exported!'));
          return resolve();
        }).catch(function (error) {
          log.error(chalk.red('Error while exporting asset-folders!'));
          return reject(error)
        });
      }).catch(function (error) {
        // error while fetching asset folder count
        return reject(error);
      });
    });
  },
  getFolderJSON: function (skip, fCount) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (typeof skip !== 'number') {
        skip = 0;
      }
      if (skip >= fCount) {
        helper.writeFile(folderJSONPath, self.folderData);
        return resolve();
      }
      var _requestOption = {
        uri: self.requestOption.uri + '?include_folders=true&query={"is_dir": true}&skip=' + skip,
        method: 'GET',
        headers: self.requestOption.headers,
        json: true
      };

      return request(_requestOption).then(function (response) {
        response.body.assets.forEach(function (folder) {
          self.folderData.push(folder);
        });
        skip += 100;
        return self.getFolderJSON(skip, fCount)
          .then(resolve)
          .catch(reject);
      }).catch(reject);
    });
  },
  getAssetCount: function (folder) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var _requestOptions = _.cloneDeep(self.requestOption);
      delete _requestOptions.qs;
      if (folder && typeof folder === 'boolean') {
        _requestOptions.uri += '?include_folders=true&query={"is_dir": true}&count=true';
      } else {
        _requestOptions.qs = {
          count: true
        };
      }

      return request(_requestOptions).then(function (response) {
        return resolve(response.body.assets);
      }).catch(function (error) {
        if(error.body.errors.authorization || error.body.errors.api_key) {
          log.error(chalk.red('Api_key or management_token is not valid'))
        }
        return reject(error);
      });
    });
  },
  getAssetJSON: function (skip) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (typeof skip !== 'number') {
        skip = 0;
      }
      self.requestOption.qs = {
        skip: skip,
        limit: bLimit,
        include_publish_details: true,
        except: {
          BASE: invalidKeys
        }
      };

      return request(self.requestOption).then(function (response) {
        return resolve(response.body.assets);
      }).catch(reject);
    });
  },
  getVersionedAssetJSON: function (uid, version, bucket) {

    var self = this;
    var assetVersionInfo = bucket || [];
    return new Promise(function (resolve, reject) {
      if (version <= 0) {
        var assetVersionInfoFile = path.resolve(assetsFolderPath, uid, '_contentstack_' + uid + '.json');
        helper.writeFile(assetVersionInfoFile, assetVersionInfo);
        return resolve();
      } else {
        self.requestOptionversion = {
          uri: config.host + config.apis.assets + uid,
          headers: self.requestOption.headers,
          qs: {
            version: version,
            include_publish_details: true,
            except: {
              BASE: invalidKeys
            }
          },
          json: true
        };

        return request(self.requestOptionversion).then(function (response) {
          return self.downloadAsset(response.body.asset).then(function () {
            assetVersionInfo.splice(0, 0, response.body.asset);
            // Remove duplicates
            assetVersionInfo = _.uniqWith(assetVersionInfo, _.isEqual);
            return self.getVersionedAssetJSON(uid, --version, assetVersionInfo)
              .then(resolve)
              .catch(reject);
          }).catch(reject);
        }).catch(reject);
      }
    });
  },
  downloadAsset: function (asset) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var assetFolderPath = path.resolve(assetsFolderPath, asset.uid);
      var assetFilePath = path.resolve(assetFolderPath, asset.filename);
      if (fs.existsSync(assetFilePath)) {
        log.success('Skipping download of { title: ' + asset.filename + ', uid: ' +
          asset.uid + ' }, as they already exist');
        return resolve();
      }
      self.assetStream = {
        url: asset.url
      };

      var assetStreamRequest = nativeRequest(self.assetStream);
      assetStreamRequest.on('response', function () {
        helper.makeDirectory(assetFolderPath);
        var assetFileStream = fs.createWriteStream(assetFilePath);
        assetStreamRequest.pipe(assetFileStream);
        assetFileStream.on('close', function () {
          log.success(chalk.green('Downloaded ' + asset.filename + ': ' + asset.uid + ' successfully!'));
          return resolve();
        });
      }).on('error', reject)
    });
  },
  getFolders: function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      return self.getAssetCount(true).then(function (count) {
        if (count === 0) {
          log.success('No folders were found in the stack');
          return resolve();
        } else {
          return self.getFolderDetails(0, count).then(function () {
            log.success(chalk.green('Exported asset-folders successfully!'));
            return resolve();
          }).catch(function (error) {
            return reject(error);
          });
        }
      }).catch(function (error) {
        return reject(error);
      });
    });
  },
  getFolderDetails: function (skip, tCount) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (typeof skip !== 'number') {
        skip = 0;
      }
      if (skip > tCount) {
        helper.writeFile(folderJSONPath, self.folderContents);
        return resolve();
      }

      var _requestOptions = _.cloneDeep(self.requestOption);
      delete _requestOptions.qs;
      _requestOptions.uri += '?include_folders=true&query={"is_dir": true}&skip=' + skip;

      return request(_requestOptions).then(function (response) {
        for (var i in response.body.assets) {
          self.folderContents.push(response.body.assets[i]);
        }
        skip += 100;
        return self.getFolderDetails(skip, tCount)
          .then(resolve)
          .catch(reject);
      });
    });
  }
};

module.exports = new ExportAssets();