/*!
* Contentstack Export
* Copyright (c) 2019 Contentstack LLC
* MIT Licensed
*/

var _ = require('lodash')
var pkg = require('../../package')
var defaultConfig = require('../../config/default')

exports.validateConfig = function(config) {
  if (!config.host || !config.cdn) {
    throw new Error('Host/CDN end point is missing from config');
  }

  if(config.email && config.password && !config.access_token || !config.source_stack) {
    throw new Error('Kindly provide access_token or api_token');  
  } else if(!config.email && !config.password && !config.management_token && !config.source_stack && !config.access_token) {
    throw new Error('Kindly provide management_token or email and password');
  } else if(config.email && config.password && !config.access_token && config.source_stack) {
    throw new Error('Kindly provide access_token');
  } else if(!config.email && !config.password && config.preserveStackVersion) {
    throw new Error('Kindly provide Email and password for stack details');
  }
};

exports.buildAppConfig = function (config) {
  config = _.merge(defaultConfig, config)
  config.headers = {
    api_key: config.source_stack,
    authorization: config.management_token,
    // access_token: config.access_token,
    'X-User-Agent': 'contentstack-export/v' + pkg.version
  };
  return config;
}
