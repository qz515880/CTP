var config = require('./config.json');
var redis = require('redis');


var username = config.redis.username;
var password = config.redis.password;
var redis_host = config.redis.redis_host;
var redis_port = config.redis.redis_port;
var redis_db_name =config.redis.redis_db_name;
var redis_options = {"no_ready_check":config.redis.no_ready_check};

var client;

function init() {
	console.log('init redis ... ... ');
	client = redis.createClient(redis_port, redis_host, redis_options);

	client.on("error", function (err) {
  		console.log("redis meet Error " + err + ';' + redis_host + ';' + redis_port);
  		setTimeout(init, 5*1000);	// 5秒后重连
	});
	client.auth(username + '-' + password + '-' + redis_db_name);
}

function setVaule(key, values) {
	client.set(key, values);
	
}

function getVaule(key, callback ) {
	client.get(key, function(err, redis_result) {
		callback(err, redis_result);
	});
}

/**
 * 设置缓存值，带失效时间
 */
function setValueWithExpire(key, values, expire) {
	client.set(key, values);
	client.expire(key, expire);	// 单位秒
}

init();

exports.init = init;
exports.setVaule = setVaule;
exports.getVaule = getVaule;
exports.setValueWithExpire = setValueWithExpire;