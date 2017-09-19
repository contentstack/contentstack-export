/**
 * External module Dependencies.
 */
var request   = require('request'),
    mkdirp    = require('mkdirp'),
    path      = require('path'),
    _         = require('lodash'),
    when      = require('when'),
    guard     = require('when/guard'),
    parallel  = require('when/parallel');
var async     = require('async');    

/**
 * Internal module Dependencies.
 */
var helper = require('../../libs/utils/helper.js');

var contentTypeConfig       = config.modules.contentTypes,
    contentTypesFolderPath  = path.resolve(config.data, contentTypeConfig.dirName),
    masterFolderPath        = path.resolve(config.data, 'master'),
    validKeys               = contentTypeConfig.validKeys;
    limit                   = 5

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
    this.priority                   = [];
    this.cycle                      = [];
    this.master                     = {};
    this.contentTypes               = {};

    this.requestOptions = {
        url: client.endPoint + config.apis.contentTypes,
        headers: {
            api_key: config.source_stack,
            authtoken: client.authtoken
        },
        qs: {
            skip:0,
            limit: 5,
            include_count: true, 
            asc: 'updated_at',
            relative_urls: true
        },
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
                    self.detectCycle(key);
                }
                for (var key in self.master) {
                    self.setPriority(key);
                    //self.cycle = [];
                }
                helper.writeFile(path.join(contentTypesFolderPath, '__priority.json'), self.priority);
                helper.writeFile(path.join(contentTypesFolderPath, '__master.json'), self.master);
                successLogger('Updated priority and reference/file field of Content Types.');
                resolve();
            })
            .catch(function(error){
                errorLogger(error);
                return reject();
            })
        })
    },
    getContentTypes: function(){
        var self = this;
            return when.promise(function(resolve, reject){
                self.getdetailcontentTypes(0)
                    .then(function(data){

                        var contenttypes = data.content_types
                        var totalRequests = Math.ceil(data.count/limit);


                if(totalRequests > 1){
                    var _getContenttype = [];

                    for(var i = 1; i < totalRequests; i++){
                    _getContenttype.push(function(i){
                            return function (cb){ 
                                self.getdetailcontentTypes(i*limit)
                                 .then(function (result) {
                                    return cb(null, result);
                                })};
                        }(i));
                    }  
                    async.series(_getContenttype, function (error, results) {
                        if(error)
                            throw error;
                        results.forEach(function (result) {
                            var result = result.content_types;
                        for(var i = 0, total = result.length; i < total; i++){
                            contenttypes = contenttypes.concat(result[i]);
                        }
                        
                        successLogger(contenttypes.length, "ContentTypes Found.");
                        var contenttype = JSON.stringify(contenttypes)
                        self.putContentTypes(contenttypes)
                        .then(function(results){
                            successLogger( results.length, " ContentTypes downloaded.");
                            resolve();
                        })
                        .catch(function(err){
                            errorLogger(err)
                            reject();
                        });
                        })
                    });
                    return 0;
                     


                } else{   

                    self.putContentTypes(contenttypes)
                    .then(function(results){
                            successLogger( results.length, " contenttypes/s downloaded.");
                            resolve();
                        }).catch(function (err) {
                             errorLogger(err)
                             reject()
                        })
                       
                }

        })
         .catch(function(e){
                    errorLogger(e);
                    resolve(e);
            });
     });
    },

    getdetailcontentTypes: function(skip){
        var self = this;
        self.requestOptions.qs.skip = skip; 
        return when.promise(function (resolve, reject) {
                    self.requestOptions.qs.skip = skip; 
                    request(self.requestOptions, function (err, res, body) {  

                if (!err && res.statusCode == 200 && body && body.content_types && body.content_types.length) {
                    /*successLogger(body.count, 'content types found.');
                    self.putContentTypes(body);*/
                    resolve(body);
                } if(body.content_types && body.content_types.length == 0) {
                    successLogger("No assets found.");
                    resolve(body);
                }  else {
                    reject(err);
                }
            });
        });

     },

    putContentTypes: function(body){

        var self = this;
         return when.promise(function (resolve, reject) {
            var _contenttype = [];

                 for (var i = 0, total = body.length; i < total; i++) {


                    var contentType = {},
                        temp = {
                            uid: '',
                            references: [],
                            fields: {
                                file: [],
                                reference: []
                            }
                        };
                    
                    for (var j = 0; j < validKeys.length; j++) {
                        contentType[validKeys[j]] = body[i][validKeys[j]];

                        if (validKeys[j] == 'uid') {
                            temp['uid'] = contentType['uid'];
                        } else if (validKeys[j] == 'schema') {
                            temp['references'] = getFileFields(contentType['schema']);
                            self.getReferenceAndFileFields(contentType['schema'], temp);
                        }
                    }
                
                helper.writeFile(path.join(contentTypesFolderPath, contentType['uid'] + '.json'), contentType);
                self.master[contentType['uid']] = temp;

                _contenttype.push(contentType);
              

            }
            resolve(_contenttype)
    
       
    });
   
    },
    getReferenceAndFileFields: function(schema, temp){
        if (schema) {
            for (var i = 0, total = schema.length; i < total; i++) {
                switch (schema[i]['data_type']) {
                   /* case 'reference':
                        (temp['references'].indexOf(schema[i]['reference_to']) == -1) ? temp['references'].push(schema[i]['reference_to']) : '';*/
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
        //self.cycle.push(content_type_uid);
        if (self.master[content_type_uid] && self.master[content_type_uid]['references'].length && self.priority.indexOf(content_type_uid) == -1) {
            for (var i = 0, total = self.master[content_type_uid]['references'].length; i < total; i++) {
               
                if (self.master[content_type_uid]['references'][i]['content_type_uid'] === content_type_uid){
                    console.log("inside")
                    //self.cycle = [];
                    continue;
                }
                self.setPriority(self.master[content_type_uid]['references'][i]['content_type_uid']);
            }
        }
        if (self.priority.indexOf(content_type_uid) == -1){

            self.priority.push(content_type_uid);
        }
    },
    detectCycle: function(content_type_uid) {
        try{
            var self = this;
            var refMapping = self.master;
            var seenObjects = [];
            var cyclicContentTypes = [];
            function detect (key) {
                seenObjects.push(key);
                refMapping[key]['references'].map(function(ref, index){
                    if(seenObjects.indexOf(ref.content_type_uid) == -1) {
                        detect(ref.content_type_uid);
                    } else {
                        self.master[key]['references'][index]['isCycle'] = true;
                        cyclicContentTypes.push(ref.content_type_uid);
                        return seenObjects;
                    }               
                })
            }
            detect(content_type_uid);
            return cyclicContentTypes;
        } catch(e){
            errorLogger(e)
        }
       
    }

};

String.prototype.isBlank = function() {
    return _.isNumber(this) ? false : _.isEmpty(this)
};


function getFileFields(schema){
   var references = [];

   var x = traverseSchemaWithPath(schema, function(path, entryPath, field) {
       if (field.data_type === 'reference') {
           getReferenceAndFileFields.push({uid: field.uid, path: path, entryPath: entryPath, content_type_uid: field.reference_to})
       }
   }, false);

   return references;
}

/*
  Find out file's
*/
function traverseSchemaWithPath(schema, fn, path, entryPath) {
   path = path || ''
   entryPath = entryPath || ''

   function getPath(uid) {
       return _.isEmpty(path) ? uid : [path, uid].join('.')
   }

   function getEntryPath(uid) {
       return _.isEmpty(entryPath) ? uid : [entryPath, uid].join('.')
   }

   var promises = schema.map(function(field, index) {
       var pth = getPath("schema["+index+"]")
        var entryPth = ""
       field.data_type === 'group' && field.multiple ? entryPth = getEntryPath(field.uid)+"[]" : entryPth = getEntryPath(field.uid)
       if (field.data_type === 'group') {
           return traverseSchemaWithPath(field.schema, fn, pth, entryPth)
       }

       return fn(pth, entryPth, field)
   })

   return _.flatten(_.compact(promises))
}



module.exports = ExportContentTypes;