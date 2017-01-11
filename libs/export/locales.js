/**
 * External module Dependencies.
 */
var request = require('request');
var mkdirp  = require('mkdirp');
var path    = require('path');
var when    = require('when');

/**
 * Internal module Dependencies.
 */
var helper = require('../../libs/utils/helper.js');

var localeConfig        = config.modules.locales,
    localesFolderPath   = path.resolve(config.data, localeConfig.dirName),
    masterFolderPath    = path.resolve(config.data, 'master');

mkdirp.sync(localesFolderPath);
mkdirp.sync(masterFolderPath);

/**
 *
 * @constructor
 */
function ExportLocales() {
    this.requestOptions = {
        url: client.endPoint + config.apis.locales,
        headers: {
            api_key: config.source_stack,
            authtoken: client.authtoken
        },
        qs: {
            include_count: true,
            asc: 'updated_at',
            query: {code: {"$nin": ["en-us"]}},
            only: {BASE: ['name', 'code']}
        },
        json: true
    };
    this.master = {};
    this.locales = {}
}


ExportLocales.prototype.start = function () {
    successLogger("Exporting locales...");
    var self = this;
    return when.promise(function (resolve, reject) {
        request(self.requestOptions, function (err, res, body) {
            if (!err && res.statusCode == 200 && body && body.locales && body.locales.length) {
                successLogger('Found : ', body.count,"locales.");
                for (var i = 0, total = body.count; i < total; i++) {
                    successLogger('Exported locale: ', body.locales[i]['name']);
                    self.master[body.locales[i]['uid']] = "";
                    self.locales[body.locales[i]['uid']] = body.locales[i];
                    delete self.locales[body.locales[i]['uid']]['uid'];
                }
                helper.writeFile(path.join(localesFolderPath, localeConfig.fileName), self.locales);
                helper.writeFile(path.join(masterFolderPath, localeConfig.fileName), self.master);
                resolve();
            } else if (body.locales && body.locales.length == 0 ) {
                successLogger("No locales found.")
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


module.exports = ExportLocales;