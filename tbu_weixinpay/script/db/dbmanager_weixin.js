function insertOrderInfo(client,option){
    var create_time=new Date().Format("yyyy-MM-dd hh:mm:ss:S");
    if(option.result==0){
        var url="insert into order_info (create_time,order_id,tbu_id,product_id,product_name,"+
        "price,ip,result,wx_prepayid,wx_order_id,wx_timestamp) value (?,?,?,?,?,?,?,?,?,?,?)";
        client.query(url,
         [create_time,option.order_id,option.tbu_id,option.product_id,
         option.product_name,option.price,option.ip,option.result,
         option.wx_prepayid,option.wx_order_id,option.wx_timestamp],
         function (err, results) {
            if (err) {
                console.log('insertOrderInfo meet'+err);
                return;
            }
        });
    }else{
        var url="insert into order_info (create_time,order_id,tbu_id,product_id,product_name,"+
        "price,ip,result) value (?,?,?,?,?,?,?,?)";
        client.query(url,
         [create_time,option.order_id,option.tbu_id,option.product_id,
         option.product_name,option.price,option.ip,option.result],
         function (err, results) {
            if (err) {
                console.log('insertOrderInfo meet'+err);
                return;
            }
        }); 
    }
    
}

/*
var option={
            result:0,
            order_id:"",
            wx_order_id:req.query.out_trade_no,
            price:req.query.total_fee,
            time_end:req.query.time_end
        }
*/

function updatePayCallBackInfo(client,option){
    var url="update order_info set pay_result=1,pay_money=?,wx_time_end=? "+
    "where order_id=? and wx_order_id=?";
        client.query(url,
         [option.price,option.time_end,option.order_id,
         option.wx_order_id],
         function (err, results) {
            if (err) {
                console.log('insertOrderInfo meet'+err);
                return;
            }
        });
}

function getPayResultByOrderId(client,wx_order_id,callback){
    var url='select * from order_info where wx_order_id=?';
    client.query(url,
         wx_order_id,
         function (err, results) {
            if (err) {
                console.log('insertOrderInfo meet'+err);
                callback(false);
                return;
            }

            callback(true,results[0].pay_result);

        });
}


exports.insertOrderInfo=insertOrderInfo;
exports.updatePayCallBackInfo=updatePayCallBackInfo;
exports.getPayResultByOrderId=getPayResultByOrderId;
