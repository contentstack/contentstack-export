/* eslint-disable no-redeclare */
var Bluebird = require('bluebird');
var util = require('./lib/util');
var login = require('./lib/util/login');
var config = require('./config');
var log = require('./lib/util/log');

config = util.buildAppConfig(config)
let validate = util.validateConfig(config)
validate.then(() => {
  intialProcess().then(() => {
    return
  }).catch((error) => {
    log.error(error);
    return
  })
}).catch((error) => {
  log.error(error)
  return
})
exports.getConfig = function () {
  return config;
};

async function intialProcess() {
  return new Promise(function (resolve, reject) {
    login(config).then(function () {
      var types = config.modules.types;
      if (process.argv.length === 3) {
        var val = process.argv[2];

        if (val && types.indexOf(val) > -1) {
          var exportedModule = require('./lib/export/' + val);
          return exportedModule.start().then(function () {
            log.success(val + ' was exported successfully!');
            return resolve()
          }).catch(function (error) {
            log.error('Failed to migrate ' + val);
            log.error(error);
            return reject()
          })
        } else {
          log.error('Please provide valid module name.');
          return 0;
        }
      } else if (process.argv.length === 2) {
        var counter = 0;
        return Bluebird.map(types, function (type) {
          if (config.preserveStackVersion) {
            log.success('Exporting: ' + types[counter])
            var exportedModule = require('./lib/export/' + types[counter]);
            counter++
            return exportedModule.start()
          } else if (!config.preserveStackVersion && type !== 'stack') {
            log.success('Exporting: ' + types[counter])
            var exportedModule = require('./lib/export/' + types[counter]);
            counter++
            return exportedModule.start()
          } else {
            counter++
          }
        }, {
          concurrency: 1
        }).then(function () {
          log.success('Stack: ' + config.source_stack + ' has been exported succesfully!');
          return resolve()
        }).catch(function (error) {
          log.error('Failed to migrate stack: ' + config.source_stack + '. Please check error logs for more info');
          return reject(error)
        });

      } else {
        log.error('Only one module can be exported at a time.');
        return 0;
      }
    });
  })
}