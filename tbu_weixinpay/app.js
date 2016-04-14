
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var query = require("querystring");
var request=require("request");
var schedule = require('node-schedule');
var urlencode=require('urlencode');
var noderice=require('noderice');
noderice.time_init();
var https = require("https");
var xml2js=require('xml2js');
var orderidtool=require('./script/orderidtool.js');
var tools=require('./script/tools.js');
var config=require('./script/config.json');
var redishelper = require('./script/redishelper.js');
redishelper.init();

var dbmanager=require('./script/db/dbmanager.js');
dbmanager.init();
var dbmanager_weixin=require('./script/db/dbmanager_weixin.js');


app.use(bodyParser.urlencoded({extended: true}));
app.set('port', config.app);


app.get('/', function(req, res) {
    console.log('ip = ' + req.connection.remoteAddress);
    res.type('text/plain');
    res.status(200);
    res.send('Welcome To tbu bgp look ... ...');
});

//http://106.75.135.78:1801/weixin/pay/order
//参数 order_id, tbu_id,product_id,product_name,price
app.get('/weixin/pay/order',function(req,res){
    console.log('enter req.query.order_id='+req.query.order_id);
    console.log('enter req.query.product_name='+req.query.product_name);
    if(req.query.order_id!=null&&req.query.order_id!=undefined&&
        req.query.tbu_id!=null&&req.query.tbu_id!=undefined&&
        req.query.product_id!=null&&req.query.product_id!=undefined&&
        req.query.product_name!=null&&req.query.product_name!=undefined&&
        req.query.price!=null&&req.query.price!=undefined){
        //返回接收信息
        order_id=req.query.order_id;
        var ip=noderice.getip(req);
        doPayRequest(req.query.order_id,req.query.tbu_id,req.query.product_id,
            req.query.product_name,req.query.price,ip,res);
        return;
    }

    var option={
        result:101
    }
    res.end(JSON.stringify(option));
});



//http://106.75.135.78:1801/weixin/pay/close?order_id=20160308122333&wx_order_id=201603101025551265
//http://106.75.135.78:1801/weixin/pay/close
//参数：wx_order_id：微信订单号 ；order_id:客户端订单号；tbu_id
//新的接口，需要带上tbu_id
app.get('/weixin/pay/closeorder',function(req,res){
    if(req.query.order_id!=null&&req.query.order_id!=undefined&&
        req.query.wx_order_id!=null&&req.query.wx_order_id!=undefined&&
        req.query.tbu_id!=null&&req.query.tbu_id!=undefined){
        //返回接收信息
        console.log('ip='+noderice.getip(req));
        if(noderice.getip(req)==''){
            //TODO:校验ip
           // return;
        }

        redishelper.getVaule(config.redisHEAD+req.query.wx_order_id, function(err, redis_result) {

                if(err||redis_result==null||redis_result=='') {
                    var option={
                        result:102,
                        msg:"查询订单出错"
                    }
                    console.log(JSON.stringify(option));
                    res.end(JSON.stringify(option));
                     return;
                }

                if(redis_result==req.query.order_id){
                    doPayCloseOrder(req.query.wx_order_id,req.query.tbu_id,res);
                    return;
                }

                var option={
                    result:103,
                    msg:"订单不匹配"
                }
                console.log(JSON.stringify(option));
                res.end(JSON.stringify(option));
                
        });
    }else{
        var option={
            result:101,
            msg:"参数校验失败"
        }
        console.log(JSON.stringify(option));
        res.end(JSON.stringify(option));
    }
});

