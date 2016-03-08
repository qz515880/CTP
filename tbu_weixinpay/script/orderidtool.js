
var id_temp=0;//TODO:放缓存中获取

/**
*日期保证前17位，后四位用累加的id_temp，如果id_temp累加到10000，重置为0
*/
function createOrderId(){
	var time=new Date().Format("yyyyMMddhhmmssS");
	if(id_temp==100000){
    	id_temp=0;
    }
    
    id_temp++;
    return time+id_temp;
}

exports.createOrderId=createOrderId;
