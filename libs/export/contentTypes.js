/**
 * External module Dependencies.
 */
var request   = require('request'),
    mkdirp    = require('mkdirp'),
    path      = require('path'),
    when      = require('when');

/**
 * Internal module Dependencies.
 */
var helper = require('../../libs/utils/helper.js');

var contentTypeConfig       = config.modules.contentTypes,
    contentTypesFolderPath  = path.resolve(config.data, contentTypeConfig.dirName),
    masterFolderPath        = path.resolve(config.data, 'master'),
    validKeys               = contentTypeConfig.validKeys;

/**
 * Create folders
 */
mkdirp.sync(contentTypesFolderPath);
mkdirp.sync(masterFolderPath);

/**
 *
 * @constructor
 */
function ExportContentTypes(){
    this.priority       = [];
    this.master         = {};
    this.contentTypes   = {};

    this.requestOptions = {
        url: client.endPoint + config.apis.contentTypes,
        headers: {
            api_key: config.source_stack,
            authtoken: client.authtoken
        },
        qs: {include_count: true, asc: 'updated_at'},
        json: true
    };
}

ExportContentTypes.prototype = {
    start: function(){
        var self = this;
        return when.promise(function(resolve, reject){
            self.getContentTypes()
            .then(function(results){
                for (var key in self.master) {
                    self.setPriority(key);
                }
                helper.writeFile(path.join(contentTypesFolderPath, '__priority.json'), self.priority);
                helper.writeFile(path.join(contentTypesFolderPath, '__master.json'), self.master);
                successLogger('Updated priority and reference/file field of Content Types.');
                resolve();
            })
            .catch(function(error){
                errorLogger(error);
                reject();
            })
        })
    },
    getContentTypes: function(){
        var self = this;
        return when.promise(function (resolve, reject) {
            request(self.requestOptions, function (err, res, body) {
                if (!err && res.statusCode == 200 && body && body.content_types && body.content_types.length) {
                    successLogger(body.count, 'content types found.');
                    self.putContentTypes(body);
                    resolve(body);
                } if(body.assets && body.assets.length == 0) {
                    successLogger("No assets found.");
                    resolve();
                }  else {
                    reject(err);
                }
            });
        });
    },
    putContentTypes: function(body){
        var self = this;
        for (var i = 0, total = body.count; i < total; i++) {
            var contentType = {},
                temp = {
                    uid: '',
                    references: [],
                    fields: {
                        file: [],
                        reference: []
                    }
                };
            for (var j = 0, jTotal = validKeys.length; j < jTotal; j++) {
                contentType[validKeys[j]] = body.content_types[i][validKeys[j]];
                if (validKeys[j] == 'uid') {
                    temp['uid'] = contentType['uid'];
                } else if (validKeys[j] == 'schema') {
                    self.getReferenceAndFileFields(contentType['schema'], temp);
                }
            }
            helper.writeFile(path.join(contentTypesFolderPath, contentType['uid'] + '.json'), contentType);
            self.master[contentType['uid']] = temp;
        }
    },
    getReferenceAndFileFields: function(schema, temp){
        if (schema) {
            for (var i = 0, total = schema.length; i < total; i++) {
                switch (schema[i]['data_type']) {
                    case 'reference':
                        (temp['references'].indexOf(schema[i]['reference_to']) == -1) ? temp['references'].push(schema[i]['reference_to']) : '';
                    case 'file':
                        (temp['fields'][schema[i]['data_type']].indexOf(schema[i]['uid']) == -1) ? temp['fields'][schema[i]['data_type']].push(schema[i]['uid']) : '';
                        break;
                    case 'group':
                        this.getReferenceAndFileFields(schema[i]['schema'], temp);
                }
            }
        }
    },
    setPriority: function(content_type_uid){
        var self = this;
        if (self.master[content_type_uid] && self.master[content_type_uid]['references'].length) {
            for (var i = 0, total = self.master[content_type_uid]['references'].length; i < total; i++) {
                if (self.master[content_type_uid]['references'][i] == content_type_uid){
                    continue;
                }
                self.setPriority(self.master[content_type_uid]['references'][i]);
            }
        }
        if (self.priority.indexOf(content_type_uid) == -1){
            self.priority.push(content_type_uid);
        }
    }
};

module.exports = ExportContentTypes;