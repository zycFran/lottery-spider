var express = require('express');
var schedule = require('node-schedule');
var superagent = require('superagent');
var app = express();
var api = {
    double: {
        list: 'http://cp.mi.com/api/data?key=200250&size=1',
        detail: 'http://cp.mi.com/api/data?key=200300&lot_code=50'
    },
    three: {
        list: 'http://cp.mi.com/api/data?key=200251&size=1',
        detail: 'http://cp.mi.com/api/data?key=200300&lot_code=51'
    }
};
var api_save_remote = 'http://caibao918.com/r/shop/drawLotteries';

var current = {
    double: {
        issue_code: '2016040',
        issue_id: ''
    },
    three: {
        issue_code: '2016095',
        issue_id: ''
    }
};

// 手工触发
app.get('/double', function (req, res) {
    runTask('double', res);
});
// 手工触发
app.get('/3d', function (req, res) {
    runTask('three', res);
});
// 定时
scheduleCronstyle();

app.listen(3000, function () {
    console.log('app is listening at port 3000');
});

function runTask(type, res){
    getLatestPeriod(type, function(latest){
        if(!latest){
            console.log('fail');
            res && res.send('fail');
            return;
        }
        if(current[type]['issue_code'] == latest['issue_code']){
            console.log('no more update');
            res && res.send('no more update');
            return;
        }
        current[type]['issue_code'] = latest['issue_code'];
        current[type]['issue_id'] = latest['issue_id'];

        getLatestDetail(type, latest['issue_id'], function(detail){
            console.log('updated!');
            res && res.send('updated!');

            if(!detail){
                res && res.send('no detail');
                return;
            }
            saveNewPrize(detail, function(save_re){
                if(save_re.success){
                    res && res.send('updated!');
                }else{
                    res && res.send('update error!');
                }
            });
        });
    });
}

function getLatestPeriod(type, callback){
    superagent.get(api[type]['list']).end(function (err, sres) {
        var data = JSON.parse(sres.text);
        var list = data.msg;
        if(!list.length){
            callback(null);
            return;
        }
        callback(list[0])
    });
}
function getLatestDetail(type, issue_id, callback){
    superagent.get(api[type]['detail'])
            .query({issue_id: issue_id})
        .end(function (err, sres) {

        var data = JSON.parse(sres.text);
        callback(data.msg);
    });
}
function saveNewPrize(data, callback) {
    var pd = {lotteryDetail: []};
    var ball = data.opend_code.split('|');
    pd['lotteryNormalNums'] = ball[0].split(",");
    pd['lotteryLuckyNums'] = ball[1] || [];
    pd['periods'] = data.issue_code;

    pd['lotteryType'] = ball[1]?'SHUANSEQIU': 'THREED';

    pd['jackpots'] = data['accmulate_prize'];
    pd['totalBuyAmount'] = data['total_sales'];

    for(var i = 0;i < data['prize_info'].length; i ++){
        pd['lotteryDetail'].push({
            type: Number(data['prize_info'][i].level) - 1,
            amount: Number(data['bonus']) * 100,
            winCounts: Number(data['num'])
        })
    }
    superagent.post(api_save_remote)
        .send(pd)
        .end(function (err, sres) {
            var data = JSON.parse(sres.text);
            callback(data);
        });
}

function scheduleCronstyle(){
    // 每天的凌晨1点1分30秒触发 ：'30 1 1 * * *'
    // 每天的21:30触发 '0 30 21 * * *'
    schedule.scheduleJob('0 30 21 * * *', function(){
        var num = 0;
        var timer = setInterval(function(){
            runTask('double');
            num ++ ;
            if(num >= 10){
                clearInterval(timer);
            }
        }, 1000 * 60);
    });
    // 每天的20:40触发
    schedule.scheduleJob('0 40 20 * * *', function(){
        var num = 0;
        var timer = setInterval(function(){
            runTask('three');
            num ++ ;
            if(num >= 10){
                clearInterval(timer);
            }
        }, 1000 * 60);

    });
}
