/**
 * Created by Ninad Hatkar on 10-11-2016.
 */

/**
 * External module Dependencies.
 */
var request = require('request'),
    path = require('path'),
    when = require('when'),
    guard = require('when/guard'),
    parallel = require('when/parallel'),
    sequence = require('when/sequence'),
    url = require('url');

/**
 * Internal module Dependencies.
 */
var helper = require('../../libs/utils/helper.js');

/**
 *
 * Deceleration
 */
var entriesConfig = config.modules.entries,
    entriesFolderPath = path.resolve(config.data, entriesConfig.dirName),
    localesFolderPath = path.resolve(config.data, config.modules.locales.dirName);
contentTypesFolderPath = path.resolve(config.data, config.modules.contentTypes.dirName),
    masterEntriesFolderPath = path.resolve(config.data, 'master', 'entries'),
    masterFolderPath = path.resolve(config.data, 'master'),
    invalidKeys = entriesConfig.invalidKeys,
    limit = entriesConfig.limit,
    base_locale = config.base_locale;


/**
 * Create required folders
 */
helper.makeDirectory(entriesFolderPath, masterFolderPath, masterEntriesFolderPath);

/**
 *
 * @constructor
 */
function ExportEntries() {
    this.priority = [];
    this.master = {};
    this.entries = {};

    this.requestOptions = {
        headers: {
            api_key: config.source_stack,
            authtoken: client.authtoken
        },
        qs: {include_count: true, skip: 0, limit: limit},
        json: true
    };

}


/**
 *
 * @param contentType_uid
 * @param entry
 */
var filterAssetsInEntry = function (contentType_uid, entry) {
    for (var key in entry) {
        if (typeof entry[key] == "object" && entry[key]) {
            if (entry[key].hasOwnProperty('uid') && entry[key].hasOwnProperty('filename') && entry[key].hasOwnProperty('content_type') && entry[key].hasOwnProperty('file_size')) {
                entry[key] = entry[key]['uid'];
            } else {
                filterAssetsInEntry(contentType_uid, entry[key]);
            }
        }
    }
};

/**
 *
 * @param entry
 * @returns {*}
 */
var filterEntry = function (entry) {
    var keys = Object.keys(entry);
    for (var i = 0, total = keys.length; i < total; i++) {
        if (keys[i] && invalidKeys.indexOf(keys[i]) > -1)
            delete entry[keys[i]];
    }
    return entry;
};

/**
 *
 * @type {{start: Function, getEntries: Function, getAllEntries: Function}}
 */
