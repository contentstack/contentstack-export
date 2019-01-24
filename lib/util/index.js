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
  if (!config.access_token) {
    throw new Error('Kindly provide access_token');
  }
};

exports.buildAppConfig = function (config) {
  config = _.merge(defaultConfig, config)
  config.headers = {
    api_key: config.source_stack,
    access_token: config.access_token,
    'X-User-Agent': 'contentstack-import/v' + pkg.version
  };
  return config;
}