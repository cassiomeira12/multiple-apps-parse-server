const express = require('express');
const http = require('http');
const ParseDashboard = require('parse-dashboard');

var config = require('./dashboard.json');

var dashboard = new ParseDashboard(config, { allowInsecureHTTP: config.allowInsecureHTTP });

var app = express();

app.use('/dashboard', dashboard);

app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

const httpServer = http.createServer(app);

httpServer.listen(config.port, function () {
    console.log(`Parse Dashboard running on http://localhost:${config.port}/dashboard`);
});