var url = require('url');
var request = require('request');

module.exports =  function createClient(opts,callback){
    const client  = {};
    var config = opts;
    if(!opts.host) {
        errorLogger("Please define the host.");
        return;
    }
    if(!opts.port) {
        errorLogger("Please define the port.");
        return;
    }
    if(!opts.api_version) {
        warnLogger("Api version is not defined default selected as 'v2'.")
    }
    var urlObj  = {
        protocol:(opts.port && opts.port == 443)? "https:" : 'http:',
        hostname: opts.host,
        pathname: opts.api_version ? opts.api_version : "v2"
    };
    client.endPoint = url.format(urlObj);

    var options = {
        url: client.endPoint + opts.apis.userSession,
        json: {
            "user": {
                "email": opts.email,
                "password": opts.password,
                "tfa_token": opts.token
            }
        },
        method:"post"
    };
    request(options, function(err, res, body){
        if(!err && res.statusCode == 200 ){
            client.authtoken = body.user.authtoken;
            callback(client, config);
        } else {
            if(err){
                errorLogger(err);
            } else {
                errorLogger(body)
            }

        }
    });
};