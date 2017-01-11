var winston     = require('winston');
var pathLib     = require('path');
var fs          = require('fs');
var slice       = Array.prototype.slice;

function makeSureLogsDir(dirPath){
    if(!fs.existsSync(dirPath)){
        try{
            fs.mkdirSync(dirPath);
        }catch(e){
        }
    }
}

function returnString(args) {
    var returnStr = "";
    if(args && args.length){
        returnStr = args.map(function(item){
            if(item )
            if(item && typeof(item) === "object"){
                return JSON.stringify(item);
            }
            return item;
        })
            .join('  ')
            .trim();
    }
    return returnStr;
}

var myCustomLevels = {
    levels: {
        error   : 0,
        warn    : 1,
        info    : 2,
        debug   : 3
    },
    colors: {
        info: 'blue',
        debug: 'green',
        warn: 'yellow',
        error: 'red'
    }
};

module.exports =  function(logfileName){

    var logsDir     =  ( __dirname  + '/logs' );
    makeSureLogsDir(logsDir);
    var logPath = pathLib.join(logsDir, logfileName + '.log');

    var transports = [
        new (winston.transports.File)({
            filename    : logPath,
            maxFiles    : 20,
            maxsize     : 1000000,
            tailable    : true,
            json        : true
        })
    ];

    transports.push(new (winston.transports.Console)());

    var logger = new (winston.Logger)({
        transports  : transports,
        levels      : myCustomLevels.levels
    });
//logger.addColors(myCustomLevels.colors);

    return {
        log : function(){
            var args = slice.call(arguments);
            var logString = returnString(args);
            if(logString){
                logger.log('info', logString);
            }
        },
        warn : function(){
            var args = slice.call(arguments);
            var logString = returnString(args);
            if(logString){
                logger.log('warn', logString);
            }
        },
        error : function(){
            var args = slice.call(arguments);
            var logString = returnString(args);
            if(logString){
                logger.log('error', logString);
            }
        },
        debug : function(){
            var args = slice.call(arguments);
            var logString = returnString(args);
            if(logString){
                logger.log('debug', logString);
            }
        }
    };
}