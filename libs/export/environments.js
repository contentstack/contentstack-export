/**
 * External module Dependencies.
 */
var request = require('request');
var mkdirp = require('mkdirp');
var path = require('path');
var when = require('when');

/**
 * Internal module Dependencies.
 */
var helper = require('../../libs/utils/helper.js');

var environmentConfig = config.modules.environments;

var environmentsFolderPath = path.resolve(config.data, environmentConfig.dirName);
var masterFolderPath = path.resolve(config.data, 'master');
mkdirp.sync(environmentsFolderPath);
mkdirp.sync(masterFolderPath);

/**
 *
 * @constructor
 */
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
    successLogger("Exporting environments...");
    var self = this;
    return when.promise(function (resolve, reject, notify) {
        request(self.requestOptions, function (err, res, body) {
            if (!err && res.statusCode == 200 && body && body.environments && body.environments.length) {
                for(var i = 0, total = body.count; i < total; i++){
                    successLogger('Found and exported locale: ', body.environments[i]['name']);
                    var env_uid = body.environments[i]['uid'];
                    self.master[env_uid] = "";
                    self.environments[env_uid] = body.environments[i];
                    delete self.environments[env_uid]['uid'];
                    delete self.environments[env_uid]['SYS_ACL'];
                }
                helper.writeFile(path.join(environmentsFolderPath, environmentConfig.fileName), self.environments);
                helper.writeFile(path.join(masterFolderPath, environmentConfig.fileName), self.master);
                successLogger('Total ', body.count, ' environment/s migrated.');
                resolve();
            } else if (body.environments && body.environments.length == 0 ) {
                successLogger("No environments found.")
                return resolve();
            } else {
                if(err){
                    errorLogger(err);
                    reject(err);
                } else {
                    errorLogger(body);
                    reject(body);
                }
            }
        });
    });

};


module.exports = ExportEnvironments;