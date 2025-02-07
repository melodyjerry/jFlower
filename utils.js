const os = require('os');
const fs = require('fs');
const http = require('http');
const md5 = require('./libs/md5');
const vm = require('vm');
const {
    Worker,
    isMainThread,
    parentPort,
    workerData
} = require('worker_threads');
const logger = require('./libs/log');
// const {
//     runTime
// } = require('./server');

module.exports = {
    //runTime:runTime.common,
    toast: function (msg, code) {
        utools.showNotification(msg, 'main'); //
    },
    //获取内网ip
    getLocalIp: function () {
        var map = [];
        var nif = os.networkInterfaces();
        console.log('nif:', nif);
        this.log('nif:', nif);
        runTime.localIp = '';
        for (let i in nif) {
            if (nif[i].length > 1)
                for (let ii in nif[i]) {
                    //if (!runTime.localIp && nif[i][ii].address.indexOf('192.168') === 0)
                    if (!runTime.localIp && nif[i][ii].family == 'IPv4' && !nif[i][ii].internal)
                        runTime.localIp = nif[i][ii].address;
                    if (nif[i][ii].address == runTime.settings.localIp)
                        return runTime.localIp = nif[i][ii].address;
                }
        }
        if (runTime.settings.localIp)
            this.toast('未找到指定IP:' + runTime.settings.localIp);
        return runTime.localIp;
    },

    clearFeatures: function () {
        //移除动态加载的功能
        var f = utools.getFeatures();
        for (let i in f) {
            if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(f[i].code)) {
                utools.removeFeature(f[i].code);
            }
        }
    },
    addFeature: function (ip, name, id) {
        utools.setFeature({
            "code": "" + ip,
            "explain": `发送给：主机名(IP)`,
            // "icon": "res/xxx.png",
            // "icon": "data:image/png;base64,xxx...",
            // "platform": ["win32", "darwin", "linux"]
            "cmds": [

                {
                    "type": "over",
                    "label": `发送给：${name}(${ip})`,
                    // 排除的正则 (可选)
                    //"exclude":"/xxx/i",
                    // 长度限制（主输入框中的字符不少于） (可选)
                    "minLength": 1,
                    // 长度限制（不多于） (可选)
                    //"maxLength": 1
                },
                {
                    "type": "files",
                    "label": `发送给：${name}(${ip})`,
                    // 支持file或directory (可选)
                    "fileType": "file",
                    // 文件名称正则匹配  (可选)
                    //"match": "/xxx/",
                    // 数量限制（不少于） (可选)
                    "minNum": 1,
                    // 数量限制（不多于） (可选)
                    "maxNum": 1
                },
                {
                    // 类型，可能的值（img, files, regex, over）
                    "type": "img",
                    // 文字说明，在搜索列表中出现（必须）
                    "label": `发送给：${name}(${ip})`,
                },


            ]
        });
        runTime.hosts[ip] = {
            ip:ip,
            hostName:name,
            nativeId:id,
        };
    },

    detectDevice: function (_ipSeg) {
        var _this = this;
        //this.clearFeatures();
        var localId = utools.getLocalId();
        var localIp = _this.getLocalIp();
        var ipSeg = localIp.split('.');
        if (typeof _ipSeg == 'undefined') {
            ipSeg = ipSeg[0] + '.' + ipSeg[1] + '.' + ipSeg[2];
        } else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(_ipSeg)) {
            ipSeg = _ipSeg;
        } else {
            return;
        }
        console.log(ipSeg);
        _this.log(ipSeg);

        for (let i = 0; i < 256; i++) {
            var ip = ipSeg + '.' + i;
            (function (ip) {
                //console.log(ip, '-', new Date().getTime());
                if (ip == localIp) return;

                const req = http.get(`http://${ip}:${runTime.settings.targetPort}/detect`, {
                    headers: {
                        'cmd': 'detect',
                        'ip': localIp,
                        'id': localId,
                        'name': encodeURIComponent(runTime.settings.name),
                        'findingCode': runTime.settings.findingCode.code
                    },
                    timeout: 3500,
                }, (res) => {
                    console.log(ip);
                    console.log('res.headers:', res.headers);
                    _this.log('detectDevice:' + ip);
                    _this.log('res.headers:', res.headers);

                    if (!res.headers.id) return;
                    _this.addFeature(ip, decodeURIComponent(res.headers.name), res.headers.id);
                    res.resume();
                    if (i == 255) // && typeof _ipSeg != 'undefined'
                        _this.toast(ipSeg + '.0~255 扫描完毕！');
                }).on('timeout', () => {
                    // 必须监听 timeout 事件 并中止请求 否则请求参数中的 timeout 没有效果
                    req.destroy();
                }).on('error', (err) => {

                    utools.removeFeature(ip);

                    if (i == 255) //&& typeof _ipSeg != 'undefined'
                        _this.toast(ipSeg + '.0~255 扫描完毕！');
                });
            })(ip);
        }
        if (typeof _ipSeg == 'undefined' && runTime.settings.otherIpSeg != '')
            this.detectDevice(runTime.settings.otherIpSeg);
    },
    detectDevice5: function (_ipSeg) {
        var _this = this;
        //this.clearFeatures();
        var localId = utools.getLocalId();
        var localIp = _this.getLocalIp();
        var ipSeg = localIp.split('.');
        ipSeg = ipSeg[0] + '.' + ipSeg[1];

        console.log(ipSeg);

        for (let j = 0; j < 256; j++) {
            for (let i = 0; i < 256; i++) {
                var ip = ipSeg + '.' + j + '.' + i;
                (function (ip) {
                    //console.log(ip, '-', new Date().getTime());
                    const req = http.get(`http://${ip}:8891/detect`, {
                        //todo 头部增加暗号
                        headers: {
                            'ip': localIp,
                            'id': localId,
                            'name': runTime.settings.name,
                            'findingCode': runTime.settings.findingCode.code
                        },
                        timeout: 100,
                    }, (res) => {
                        console.log(ip);
                        console.log('res:', res);
                        if (ip == localIp) return;
                        
                        _this.addFeature(ip, res.headers.name, res.headers.id);
                        res.resume();
                    }).on('timeout', () => {
                        req.destroy();
                    }).on('error', (err) => {
                        utools.removeFeature(ip);
                        if (i == 255)
                            console.log(ip, '-', new Date().getTime());
                    });
                })(ip);
            }
        }
    },
    detectDevice4: function () {
        if (isMainThread) {
            const worker = new Worker('./detect.js');
            worker.on('message', function (data) {
                console.log('message:', data)
            });
        }
    },
    detectDevice3: function () {

        var _this = this;
        this.clearFeatures();
        var localIp = _this.getLocalIp();
        var ipSeg = localIp.split('.');
        ipSeg.pop();
        ipSeg.pop();
        var ips = [];
        const context = {
            ips: [],
            ipSeg: ipSeg,
            localIp: localIp,
            http: http,
            utools: utools
        };
        vm.createContext(context); //return;
        code = `for (let j = 0; j < 256; j++) {
            for (let i = 0; i < 256; i++) {
                var ip = ipSeg.join('.') + '.' + j + '.' + i;
                (function (ip) {
                    http.get('http://'+ip+':8891/detect', {
                        headers: {
                            'ip': localIp,
                            'id': utools.getLocalId()
                        }
                    }, (res) => {
                        console.log(ip);
                        console.log('res:', res);
                        if (ip == localIp) return;
                        ips.push(ip);
                        _this.addFeature(ip, res.headers.id);
                        res.resume();
                    }).on('error', (err) => {});
                })(ip);

            }
        }`;
        try {
            vm.runInContext(code, context);
            console.log('vm:', context);
        } catch (e) {
            console.log(e);
        }
        return ips;
    },

    getPlatform: function () {
        if (utools.isMacOs()) {
            console.log('mac');
            return runTime.platform = 'mac';
        }
        if (utools.isWindows()) {
            console.log('win');
            return runTime.platform = 'win';
        }
        if (utools.isLinux()) {
            console.log('linux');
            return runTime.platform = 'linux';
        }
    },
    md5(str) {
        return md5(str);
    },

    log(...logs) {
        console.log(runTime.settings.log);
        if (!runTime.settings.log) return;
        logger.log(`[${new Date().toLocaleString()}]`, ...logs);
    },


    log1(str, obj) {
        let path = utools.getPath('documents') + '/jflower.log';
        fs.open(path, 'a', (err, fd) => {
            if (err) {
                console.log(err);
                return false;
            }
            if (typeof obj == 'undefined') obj = '';
            str = `[${new Date().toLocaleString()}]${str.toString()}${obj.toString()}\n`;
            fs.write(fd, str, (err) => {
                console.log(err);
            });
        });
    }

}