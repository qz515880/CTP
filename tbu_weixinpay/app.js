
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
    console.log('enter req.query.order_id='+req.query.order_id);
    if(req.query.order_id!=null&&req.query.order_id!=undefined&&
        req.query.tbu_id!=null&&req.query.tbu_id!=undefined&&
        req.query.product_id!=null&&req.query.product_id!=undefined&&
        req.query.product_name!=null&&req.query.product_name!=undefined&&
        req.query.price!=null&&req.query.price!=undefined){
        //返回接收信息
        order_id=req.query.order_id;
        var ip=noderice.getip(req);
        doPayRequest(req.query.order_id,req.query.tbu_id,req.query.product_id,
            'testpay',req.query.price,ip,res);
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
    if(req.query.return_code!=null&&req.query.return_code!=undefined&&
        req.query.return_code=="SUCCESS"){

        var option={
            result:0,
            order_id:"",
            wx_order_id:req.query.out_trade_no,
            price:req.query.total_fee,
            time_end:req.query.time_end
        }

        redishelper.getValue("WX_ORDER"+wx_order_id, function(err, redis_result) {

            if(err) {
                console.log('获取order_id出错：'+err);
                res.end('fail');
                return;
            }
            if(redis_result == null ) {
                console.log('获取order_id == null');
                res.end('fail');
                return ;
            }
            option.order_id=redis_result;
            sendPayCallback(option);
            res.end("ok");
            return;
        });
    }
    res.end('fail');
});




function sendPayCallback(option){
    var sendparam="result="+option.result+
    '&order_id='+option.order_id+
    '&wx_order_id='+option.wx_order_id+
    '&price='+option.price+
    '&time_end='+option.time_end
    ;

    var options={
        url:'http://114.119.39.150:1701/mr/wx/result?'+sendparam,
        timeout:6000,
        method:'GET'
    };

    request(options, function (error, response, body) {
        if (error) {
            console.log('error='+error);
            return ;
        }

        console.log('response.statusCode='+response.statusCode);
        console.log('response.body='+response.body);

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
    var data=getDataStr(nonce_str,out_trade_no,tbu_id,product_name,product_id,ip,price);

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
                    console.log('req result='+JSON.stringify(result));
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
                                wx_sign:sign,
                                wx_timestamp:timestamp
                            }
                            response.end(JSON.stringify(option));
                            //保存到redis里面
                            redishelper.setVaule("WX_ORDER"+out_trade_no,order_id);

                    }else{
                        var option={
                            result:103
                        }
                        response.end(JSON.stringify(option));
                    }
                });

      });
    }).on("error", function (err) {
        console.log(err.stack);
        var option={
            result:104
        }
        response.end(JSON.stringify(option));
    });
    reqVideo.write(data + '\n');
    reqVideo.end();


}



function getDataStr(nonce_str,out_trade_no,tbu_id,product_name,product_id,ip,price){
    //TODO:根据tbu_id获取各个key值

    var time_start=new Date().Format("yyyyMMddHHmmss");
    var notify_url="http://106.75.135.78:1504/fish/weixin/send/date";

    var sign="appid="+'wx884476f603eeb8be'+'&attach='+'tbuwx'+
            '&body='+product_name+'&mch_id='+'1318535301'+
            '&nonce_str='+nonce_str+'&notify_url='+notify_url+
            '&out_trade_no='+out_trade_no+'&product_id='+product_id+
            '&spbill_create_ip='+ip+'&time_start='+time_start+
            '&total_fee='+price+'&trade_type='+'APP'+
            '&key='+'12311qwertyuiopzaqxsw09876111542';

    console.log('sign='+sign);
    var signStr=tools.md5(sign).toUpperCase();
    console.log('signStr='+signStr);

    var data=
    '<xml>'+
    '<appid>wx884476f603eeb8be</appid>'+
    '<mch_id>1318535301</mch_id>'+
    '<nonce_str>'+nonce_str+'</nonce_str>'+
    '<body>'+product_name+'</body>'+
    '<attach>tbuwx</attach>'+
    '<out_trade_no>'+out_trade_no+'</out_trade_no>'+
    '<total_fee>'+price+'</total_fee>'+
    '<spbill_create_ip>'+ip+'</spbill_create_ip>'+
    '<notify_url>'+notify_url+'</notify_url>'+
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
