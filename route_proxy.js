const httpProxy = require('http-proxy');
const HttpProxyRules = require('http-proxy-rules');
const express = require('express');

const rules = require('./route-proxy.json');

const app = express();
const proxyRules = new HttpProxyRules({ rules: rules });
const proxy = httpProxy.createProxy();

app.all('*', function(req, res) {
    req.headers['ip'] = req.ip;
    var target = proxyRules.match(req);
    if (target) {
        return proxy.web(req, res, { target: target});
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 not found');
});

app.listen(2000, function () {
  console.log("Route Proxy is running");
});