var chalk = require('chalk');
var sequence = require('when/sequence');

var createClient = require('./libs/utils/create-client');
var config = require('./config');
var log = require('./libs/utils/log');

var moduleExport;

createClient(config, function (client) {
  global.client = client;
  global.config = config;

  var modulesList = [
    'assets',
    'locales',
    'environments',
    'content_types',
    'entries'
  ];
  var _export = [];

  if (process.argv.length === 3) {
    var val = process.argv[2];
    if (val && modulesList.indexOf(val) > -1) {
      moduleExport = require('./libs/export/' + val + '.js');
      _export.push(function () {
        return moduleExport.start();
      });
    } else {
      log.error('Please provide valid module name.');
      return 0;
    }
  } else if (process.argv.length === 2) {
    for (var i = 0, total = modulesList.length; i < total; i++) {
      moduleExport = require('./libs/export/' + modulesList[i] + '.js');
      _export.push(
        (function (moduleExport) {
          return function () {
            return moduleExport.start();
          };
        })(moduleExport)
      );
    }
  } else {
    log.error('Only one module can be exported at a time.');
    return 0;
  }

  var taskResults = sequence(_export);
  taskResults.then(function () {
    log.success(chalk.blue('Stack with api key: ' + config.source_stack +
      ' has been exported succesfully!'));
  }).catch(function () {
    log.error(chalk.red('Failed to migrate stack: ' + config.source_stack +
      ' please check error logs for more info'));
  });
});