ExportEntries.prototype = {

    getEntries: function (options) {
        var self = this;
        return when.promise(function (resolve, reject) {
            const MAX_RETRY = 2;
            var retryCnt = 0;
            retryEntry();
            function retryEntry() {
                request(options, function (err, res, body) {
                    if (!err && res.statusCode == 200 && body && body.entries) {
                        return resolve(body);
                    } else {
                        if (retryCnt < MAX_RETRY) {
                            retryCnt += 1;
                            var currRetryIntervalMs = (1 << retryCnt) * 1000; //exponential back off logic
                            setTimeout(retryEntry, currRetryIntervalMs);
                        }
                        else {
                            if(err){
                                var errorcode = "'"+err.code+"'";
                                var RETRIABLE_NETWORK_ERRORS = ['ECONNRESET', 'ENOTFOUND', 'ESOCKETTIMEDOUT', 'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH', 'EPIPE', 'EAI_AGAIN'];
                                for(var i = 0;i<RETRIABLE_NETWORK_ERRORS.length;i++){
                                    if(RETRIABLE_NETWORK_ERRORS[i] == errorcode){
                                        var currRetryIntervalMs = (1 << retryCnt) * 1000; //exponential back off logic
                                        setTimeout(retryEntry, currRetryIntervalMs);
                                    }
                                    else{
                                        errorLogger('http request fail due to ',errorcode);
                                        reject(err)
                                    }
                                }
                            }
                            else {
                                errorLogger('request failed due to ',body)
                                reject(body)
                            }
                        }
                    }
                });
            }
        });
    },
    putEntries: function (data, entriesArray) {
        var self = this,
            contentTypePath = path.join(entriesFolderPath, data.contentType_uid);

        helper.makeDirectory(contentTypePath);
        var tempEntries = {};
        for (var i = 0, total = entriesArray.length; i < total; i++) {
            if (entriesArray[i] && entriesArray[i]['uid']) {
                tempEntries[entriesArray[i]['uid']] = filterEntry(entriesArray[i]);
                filterAssetsInEntry(data.contentType_uid, entriesArray[i]);
            }
        }
        self.entries[data.contentType_uid] = self.entries[data.contentType_uid] || {};
        self.entries[data.contentType_uid][data.locale_id] = self.entries[data.contentType_uid][data.locale_id] || {};

        var keys = Object.keys(tempEntries);

        for (var i = 0, total = keys.length; i < total; i++) {
            self.entries[data.contentType_uid][data.locale_id][keys[i]] = "";
        }
        helper.writeFile(path.join(masterEntriesFolderPath, data.contentType_uid + '.json'), self.entries[data.contentType_uid]);
        helper.writeFile(path.join(contentTypePath, data.locale_id + '.json'), tempEntries);
        successLogger(Object.keys(tempEntries).length, 'Entry/ies has been exported for "', data.contentType_uid, '" => ', data.locale_id, '" contentType.');
    },
    getAllEntriesOfContentType: function (content_type_uid, locale_id) {
        var self = this,
            options = self.requestOptions,
            entriesArray = [];

        options.url = client.endPoint + config.apis.contentTypes + "/" + content_type_uid + config.apis.entries;
        options.qs.locale = locale_id;
        options.qs.skip = 0;

        return when.promise(function (resolve, reject) {
            self.getEntries(options)
                .then(function (body) {
                    entriesArray = entriesArray.concat(body.entries);
                    var totalRequests = Math.ceil(body.count / limit);
                    if (totalRequests > 1) {
                        var _getEntries = [];
                        for (var i = 1; i < totalRequests; i++) {
                            _getEntries.push(function (i) {
                                return function () {
                                    var _options = options;
                                    _options.qs.skip = i * limit;
                                    return self.getEntries(_options)
                                };
                            }(i));
                        }
                        /*var guardTask = guard.bind(null, guard.n(1));
                         _getEntries = _getEntries.map(guardTask);*/
                        var taskResults = sequence(_getEntries);

                        taskResults
                            .then(function (results) {
                                var data = {
                                    contentType_uid: content_type_uid,
                                    locale_id: locale_id
                                }
                                for (var e in results) {
                                    entriesArray = entriesArray.concat(results[e].entries);
                                }
                                self.putEntries(data, entriesArray);
                                return resolve()
                            }).catch(function (e) {
                            reject(e);
                        });

                    } else {
                        var data = {
                            contentType_uid: content_type_uid,
                            locale_id: locale_id
                        }
                        self.putEntries(data, entriesArray);
                        return resolve()
                    }
                })
                .catch(function (error) {
                    errorLogger(error);
                    reject(error);
                })
        })

    },
    iterateContentTypes: function () {
        var self = this;
        return when.promise(function (resolve, reject) {
            var contentTypes = helper.readFile(path.join(contentTypesFolderPath, '__priority.json'));
            var _getEntries = [];
            if (contentTypes) {
                successLogger("Found", contentTypes.length, "content types", "and", Object.keys(self.locales).length, "locales.");
                for (var i = 0, total = contentTypes.length; i < total; i++) {
                    for (var key in self.locales) {
                        _getEntries.push(function (contentType_uid, locale_id) {
                            return function () {
                                return self.getAllEntriesOfContentType(contentType_uid, locale_id)
                            };
                        }(contentTypes[i], self.locales[key]['code']));
                    }
                }

                var taskResults = sequence(_getEntries);

                taskResults
                    .then(function (results) {
                        //self.putEntries(results);
                        return resolve(results);
                    });
            } else {
                errorLogger("Please export content types before exporting entries.");
                reject("Please export content types before exporting entries.")
            }

        });

    },
    start: function () {
        var self = this;
        this.locales = helper.readFile(path.join(localesFolderPath, config.modules.locales.fileName)) || {};
        this.locales['locale_key'] = base_locale;

        return when.promise(function () {
            self.iterateContentTypes()
                .catch(function (err) {
                    errorLogger(err)
                })
        })
    }
};

module.exports = ExportEntries;