function doPayCloseOrder(out_trade_no,tbu_id,response){
    var nonce_str=tools.randomWord(false,30);
    var config_option;
    if(parseInt(tbu_id)==201602){
       config_option = config.key_201602;
    }else if(parseInt(tbu_id)==201503){
       config_option = config.key_201503;
    }else if(parseInt(tbu_id)==201509){
       config_option = config.key_201509;
    }else if(parseInt(tbu_id)==201534){
       config_option = config.key_201534;
    }
    var data=getCloseDataStr(nonce_str,out_trade_no,config_option);
    var options = {
        hostname: 'api.mch.weixin.qq.com',
        path: '/pay/closeorder',
        port: 443,
        method: 'POST'
    };

    var reqVideo = https.request(options, function (res) {
        var body = "";
        res.on('data', function (data) { body += data; })
          .on('end', function () {
                var parseString = require('xml2js').parseString;
                parseString(body, function (err, result) {
                    console.log('req result='+JSON.stringify(result));
                    if(result.xml.return_code=="FAIL"){
                        var msgStr=result.xml.return_msg;
                        var option={
                            result:102, //0:表示成功 ；其他失败
                            msg:msgStr  //失败的时候，返回微信给的描述信息
                        }
                        response.end(JSON.stringify(option));
                    }else{
                            var err_code=result.xml.err_code;
                            var err_code_des=result.xml.err_code_des;
                            var result_code=result.xml.result_code;
                            if(result_code!=null&&result_code=="FAIL"){
                                var option={
                                    result:105,
                                    msg:err_code_des
                                }
                                response.end(JSON.stringify(option));
                            }else{
                                var option={
                                    result:0,
                                    msg:"取消订单成功"
                                }
                                response.end(JSON.stringify(option));
                            }                            
                    }
                });

      });
    }).on("error", function (err) {
        //console.log(err.stack);
        var option={
            result:104,
            msg:"请求失败"
        }
        response.end(JSON.stringify(option));
    });
    reqVideo.write(data + '\n');
    reqVideo.end();
}

function getCloseDataStr(nonce_str,out_trade_no,option){
    var signStr=getCloseSignStr(nonce_str,out_trade_no,option);
    console.log('signStr='+signStr);
    var data=
    '<xml>'+
    '<appid>'+option.appid+'</appid>'+
    '<mch_id>'+option.mch_id+'</mch_id>'+
    '<nonce_str>'+nonce_str+'</nonce_str>'+
    '<out_trade_no>'+out_trade_no+'</out_trade_no>'+
    '<sign>'+signStr+'</sign>'+
    '</xml>';
    return data;  
}

function getCloseSignStr(nonce_str,out_trade_no,option){
    var sign="appid="+option.appid+
          '&mch_id='+option.mch_id+
          '&nonce_str='+nonce_str+
          '&out_trade_no='+out_trade_no+
          '&key='+option.appkey;
    console.log('sign='+sign);
    return tools.md5(sign).toUpperCase();
}


app.get('/weixin/pay/query',function(req,res){
    if(req.query.order_id!=null&&req.query.order_id!=undefined&&
        req.query.wx_order_id!=null&&req.query.wx_order_id!=undefined){
        //返回接收信息
        console.log('ip='+noderice.getip(req));
        if(noderice.getip(req)==''){
            //TODO:校验ip
           // return;
        }

        redishelper.getVaule(config.redisHEAD+req.query.wx_order_id, function(err, redis_result) {

                if(err||redis_result==null||redis_result=='') {
                    var option={
                        result:102,
                        msg:"查询订单出错"
                    }
                    console.log(JSON.stringify(option));
                    res.end(JSON.stringify(option));
                     return;
                }

                if(redis_result==req.query.order_id){
                    queryPayResult(req.query.wx_order_id,res);
                    return;
                }

                var option={
                    result:103,
                    msg:"订单不匹配"
                }
                console.log(JSON.stringify(option));
                res.end(JSON.stringify(option));
                
        });
    }else{
        var option={
            result:101,
            msg:"参数校验失败"
        }
        console.log(JSON.stringify(option));
        res.end(JSON.stringify(option));
    }
});

function queryPayResult(wx_order_id,res){
    //get pay result
    dbmanager_weixin.getPayResultByOrderId(dbmanager.getClientS(),
        wx_order_id,function(success,result){
            if(success){
                if(result==1){
                    var option={
                        result:0,
                        msg:"支付成功"
                    }
                    res.end(JSON.stringify(option)); 
                }else{
                    var option={
                        result:1,
                        msg:"支付失败"
                    }
                    res.end(JSON.stringify(option)); 
                }
            }else{
                var option={
                    result:2,
                    msg:"查询订单失败"
                }
                res.end(JSON.stringify(option)); 
            }
        });

}


