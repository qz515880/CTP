
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var query = require("querystring");    //解析POST请求
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
    //console.log('enter req.query.order_id='+req.query.order_id);
    //console.log('enter req.query.product_name='+req.query.product_name);
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
    console.log(JSON.stringify(option));
    res.end(JSON.stringify(option));
});


//http://106.75.135.78:1801/weixin/pay/callback
app.get('/weixin/pay/callback',function(req,res){
    //console.log('req.query.return_code='+req.query.return_code);
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
            //TODO:更新数据库信息
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

        //console.log('response.statusCode='+response.statusCode);
        //console.log('response.body='+response.body);

        if(response.statusCode!='200'||body!='ok'){

            return;
        }


    });
}

/////////////////////
//AppID wx884476f603eeb8be
//AppSecret d03797961aec989b75f74a9d83c719f5
//app key:12311qwertyuiopzaqxsw09876111542
//统一下单：
//URL地址：https://api.mch.weixin.qq.com/pay/unifiedorder

function doPayRequest(order_id,tbu_id,product_id,product_name,price,ip,response){
    var nonce_str=tools.randomWord(false,30);
    var out_trade_no=orderidtool.createOrderId();
    var time_start=new Date().Format("yyyyMMddHHmmss");
    var data=getDataStr(time_start, nonce_str,out_trade_no,tbu_id,product_name,product_id,ip,price);

    var options = {
        hostname: 'api.mch.weixin.qq.com',
        path: '/pay/unifiedorder',
        port: 443,
        method: 'POST'
    };

    var reqVideo = https.request(options, function (res) {
        var body = "";
        res.on('data', function (data) { body += data; })
          .on('end', function () {
                var parseString = require('xml2js').parseString;
                parseString(body, function (err, result) {
                    //console.log('req result='+JSON.stringify(result));
                    if(result.xml.return_code=="FAIL"){
                        var option={
                            result:102
                        }
                        response.end(JSON.stringify(option));
                    }else if(result.xml.return_code=="SUCCESS"&&result.xml.result_code=="SUCCESS"){
                            var prepay_id=result.xml.prepay_id+"";
                            var sign=result.xml.sign+"";
                            var timestamp = Date.parse(new Date());
                            var newnonce_str =result.xml.nonce_str+"";
                            var option={
                                result:0,
                                wx_nonce_str:newnonce_str,
                                wx_prepayid:prepay_id,
                                wx_sign:getSignStrToClient(timestamp, newnonce_str, prepay_id),
                                wx_timestamp:timestamp
                            }
                            response.end(JSON.stringify(option));
                            //保存到redis里面
                            //redishelper.setVaule("WX_ORDER"+out_trade_no,order_id);
                            //设置实效时间，2个小时多10分钟［微信订单的实效时间是2个小时］
                           redishelper.setValueWithExpire(config.redisHEAD+out_trade_no,order_id,60*6*21);
                           //TODO:入数据库

                    }else{
                        var option={
                            result:103
                        }
                        response.end(JSON.stringify(option));
                    }
                });

      });
    }).on("error", function (err) {
        //console.log(err.stack);
        var option={
            result:104
        }
        response.end(JSON.stringify(option));
    });
    reqVideo.write(data + '\n');
    reqVideo.end();


}

function getSignStrToClient(timestamp, nonce_str,prepayid) {
  var sign="appid="+config.appid+'&noncestr='+nonce_str+'&package='+'Sign=WXPay'+
          '&partnerid='+config.mch_id+
          '&prepayid=' + prepayid +
          '&timestamp=' + timestamp +
          '&key='+config.appkey;
  //console.log('client sign='+sign);
  return tools.md5(sign).toUpperCase();
}

function getSignStr(time_start, nonce_str,out_trade_no,tbu_id,product_name,product_id,ip,price, notify_url) {

  var sign="appid="+config.appid+'&attach='+config.attach+
          '&body='+product_name+'&mch_id='+config.mch_id+
          '&nonce_str='+nonce_str+'&notify_url='+notify_url+
          '&out_trade_no='+out_trade_no+'&product_id='+product_id+
          '&spbill_create_ip='+ip+'&time_start='+time_start+
          '&total_fee='+price+'&trade_type='+'APP'+
          '&key='+config.appkey;

  //console.log('sign='+sign);
  return tools.md5(sign).toUpperCase();

}

function getDataStr(time_start, nonce_str,out_trade_no,tbu_id,product_name,product_id,ip,price){
    //TODO:根据tbu_id获取各个key值
    var signStr=getSignStr(time_start, nonce_str,out_trade_no,tbu_id,product_name,product_id,ip,price, config.notify_url);
    //console.log('signStr='+signStr);

    var data=
    '<xml>'+
    '<appid>'+config.appid+'</appid>'+
    '<mch_id>'+config.mch_id+'</mch_id>'+
    '<nonce_str>'+nonce_str+'</nonce_str>'+
    '<body>'+product_name+'</body>'+
    '<attach>'+config.attach+'</attach>'+
    '<out_trade_no>'+out_trade_no+'</out_trade_no>'+
    '<total_fee>'+price+'</total_fee>'+
    '<spbill_create_ip>'+ip+'</spbill_create_ip>'+
    '<notify_url>'+config.notify_url+'</notify_url>'+
    '<trade_type>APP</trade_type>'+
    '<product_id>'+product_id+'</product_id>'+
    '<time_start>'+time_start+'</time_start>'+
    '<sign>'+signStr+'</sign>'+
    '</xml>';

    return data;
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
