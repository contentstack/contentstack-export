/**
 * External module Dependencies.
 */
//var request = require('request');
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var Promise = require('bluebird');
var _ = require('lodash');
/**
 * Internal module Dependencies.
 */
var request = require('../utils/request');
var config = require('../../config');
var helper = require('../utils/helper');
var log = require('../utils/log');

var assetConfig = config.modules.assets;
var invalidKeys = assetConfig.invalidKeys;
// The no. of assets fetched and processed in a batch
var bLimit = assetConfig.batchLimit || 15;
// The no. of asset files downloaded at a time
var vLimit = assetConfig.downloadLimit || 10;
var assetsFolderPath = path.resolve(config.data, assetConfig.dirName);
var assetContentsFile = path.resolve(assetsFolderPath, 'assets.json');
var folderJSONPath = path.resolve(assetsFolderPath, 'folders.json');

// Create asset folder
mkdirp.sync(assetsFolderPath);

function exportAssets() {
  this.assetContents = {};
  this.folderData = [];
  this.requestOption = {
    uri: client.endPoint + config.apis.assets,
    qs: {
      skip: 0,
      limit: assetConfig.limit,
      asc: 'updated_at',
      relative_urls: true,
      include_count: true,
      except: {
        BASE: invalidKeys
      }
    },
    headers: {
      api_key: config.source_stack,
      authtoken: client.authtoken
    },
    json: true
  };
}