app.get('/weixin/pay/callback',function(req,res){
    if(req.query.return_code!=null&&req.query.return_code!=undefined&&
        req.query.return_code=="SUCCESS"){
        var option={
            result:0,
            order_id:"",
            wx_order_id:req.query.out_trade_no,
            price:req.query.total_fee,
            time_end:req.query.time_end
        }

        redishelper.getVaule(config.redisHEAD+option.wx_order_id, function(err, redis_result) {
            if(err) {
               // console.log('获取order_id出错：'+err);
                res.end('fail');
                //TODO:数据库中查询
                return;
            }
            if(redis_result == null ) {
                //console.log('获取order_id == null');
                res.end('fail');
                //TODO:数据库中查询
                return ;
            }
            option.order_id=redis_result;
            //更新数据库信息
            dbmanager_weixin.updatePayCallBackInfo(dbmanager.getClient(),option);
            //TODO:推送消息回去
            sendPayCallback(option);
            res.end("ok");
            return;
        });
    }else{
        res.end('fail');
    }
    
});




function sendPayCallback(option){
    var sendparam="result="+option.result+
    '&order_id='+option.order_id+
    '&wx_order_id='+option.wx_order_id+
    '&price='+option.price+
    '&time_end='+option.time_end
    ;

    var options={
        url:config.PayCallbackurl+sendparam,
        timeout:6000,
        method:'GET'
    };

    request(options, function (error, response, body) {
        if (error) {
            console.log('error='+error);
            return ;
        }
        if(response.statusCode!='200'||body!='ok'){
            return;
        }
    });
}

//统一下单：
//URL地址：https://api.mch.weixin.qq.com/pay/unifiedorder
function doPayRequest(order_id,tbu_id,product_id,product_name,price,ip,response){
    console.log('start doPayRequest');
    var nonce_str=tools.randomWord(false,30);
    var out_trade_no=orderidtool.createOrderId();
    var time_start=new Date().Format("yyyyMMddHHmmss");
    var config_option;
    if(parseInt(tbu_id)==201602){
        config_option=config.key_201602;
    }else if(parseInt(tbu_id)==201503){
        config_option=config.key_201503;
        console.log('config_option.appid='+config_option.appid);
    }else if(parseInt(tbu_id)==201509){
        config_option=config.key_201509;
        console.log('config_option.appid='+config_option.appid);
    }else if(parseInt(tbu_id)==201534){
        config_option=config.key_201534;
        console.log('config_option.appid='+config_option.appid);
    }else{
        var option={
            result:106
        }
        response.end(JSON.stringify(option));
    }

    var data=getDataStr(time_start, nonce_str,out_trade_no,tbu_id,product_name,product_id,ip,price,config_option);
    console.log('data='+data);

    // 请求5秒超时
    var request_timer = null;
    var reqVideo=null;
    request_timer = setTimeout(function() {
        reqVideo.abort();
        console.log('Request Timeout.');
        var option={
            result:107
        }
        response.end(JSON.stringify(option));

        var order_info={
                order_id:order_id,
                tbu_id:tbu_id,
                product_id:product_id,
                product_name:product_name,
                price:price,
                ip:ip,
                result:107
        };
        dbmanager_weixin.insertOrderInfo(dbmanager.getClient(),order_info);
    }, 6000);

    var options = {
        hostname: 'api.mch.weixin.qq.com',
        path: '/pay/unifiedorder',
        port: 443,
        method: 'POST'
    };

    reqVideo = https.request(options, function (res) {
        var body = "";
        clearTimeout(request_timer);
        res.on('data', function (data) { body += data; })
          .on('end', function () {
                clearTimeout(request_timer);
                var parseString = require('xml2js').parseString;
                parseString(body, function (err, result) {
                    console.log('req result='+JSON.stringify(result));
                    if(result.xml.return_code=="FAIL"){
                        var option={
                            result:102
                        }
                        response.end(JSON.stringify(option));
                        var order_info={
                                order_id:order_id,
                                tbu_id:tbu_id,
                                product_id:product_id,
                                product_name:product_name,
                                price:price,
                                ip:ip,
                                result:102
                        };
                        dbmanager_weixin.insertOrderInfo(dbmanager.getClient(),order_info);

                    }else if(result.xml.return_code=="SUCCESS"&&result.xml.result_code=="SUCCESS"){
                            var prepay_id=result.xml.prepay_id+"";
                            var sign=result.xml.sign+"";
                            var timestamp = Date.parse(new Date());
                            var newnonce_str =result.xml.nonce_str+"";
                            var option={
                                result:0,
                                wx_nonce_str:newnonce_str,
                                wx_prepayid:prepay_id,
                                wx_sign:getSignStrToClient(timestamp, newnonce_str, prepay_id,config_option),
                                wx_timestamp:timestamp,
                                wx_order_id:out_trade_no
                            }
                            response.end(JSON.stringify(option));
                            //保存到redis里面
                            //redishelper.setVaule("WX_ORDER"+out_trade_no,order_id);
                            //设置实效时间，2个小时多10分钟［微信订单的实效时间是2个小时］
                           redishelper.setValueWithExpire(config.redisHEAD+out_trade_no,order_id,60*6*21);
                           //TODO:入数据库
                           //order_id,tbu_id,product_id,product_name,price,ip
                           var order_info={
                                order_id:order_id,
                                tbu_id:tbu_id,
                                product_id:product_id,
                                product_name:product_name,
                                price:price,
                                ip:ip,
                                result:0,
                                wx_prepayid:prepay_id,
                                wx_order_id:out_trade_no,
                                wx_timestamp:timestamp,
                            };

                            dbmanager_weixin.insertOrderInfo(dbmanager.getClient(),order_info);

                    }else{
                        var option={
                            result:103
                        }
                        response.end(JSON.stringify(option));
                        var order_info={
                                order_id:order_id,
                                tbu_id:tbu_id,
                                product_id:product_id,
                                product_name:product_name,
                                price:price,
                                ip:ip,
                                result:102
                        };
                        dbmanager_weixin.insertOrderInfo(dbmanager.getClient(),order_info);
                    }
                });

      });
    }).on("error", function (err) {
        var option={
            result:104
        }
        response.end(JSON.stringify(option));
        var order_info={
                order_id:order_id,
                tbu_id:tbu_id,
                product_id:product_id,
                product_name:product_name,
                price:price,
                ip:ip,
                result:104
        };
        dbmanager_weixin.insertOrderInfo(dbmanager.getClient(),order_info);
    });
    reqVideo.write(data + '\n');
    reqVideo.end();


}

