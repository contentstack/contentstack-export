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

var environmentConfig = config.modules.environments;

var environmentsFolderPath = path.resolve(config.data, environmentConfig.dirName);

// Create folder for environments
mkdirp.sync(environmentsFolderPath);

function ExportEnvironments() {
  this.requestOptions = {
    url: client.endPoint + config.apis.environments,
    headers: {
      api_key: config.source_stack,
      authtoken: client.authtoken
    },
    qs: {
      include_count: true,
      asc: 'updated_at'
    },
    json: true
  };
  this.master = {};
  this.environments = {}
}


ExportEnvironments.prototype.start = function () {
  log.success(chalk.blue('Starting environment export'));
  var self = this;
  return when.promise(function (resolve, reject) {
    return request(self.requestOptions).then(function (res) {
      // if (err) {
      //   log.error(chalk.red('Ran into errors while exporting environments'));
      //   log.error(chalk.red(err));
      //   return reject(err);
      // }
      if (res.statusCode === 200) {
        if (res.body.environments.length !== 0) {
          log.success(chalk.green('Found ' + chalk.magenta(res.body.count) +
            ' environments in the Stack'));
          for (var i = 0, total = res.body.count; i < total; i++) {
            log.success(chalk.green('Exported ' + res.body.environments[i]['name'] +
              ' environment successfully'));
            var env_uid = res.body.environments[i]['uid'];
            self.master[env_uid] = '';
            self.environments[env_uid] = res.body.environments[i];
            delete self.environments[env_uid]['uid'];
            delete self.environments[env_uid]['SYS_ACL'];
          }
          helper.writeFile(path.join(environmentsFolderPath, environmentConfig.fileName), self.environments);
          log.success(chalk.blue('All the environments have been exported successfully'));
          return resolve();
        } else {
          log.success(chalk.yellow('No environments were found in the Stack'));
          return resolve();
        }
      } else if (res.statusCode >= 500) {
        return self.start().then(resolve).catch(reject);
      } else {
        log.error(chalk.red('Ran into errors while exporting environments'));
        log.error(chalk.red(err || JSON.stringify(body)));
        return reject(err || body);
      }
    });
  });
};


module.exports = new ExportEnvironments();
