var Bluebird = require('bluebird');
var config = require('./config');
var util = require('./lib/util')
var log = require('./lib/util/log');

util.validateConfig(config)
config = util.buildAppConfig(config)

var types = config.modules.types;

if (process.argv.length === 3) {
  var val = process.argv[2];
  if (val && modulesList.indexOf(val) > -1) {
    var exportedModule = require('./lib/export/' + val);
    return exportedModule.start().then(function () {
      log.success(val + ' was exported successfully!');
      return;
    }).catch(function (error) {
      log.error('Failed to migrate ' + val);
      log.error(error);
    })
  } else {
    log.error('Please provide valid module name.');
    return 0;
  }
} else if (process.argv.length === 2) {
  return Bluebird.map(types, function (type) {
    log.info('Exporting: ' + type)
    var exportedModule = require('./lib/export/' + val);
    return exportedModule.start()
  }, {
    concurrency: 1
  }).then(function () {
    log.success('Stack: ' + config.source_stack + ' has been exported succesfully!');
  }).catch(function (error) {
    log.error('Failed to migrate stack: ' + config.source_stack + ' please check error logs for more info');
    log.error(error);
  });
} else {
  log.error('Only one module can be exported at a time.');
  return 0;
}
