var url = require('url');
var request = require('request');
var chalk = require('chalk');

var log = require('./log');

module.exports = function createClient(opts, callback) {
  var self = this;
  console.log(chalk.green('Creating client..'));
  console.log(chalk.green('Validating config and connecting to Contentstack servers..'));
  var client = {};
  var config = opts;
  if (!opts.host) {
    log.error(chalk.red('Host/CDN end point is missing from config'));
    return;
  }
  if (!opts.port) {
    log.error(('Port value is missing from config'));
    return;
  }
  if (!opts.api_version) {
    log.warn(chalk.yellow('Stack version is not defined in config. Setting default version to v3'));
  }

  var urlObj = {
    protocol: (opts.port && opts.port == 443) ? 'https:' : 'http:',
    hostname: opts.host,
    pathname: opts.api_version ? opts.api_version : 'v3'
  };

  client.endPoint = url.format(urlObj);

  if (config.access_token) {
    client.authtoken = config.access_token;
    console.log(chalk.green('Using access_token to make calls'));
    return callback(client, config);
  } else {
    var options = {
      url: client.endPoint + opts.apis.userSession,
      json: {
        user: {
          email: opts.email,
          password: opts.password,
          tfa_token: opts.token
        }
      },
      method: 'POST'
    };

    return request(options, function (err, res, body) {
      if (err) {
        log.error('Failed to connect to Contentstack\n' + chalk.red((err || body)));
        process.exit(1);
      }
      if (res.statusCode === 200) {
        console.log(chalk.green('Contentstack account authenticated successfully!'));
        client.authtoken = body.user.authtoken;
        return callback(client, config);
      } else if (res.statusCode >= 500) {
        console.log(chalk.yellow('Retrying account validation..'));
        return self.createClient(opts, callback);
      } else {
        log.error('Failed to connect to Contentstack, due to:' + chalk.red(err || body));
        process.exit(1);
      }
    });
  }
};