function getSignStrToClient(timestamp, nonce_str,prepayid,option) {
    console.log('getSignStrToClient option.appid='+option.appid);
  var sign="appid="+option.appid+'&noncestr='+nonce_str+'&package='+'Sign=WXPay'+
          '&partnerid='+option.mch_id+
          '&prepayid=' + prepayid +
          '&timestamp=' + timestamp +
          '&key='+option.appkey;
  return tools.md5(sign).toUpperCase();
}

function getSignStr(time_start, nonce_str,out_trade_no,tbu_id,product_name,product_id,ip,price, option) {

  var sign="appid="+option.appid+'&attach='+option.attach+
          '&body='+product_name+'&mch_id='+option.mch_id+
          '&nonce_str='+nonce_str+'&notify_url='+option.notify_url+
          '&out_trade_no='+out_trade_no+'&product_id='+product_id+
          '&spbill_create_ip='+ip+'&time_start='+time_start+
          '&total_fee='+price+'&trade_type='+'APP'+
          '&key='+option.appkey;
  return tools.md5(sign).toUpperCase();
}

function getDataStr(time_start, nonce_str,out_trade_no,tbu_id,product_name,product_id,ip,price,option){
    //TODO:根据tbu_id获取各个key值
    var signStr=getSignStr(time_start, nonce_str,out_trade_no,tbu_id,product_name,product_id,ip,price,option);
    var data=
    '<xml>'+
    '<appid>'+option.appid+'</appid>'+
    '<mch_id>'+option.mch_id+'</mch_id>'+
    '<nonce_str>'+nonce_str+'</nonce_str>'+
    '<body>'+product_name+'</body>'+
    '<attach>'+option.attach+'</attach>'+
    '<out_trade_no>'+out_trade_no+'</out_trade_no>'+
    '<total_fee>'+price+'</total_fee>'+
    '<spbill_create_ip>'+ip+'</spbill_create_ip>'+
    '<notify_url>'+option.notify_url+'</notify_url>'+
    '<trade_type>APP</trade_type>'+
    '<product_id>'+product_id+'</product_id>'+
    '<time_start>'+time_start+'</time_start>'+
    '<sign>'+signStr+'</sign>'+
    '</xml>';

    return data;
}

