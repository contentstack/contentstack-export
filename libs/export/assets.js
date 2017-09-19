/**
 * External module Dependencies.
 */
var request   = require('request'),
    mkdirp    = require('mkdirp'),
    path      = require('path'),
    when      = require('when'),
    guard     = require('when/guard'),
    parallel  = require('when/parallel'),
    fs        = require('fs');

/**
 * Internal module Dependencies.
 */
var helper = require('../../libs/utils/helper.js');

var assetConfig         = config.modules.assets,
    validKeys           = assetConfig.validKeys,
    limit               = assetConfig.limit,
    assetsFolderPath    = path.resolve(config.data, assetConfig.dirName),
    masterFolderPath    = path.resolve(config.data, 'master');

/**
 * Create folders
 */
mkdirp.sync(assetsFolderPath);
mkdirp.sync(masterFolderPath);

function ExportAssets() {
    this.master     = {};
    this.urlMaster  = {};
    this.assets     = {};
    this.count      = 0;
    this.requestOptions = {
        url: client.endPoint + config.apis.assets,
        qs: {
            skip:0,
            limit: limit,
            asc: "updated_at",
            relative_urls: true,
            include_count: true
        },
        headers: {
            api_key: config.source_stack,
            authtoken: client.authtoken
        },
        json: true
    };
}

ExportAssets.prototype = {
    setStatus: function(asset_uid, status) {
        var self = this;
        var tempAssets = helper.readFile(path.join(assetsFolderPath, assetConfig.fileName));
        if(tempAssets && tempAssets[asset_uid])
            tempAssets[asset_uid]['status'] = status;
        helper.writeFile(path.join(assetsFolderPath, assetConfig.fileName), tempAssets);
    },
    getAssets: function(skip) {
        var self = this;
        self.requestOptions.qs.skip = skip;
        return when.promise(function (resolve, reject) {  
            self.requestOptions.qs.skip = skip; 
            request(self.requestOptions, function (err, res, body) {

                if (!err && res.statusCode == 200 && body.assets && body.assets.length) {
                    resolve(body);
                } if(body.assets && body.assets.length == 0){
                    successLogger("No assets found.");
                    resolve();
                }  else {
                    if (!err) {
                        reject(body);
                    } else {
                        reject(err);
                    }
                }
            });
        });
    },

    putAssets: function(assets) {
        var self = this;

        return when.promise(function(resolve, reject){

            for(var i = 0, total = assets.length; i < total; i++){
                assets[i]['status'] = false;
                assets[i]['url'] = assetConfig.host + assets[i]['url'];
                var temp = {};
                for(var j = 0; j < validKeys.length; j++) {
                    temp[validKeys[j]] = assets[i][validKeys[j]];
                }
                if(!self.assets[temp['uid']]) self.assets[temp['uid']] = temp;
                self.master[temp['uid']] = "";
                self.urlMaster[temp['url']] = "";
            }

            helper.writeFile(path.join(assetsFolderPath, assetConfig.fileName), self.assets);
            helper.writeFile(path.join(masterFolderPath, assetConfig.fileName), self.master);
            helper.writeFile(path.join(masterFolderPath, 'url_master.json'), self.urlMaster);

            var _getAsset = [];

            for(var i = 0, total = assets.length; i < total; i++) {
                _getAsset.push(function(data){
                    return function(){ return self.getAsset(data);};
                }(assets[i]));
            }

            var guardTask = guard.bind(null, guard.n(2));
            _getAsset = _getAsset.map(guardTask);

            var taskResults = parallel(_getAsset);

            taskResults
            .then(function(results) {
                resolve(results);
            })
            .catch(function(e){
                errorLogger('Failed to download assets: ', e);
                reject(e);
            });
        })
    },
    getAllAssets: function(){

        var self = this;
        return when.promise(function(resolve, reject){
            self.getAssets(0)
            .then(function(data){
                var assets = data.assets;
                var totalRequests = Math.ceil(data.count/limit);


                if(totalRequests > 1){
                    var _getAssets = [];
                    for(var i = 1; i < totalRequests; i++) {
                        _getAssets.push(function(i){
                            return function (){ return self.getAssets(i*limit)};
                        }(i));
                    }

                    var guardTask = guard.bind(null, guard.n(2));
                    _getAssets = _getAssets.map(guardTask);

                    var taskResults = parallel(_getAssets);

                    taskResults
                    .then(function(results) {
                        for(var i = 0, total = results.length; i < total; i++){
                            assets = assets.concat(results[i]['assets']);
                        }
                        successLogger(assets.length, "asset/s found.");
                        self.putAssets(assets)
                        .then(function(results){
                            successLogger( results.length, " asset/s downloaded.");
                            resolve();
                        })
                        .catch(function(err){
                            errorLogger(err)
                            reject();
                        });
                    });
                } else {
                    self.putAssets(assets)
                    .then(function(results){
                        successLogger( results.length, " asset/s downloaded.");
                        resolve()
                    })
                    .catch(function(err){
                        errorLogger(err)
                        reject()
                    });
                }
            })
            .catch(function(e){
                    errorLogger(e);
                    resolve(e);
            });
        })

    },
    getAsset :function(data) {
        
        var self = this;
        return function timeout(msec) {
            
        return when.promise(function (resolve, reject) {
            var out = request({url: data.url, headers: self.headers});
            out.on('response', function (res) {
                if (res.statusCode == 200 ) {
                    //successLogger('Downloading ', data.uid, 'with name "', data.filename, '" ...');
                    var assetFolderPath = path.resolve(assetsFolderPath, data.uid);
                    helper.makeDirectory(assetFolderPath);
                    var localStream = fs.createWriteStream(path.join(assetFolderPath, data.filename));
                    out.pipe(localStream);
                    localStream.on('close', function (){
                        self.setStatus(data.uid, true);
                        successLogger(self.count,': Downloaded', data.uid, 'with name "', data.filename, '" .');
                        self.count++;
                        resolve(data.uid);
                    });
                    localStream.on('error', function (err) {
                        self.setStatus(data.uid, false, err);
                        reject(err);
                    });
                } else {
                    self.setStatus(data.uid, false, res.statusCode);
                    reject(res.body);
                }
            });
            out.on('error', function (e) {
                var _error = "Error in media request: " + e.message + "\n Error: " + e.stack;
                errorLogger(_error);
                self.setStatus(data.uid, 0, _error);
                reject(_error);
            });
            out.end();
        }).timeout(1000);
    }
    },
    start :function() {
        successLogger("Exporting assets...");
        var self = this;
        return when.promise(function(resolve, reject){
            self.getAllAssets()
            .then(function(){
                resolve()
            })
            .catch(function(){
                reject()
            })
        })
    }
};

module.exports = ExportAssets;