/*!
 * Contentstack Export
 * Copyright (c) 2019 Contentstack LLC
 * MIT Licensed
 */

var mkdirp = require('mkdirp');
var path = require('path');
var chalk = require('chalk');

var request = require('../util/request');
var app = require('../../app')
var helper = require('../util/helper');
var log = require('../util/log');

var config = app.getConfig()
var labelConfig = config.modules.labels;
var invalidKeys = labelConfig.invalidKeys;
var labelsFolderPath = path.resolve(config.data, labelConfig.dirName);

// Create folder for labels
mkdirp.sync(labelsFolderPath);

function ExportLabels() {
    this.requestOptions = {
        url: config.host + config.apis.labels,
        headers: config.headers,
        qs: {
            include_count: true,
            asc: 'updated_at',
            except: {
                BASE: invalidKeys
            }
        },
        json: true
    };
    this.master = {};
    this.labels = {}
}

ExportLabels.prototype.start = function() {
    log.success(chalk.blue('Starting label export'));
    var self = this;
    return new Promise(function(resolve, reject) {
        return request(self.requestOptions).then(function(response) {
            if (response.body.labels.length !== 0) {
                response.body.labels = response.body.labels.sort((a, b) => a.parent.length - b.parent.length )
                for (var i = 0, total = response.body.count; i < total; i++) {
                    var labelUid = response.body.labels[i]['uid'];
                    self.master[labelUid] = '';
                    self.labels[labelUid] = response.body.labels[i];
                    delete self.labels[labelUid]['uid'];
                    delete self.labels[labelUid]['ACL'];
                }
                helper.writeFile(path.join(labelsFolderPath, labelConfig.fileName), self.labels);
                log.success(chalk.blue('All the labels have been exported successfully'));
                return resolve();
            } else {
                log.success(chalk.yellow('No labels were found in the Stack'));
                return resolve();
            }
        }).catch(reject);
    });
};

module.exports = new ExportLabels();