exportAssets.prototype = {
  start: function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      return self.getAssetCount().then(function (count) {
        //console.log("conts", count)
        if (typeof count !== 'number' || count === 0) {
          log.success('There were no assets to be download');
          return resolve();
        } else {
          var assetBatches = [];
          for (var i = 0; i <= count; i += bLimit) {
            assetBatches.push(i);
          }

          //console.log("assetBatches",assetBatches)
          return Promise.map(assetBatches, function (batch) {
            return self.getAssetJSON(batch).then(function (assetsJSON) {             
              return Promise.map(assetsJSON, function (assetJSON) {
                return self.getVersionedAssetJSON(assetJSON.uid, assetJSON._version).then(function () {
                    self.assetContents[assetJSON.uid] = assetJSON;
                    log.success(
                      'The following asset has been downloaded successfully: ' +
                      assetJSON.uid);
                    return;
                  }).catch(function (error) {
                  log.error('The following asset failed to download\n' + JSON.stringify(
                    assetJSON));
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
              log.success('Asset export completed successfully');
              return resolve();
            }).catch(function (error) {
              throw error;
            });
          }).catch(function (error) {
            log.error('Asset export failed due to the following errrors ' + JSON.stringify(
              error));
            return reject(error);
          });
        }
      }).catch(function (error) {
        log.error('Failed to download assets due to the following error: ' + JSON.stringify(
          error));
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
          log.success('Asset-folders have been successfully exported!');
          return resolve();
        }).catch(function (error) {
          log.error('Error while exporting asset-folders!');
          throw error;
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
        // if (error) {
        //   return reject(error);
        // }

        if (response.statusCode === 200) {
          body.assets.forEach(function (folder) {
            self.folderData.push(folder);
          });
          skip += 100;
          return self.getFolderJSON(skip, fCount).then(function () {
            return resolve();
          }).catch(function (error) {
            return reject(error);
          });
        } else if (response.statusCode >= 500) {
          return self.getFolderJSON(skip, fCount).then(function () {
            return resolve();
          }).catch(function (error) {
            return reject(error);
          });
        } else {
          return reject(body);
        }
      }).catch(function (error) {
            log.error(error);
            return;
      });
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
        if (response.statusCode === 200) {
          return resolve(response.body.assets);
        } else if (response.statusCode >= 500) {
          if (folder && typeof folder === 'boolean') {
            return self.getAssetCount(folder).then(function (result) {
              return resolve(result);
            }).catch(function (error) {
              return reject(error);
            });
          } else {
            return self.getAssetCount().then(function (result) {
              return resolve(result);
            }).catch(function (error) {
              return reject(error);
            });
          }
        } else {
          return reject(body);
        }
    }).catch(function (error) {
      console.log(error)
        log.error(error);
        return;
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
        except: {
          BASE: invalidKeys
        }
      };

      return request(self.requestOption).then(function(response) {
       // console.log(response)
        if (response.statusCode === 200) {
          return resolve(response.body.assets);
        } else if (response.statusCode >= 500) {
          return self.getAssetJSON(skip).then(function (response) {
            return resolve(response);
          }).catch(function (error) {
            return reject(error);
          });
        } else {
          return reject(body);
        }

      }).catch(function(err){
        console.log(err)
        log.error(error)
      });
    });
  },

getVersionedAssetJSON: function (uid, version, bucket) {
    var self = this;
    //console.log("self", self)
    var assetVersionInfo = bucket || [];
    return new Promise(function (resolve, reject) {
      if (version <= 0) {
        var assetVersionInfoFile = path.resolve(assetsFolderPath, uid, '_contentstack_' + uid + '.json');
        helper.writeFile(assetVersionInfoFile, assetVersionInfo);
        return resolve();
      } else {
        //console.log("uid", uid)
        self.requestOptionversion = {
          uri: client.endPoint + config.apis.assets + uid,
          headers: self.requestOption.headers,
          qs: {
            version: version,
            except: {
              BASE: invalidKeys
            }
          },
          json: true
      };
        return request(self.requestOptionversion) .then(function (response) {
          if (response.statusCode === 200) {
            return self.downloadAsset(response.body.asset).then(function () {
              assetVersionInfo.splice(0, 0, response.body.asset);
              // Remove duplicates
              assetVersionInfo = _.uniqWith(assetVersionInfo, _.isEqual);
              return self.getVersionedAssetJSON(uid, --version, assetVersionInfo).then(function () {
                return resolve();
              }).catch(function (error) {
                // Error while downloading a particular version of an asset
                return reject(error);
              });
            }).catch(function (error) {
              return reject(error);
            });
          } else if (response.statusCode > 499 || response.statusCode < 400) {
            return self.getVersionedAssetJSON(uid, version, assetVersionInfo).then(function () {
              return resolve();
            }).catch(function (error) {
              // Error while downloading a particular version of an asset
              return reject(error);
            });
          } else {
            return reject();
          }
        }).catch(function (error) {
            // Error while downloading a particular version of an asset
           log.error(error)
           return reject(error);          
        });
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

      var assetStreamRequest = request(self.assetStream);
      assetStreamRequest.then(function (response) {
        if (response.statusCode === 200) {
          helper.makeDirectory(assetFolderPath);
          var assetFileStream = fs.createWriteStream(assetFilePath);
         // assetStreamRequest.pipe(assetFileStream);
          assetFileStream.on('close', function () {
            log.success('Successfully downloaded { file: ' + asset.filename + ', uid: ' +
              asset.uid + ' }');
            return resolve();
          });
        } else if (response.statusCode >= 500) {
          return self.downloadAsset(asset).then(function () {
            return resolve();
          });
        } else {
          log.error('Something went wrong while downloading asset: \n' + JSON.stringify(asset) +
            '\nRequest returned with the following response: ' + response.statusCode);
          return reject();
        }
      }).catch(function (error) {
                // Error while downloading a particular version of an asset
          log.error('Encountered error while downloading asset\n' + error);
          return reject();
        });
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
            log.success('Exported asset-folders successfully!');
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

      return request(_requestOptions, function (error, response, body) {
        if (error) {
          return reject(error);
        }
        if (response.statusCode === 200) {
          for (var i in body.assets) {
            self.folderContents.push(body.assets[i]);
          }
          skip += 100;
          return self.getFolderDetails(skip, tCount).then(function () {
            return resolve();
          }).catch(function (error) {
            return reject(error);
          });
        } else if (response.statusCode >= 500) {
          return self.getFolderDetails(skip, tCount).then(function () {
            return resolve();
          }).catch(function (error) {
            return reject(error);
          });
        } else {
          return reject(body);
        }
      });
    });
  }
};

module.exports = new exportAssets();