//////////old version
//http://106.75.135.78:1801/weixin/pay/close?order_id=20160308122333&wx_order_id=201603101025551265
//http://106.75.135.78:1801/weixin/pay/close
//参数：wx_order_id：微信订单号 ；order_id:客户端订单号；tbu_id
app.get('/weixin/pay/close',function(req,res){
    if(req.query.order_id!=null&&req.query.order_id!=undefined&&
        req.query.wx_order_id!=null&&req.query.wx_order_id!=undefined){
        //返回接收信息
        console.log('ip='+noderice.getip(req));
        if(noderice.getip(req)==''){
            //TODO:校验ip
           // return;
        }

        redishelper.getVaule(config.redisHEAD+req.query.wx_order_id, function(err, redis_result) {

                if(err||redis_result==null||redis_result=='') {
                    var option={
                        result:102,
                        msg:"查询订单出错"
                    }
                    console.log(JSON.stringify(option));
                    res.end(JSON.stringify(option));
                     return;
                }

                if(redis_result==req.query.order_id){
                    doPayClose(req.query.wx_order_id,res);
                    return;
                }

                var option={
                    result:103,
                    msg:"订单不匹配"
                }
                console.log(JSON.stringify(option));
                res.end(JSON.stringify(option));
                
        });
    }else{
        var option={
            result:101,
            msg:"参数校验失败"
        }
        console.log(JSON.stringify(option));
        res.end(JSON.stringify(option));
    }
});


function doPayClose(out_trade_no,response){
    var nonce_str=tools.randomWord(false,30);
    var data=getCloseDataStr(nonce_str,out_trade_no,config.key_201602);
    var options = {
        hostname: 'api.mch.weixin.qq.com',
        path: '/pay/closeorder',
        port: 443,
        method: 'POST'
    };

    var reqVideo = https.request(options, function (res) {
        var body = "";
        res.on('data', function (data) { body += data; })
          .on('end', function () {
                var parseString = require('xml2js').parseString;
                parseString(body, function (err, result) {
                    console.log('req result='+JSON.stringify(result));
                    if(result.xml.return_code=="FAIL"){
                        var msgStr=result.xml.return_msg;
                        var option={
                            result:102, //0:表示成功 ；其他失败
                            msg:msgStr  //失败的时候，返回微信给的描述信息
                        }
                        response.end(JSON.stringify(option));
                    }else{
                        //{"xml":{"return_code":["SUCCESS"],
                        //"return_msg":["OK"],
                        //"appid":["wx884476f603eeb8be"],
                        //"mch_id":["1318535301"],
                        //"sub_mch_id":[""],
                        //"nonce_str":["bnDQ5QawJD1k1RDl"],
                        //"sign":["A1F70F2142A2EF386D13501DCB0148D6"],"result_code":["FAIL"],"err_code":["USERPAYING"],"err_code_des":["支付锁定中，扣款和撤销建议间隔10秒以上"]}}
                            
                            var err_code=result.xml.err_code;
                            var err_code_des=result.xml.err_code_des;
                            //var appid=result.xml.appid;
                            //var mch_id=result.xml.mch_id;
                            //var nonce_str=result.xml.nonce_str;
                            //var sign=result.xml.sign;
                            var result_code=result.xml.result_code;
                            if(result_code!=null&&result_code=="FAIL"){
                                var option={
                                    result:105,
                                    msg:err_code_des
                                }
                                response.end(JSON.stringify(option));
                            }else{
                                var option={
                                    result:0,
                                    msg:"取消订单成功"
                                }
                                response.end(JSON.stringify(option));
                            }
                            
                            //TODO:入数据库
                    }
                });

      });
    }).on("error", function (err) {
        //console.log(err.stack);
        var option={
            result:104,
            msg:"请求失败"
        }
        response.end(JSON.stringify(option));
    });
    reqVideo.write(data + '\n');
    reqVideo.end();
}


app.use(function (req, res) {
    res.type('text/plain');
    res.status(404);
    res.send('404 - NOT FOUND');
});

app.listen(app.get('port'), function() {
    var nowDate = new Date();
    console.log(nowDate.toLocaleDateString() + ' ' +
        nowDate.toLocaleTimeString() );
    console.log('express started on port :' + app.get('port'));
});
