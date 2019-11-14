/*!
 * Contentstack Export
 * Copyright (c) 2019 Contentstack LLC
 * MIT Licensed
 */

var chalk = require('chalk')
var mkdirp = require('mkdirp')
var path = require('path')

var request = require('../util/request')
var app = require('../../app')
var helper = require('../util/helper')
var log = require('../util/log')

var config = app.getConfig()

var stackConfig = config.modules.stack

var stackFolderPath = path.resolve(config.data, stackConfig.dirName)
var stackContentsFile = path.resolve(stackFolderPath, stackConfig.fileName)

// Create asset folder
mkdirp.sync(stackFolderPath)

function ExportStack () {
  this.requestOption = {
    uri: config.host + config.apis.stacks,
    headers: config.headers,
    json: true
  }
}

ExportStack.prototype.start = function () {
  log.success(chalk.blue('Exporting stack details'))

  return new Promise((resolve, reject) => {
    return request(this.requestOption)
      .then((response) => {
        helper.writeFile(stackContentsFile, response.body.stack)
        log.success(chalk.green('Exported stack details successfully!'))
        return resolve()
      })
      .catch(reject)
  })
}

module.exports = new ExportStack()