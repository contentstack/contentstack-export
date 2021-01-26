/*!
* Contentstack Export
* Copyright (c) 2019 Contentstack LLC
* MIT Licensed
*/

var _ = require('lodash')
var pkg = require('../../package')
var defaultConfig = require('../../config/default')
var log = require('./log');

exports.validateConfig = async function (config) {
  return new Promise(async function (resolve, reject) {
    if (!config.host || !config.cdn) {
      return reject('Host/CDN end point is missing from config')
    }
    if (config.email) {
      if (await validateEmail(config.email) && config.password) {
      } else {
        return reject('Please Provide Valid credential')
      }
    } else if(config.email && !config.password || config.password && !config.email) {
      return reject('Please provide valid credential')
    }

    if (!config.email && !config.password && !config.management_token && !config.source_stack && !config.access_token) {
      return reject('Kindly provide source_stack and management_token, email and password or access_token')
    } else if (config.email && config.password && !config.access_token && !config.source_stack && !config.management_token) {
      return reject('Kindly provide source_stack and management_token or access_token')
    } else if (!config.email && !config.password && config.preserveStackVersion) {
      return reject('Kindly provide Email and password for stack details')
    } else if (!config.email && !config.password && config.source_stack && !config.access_token && !config.management_token || !config.source_stack && config.management_token) {
      return reject('Kindly provide Email and password or management_token or access_token')
    }
    return resolve()
  })
};

async function validateEmail(email) {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

exports.buildAppConfig = function (config) {
  config = _.merge(defaultConfig, config)
  config.headers = {
    api_key: config.source_stack,
    authorization: config.management_token,
    'X-User-Agent': 'contentstack-export/v' + pkg.version
  };
  return config;
}
