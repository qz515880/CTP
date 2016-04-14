
var config = require('../config.json');
var mysql = require('mysql');

var client;
var client_s;
var requestConnectMySqlTime = 0;

var option = {
    host : config.mysql_weixin.host,
    port :  config.mysql_weixin.port, 
    user :  config.mysql_weixin.user, 
    password :  config.mysql_weixin.password,
    database :  config.mysql_weixin.database
}

var option_s = {
    host : config.mysql_weixin_s.host,
    port :  config.mysql_weixin_s.port, 
    user :  config.mysql_weixin_s.user, 
    password :  config.mysql_weixin_s.password,
    database :  config.mysql_weixin_s.database
}

function init()  {
    console.log('init db ');
	initClient();
    initClientS();
}

function initClient() {
    console.log('initClient [mysql db]option.host = ' + option.host);
    client = mysql.createConnection(option);
    client.connect(function (err) {
       if (err) {
            console.log('initClient [[mysql db]]error when connecting to db:requestConnectMySqlTime = ' + requestConnectMySqlTime + ';err = ', err);
            requestConnectMySqlTime++;
            setTimeout(initClient, 5*1000);// TODO :  if retry time over 3, need send mail
       }else {
            requestConnectMySqlTime = 0;
        }
    });

    client.on('error', function (err) {
        console.log('initClient db error', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') { // 如果是连接断开，自动重新连接
            initClient();
        }
    });
}

function initClientS() {
    console.log('initClientS [mysql db]option_s.host = ' + option_s.host);
    client_s = mysql.createConnection(option_s);
    client_s.connect(function (err) {
       if (err) {
            console.log('initClientS [[mysql db]]error when connecting to db:requestConnectMySqlTime = ' + requestConnectMySqlTime + ';err = ', err);
            requestConnectMySqlTime++;
            setTimeout(initClientS, 5*1000);// TODO :  if retry time over 3, need send mail
       }else {
            requestConnectMySqlTime = 0;
           }
    });

    client_s.on('error', function (err) {
        console.log('initClientS db error', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') { // 如果是连接断开，自动重新连接
            initClientS();
        }
    });
}

function getClient() {
    return client;
}

function getClientS() {
    return client_s;
}

exports.init = init;
exports.getClient = getClient;
exports.getClientS = getClientS;
