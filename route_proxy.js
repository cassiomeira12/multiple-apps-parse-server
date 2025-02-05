var http = require('http');
var httpProxy = require('http-proxy');
var HttpProxyRules = require('http-proxy-rules');

const rules = require('./route-proxy.json');

var proxyRules = new HttpProxyRules({ rules: rules });

var proxy = httpProxy.createProxy();

const httpServer = http.createServer(function(req, res) {
    var target = proxyRules.match(req);
    if (target) {
        return proxy.web(req, res, { target: target });
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 not found');
});

httpServer.listen(8080, function () {
    console.log("Route Proxy is running");
});