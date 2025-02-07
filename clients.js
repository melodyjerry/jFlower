const http = require('http');
const fs = require('fs');
var Utils = require('./utils');
//const { runTime } = require('./server');
//var runTime = require('./runtime');
const { Transform ,pipeline} = require('stream');

module.exports = {
  runTime: runTime.client,

  RSpool:{},//sendFile 的 rs对象池

  sendFile: function (ip, files, cb) {
    var _this = this;
    var runData = {};
    var file = files[0];
    let size = runData.total = fs.statSync(file.path).size;
    console.log('size:', size);
    runData.path = file.path;

    //文件名使用url转码，否则中文在header中会有问题
    var req = this.sender('file', ip, size, cb, {
      file_name: encodeURI(runData.name = file.name)
    });
    var rs = fs.createReadStream(file.path);
    runData.transferred = 0;
    runData.elapsed = 0;
    runData.startTime = (new Date()).getTime();
    runData.status = 'sending';
    // rs.on('data', function (chunk) {
    //   runData.transferred += chunk.length;
    //   runData.elapsed = new Date().getTime() - runData.startTime;
    //   //req.write(chunk);
    // });
    // rs.on('end', function () {
    //   console.log('end2:', (new Date()).getTime());
    //   req.end();
    //   //_this.runTime.fileSend = {startTime:0};
    // });
    // rs.on('error', function (err) {
    //   console.log('err:', err);
    //   runData.status = 'error';
    //   req.destroy(err);
    // });
    req.on('error', function (err) {
      console.log('err:', err);
      runData.status = 'error';
      rs.destroy(err);
    });
    req.on('finish', () => {
      console.log('finish2:', (new Date()).getTime());
      runData.status = 'completed';
      runTime.updHistory();
    });
    //rs.pipe(req);
    let transform = new Transform({
      transform(chunk, encoding, callback) {
          runData.transferred += chunk.length;
          runData.elapsed = (new Date()).getTime() - runData.startTime;
          callback(null,chunk);
      }
    });
    pipeline(
      rs,
      transform,
      req,
      (err) => {
        if (err) {
          console.log('err:', err);
          runData.status = 'error';
          runTime.updHistory();
          rs.destroy(err);
        } else {
          console.log('finish:', (new Date()).getTime());
          runData.status = 'completed';
          runTime.updHistory();
          //utools.outPlugin();
          utools.shellShowItemInFolder(target_file);
          req.end();
        }
      }
    );

    let key = runTime.addHistory({
      ip: ip,
      hostName: runTime.hosts[ip].hostName,
      id: '',
      type: 2, //1 from,2 to
      content: runData,
      contentType: 'file', //text file
      time: new Date().getTime()
    });
    _this.RSpool[key] = [rs,transform];
  },
  cancelFileSend:function(key){
    if(typeof this.RSpool[key][0] == "object"){
      this.RSpool[key][0].unpipe();
      this.RSpool[key][0].destroy(new Error('User canceled'));
    }
  },
  pauseFileSend:function(key){
    if(typeof this.RSpool[key][0] == "object"){
      this.RSpool[key][1].pause();
      this.RSpool[key][0].pause();
      let h = runTime.getHistory(key);
      if(h)
        h.content.status = 'paused';
    }
  },
  resumeFileSend:function(key){
    if(typeof this.RSpool[key][0] == "object"){
      this.RSpool[key][0].resume();
      this.RSpool[key][1].resume();
      let h = runTime.getHistory(key);
      if(h)
        h.content.status = 'sending';
    }
  },
  sendText: function (ip, text, cb) {
    var req = this.sender('text', ip, new Buffer(text).length, cb);console.log('444')
    req.write(text, 'utf8', () => {
      req.end();
    }); //
    runTime.addHistory({
      ip: ip,
      hostName: runTime.hosts[ip].hostName,
      id: '',
      type: 2, //1 from,2 to
      content: text,
      contentType: 'text', //text file
      time: new Date().getTime()
    });
  },
  /**
   * 这里只发送文件发送的询问，对方同意后会主动请求server端下载文件
   * @param {*} ip 
   * @param {*} files 
   * @param {*} cb 
   */
  sendFileAsk: function (ip, files, cb) {
    var _this = this;
    var runData = {};
    var file = files[0];
    let size = runData.total = fs.statSync(file.path).size;
    console.log('size:', size);
    runData.path = file.path;
    runData.token = Utils.md5(file.name + (new Date()).getTime());
    //文件名使用url转码，否则中文在header中会有问题
    var req = this.sender('fileAsk', ip, size, cb, {
      file_name: encodeURI(runData.name = file.name),
      token: runData.token
    });

    req.end();
    runData.transferred = 0;
    runData.elapsed = 0;

    runTime.addHistory({
      ip: ip,
      hostName: runTime.hosts[ip].hostName,
      id: '',
      type: 2, //1 from,2 to
      content: runData,
      contentType: 'fileAsk', //text file
      time: new Date().getTime()
    });
  },
  sendImg: function (ip, img, cb) {

    var req = this.sender('img', ip, img.length, cb)
    req.write(img, 'utf8', () => {
      req.end();
    }); //
    runTime.addHistory({
      ip: ip,
      hostName: runTime.hosts[ip].hostName,
      id: '',
      type: 2, //1 from,2 to
      content: img,
      contentType: 'img', //text file
      time: new Date().getTime()
    });
  },
  sender: function (type, ip, data_size, cb, headers) {
    
    const options = {
      hostname: ip,
      port: runTime.settings.targetPort,
      path: '/' + type,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data_size,
        //'Transfer-Encoding' : 'chunked',
        'cmd': type,
        'ip': Utils.getLocalIp(), //注意自定义header的值有符号要求
        'id': runTime.localId,
        'findingCode': runTime.settings.findingCode.code,//server接收到的是小写key：findingcode
      },
      timeout: 2000
    };
    if (headers) {
      for (let i in headers) {
        options.headers[i] = headers[i];
      }
    }

    const req = http.request(options, (res) => {
      console.log(`状态码: ${res.statusCode}`);
      console.log(`响应头: ${JSON.stringify(res.headers)}`);

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        console.log(`响应主体: ${chunk}`);
      });
      res.on('end', () => {
        console.log('res end');
        if (res.statusCode == 200)
          cb(0);
        else
          cb(new Error(res.statusCode), ip);
      });
    });

    req.on('error', (e) => {
      console.error(`请求遇到问题: ${e.message}`);
      cb(e, ip);
    });
    req.on('end', (e) => {
      console.log(`req end`);
    });
    this.runTime.targetIp = ip;

    return req;
  },

  startSend: function (runData) {
    var content = runTime.client.content;
    if (runTime.client.type != 'file' && runTime.client.type != 'fileAsk') {
      content = {
        name: runTime.client.fileSend.name,
        path: runTime.client.fileSend.path,
        transferred: runTime.client.fileSend.sent, //已传输的大小
        total: runTime.client.fileSend.size,
        elapsed: new Date().getTime() - runTime.client.fileSend.startTime
      };
    }
    runTime.addHistory();
  },
  sentCallback: function (err, data) {
    console.log('cb');
    if (err) {
      console.log(err);
      utools.removeFeature(data);
      Utils.toast(`${err.message}`);
    } else {

      // var content = runTime.client.content;
      // if (runTime.client.type != 'file' && runTime.client.type != 'fileAsk') {
      //   runTime.addHistory({
      //     ip: runTime.client.targetIp,
      //     id: runTime.client.targetId,
      //     type: 2, //1 from,2 to
      //     content: content,
      //     contentType: runTime.client.type, //text file
      //     time: new Date().getTime()
      //   });
      //   content = {
      //     name: runTime.client.fileSend.name,
      //     path: runTime.client.fileSend.path,
      //     transferred: runTime.client.fileSend.sent, //已传输的大小
      //     total: runTime.client.fileSend.size,
      //     elapsed: new Date().getTime() - runTime.client.fileSend.startTime
      //   };
      // }

      Utils.toast('发送成功');
      //utools.outPlugin();
      //utools.hideMainWindow();
    }
  }
};