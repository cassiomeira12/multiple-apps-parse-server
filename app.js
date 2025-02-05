const express = require('express');
const { default: ParseServer, ParseGraphQLServer } = require('parse-server');
const http = require('http');

const config = process.env.app ? require("./configs/" + process.env.app) : require("./configs/example.json");

const serverURL = config.serverURL + ":" + config.port;

var configParse = {
  ...config,
  cloud: config.cloud + '/main.js',
  serverURL: serverURL + config.parseMount,
  publicServerURL: serverURL + config.parseMount,
  graphQLServerURL: serverURL + "/graphql",
}

const parseServer = new ParseServer(configParse);

const parseGraphQLServer = new ParseGraphQLServer(
  parseServer, { graphQLPath: '/graphql' }
);

var mountPath = config.parseMount;

var app;
try {
    app = require(config.cloud + '/app.js');
    app.use(mountPath, parseServer.app);
} catch (_) {
    app = express();
    app.use(mountPath, parseServer.app);
}

parseGraphQLServer.applyGraphQL(app);

const httpServer = http.createServer(app);

httpServer.listen(config.port, function () {
  console.log(`Parse App ${config.appName}`);
  console.log(`Parse running on ${serverURL}`);
  console.log(`REST API running on ${serverURL + config.parseMount}`);
  console.log(`GraphQL API running on ${serverURL + "/graphql"}`);
});

ParseServer.createLiveQueryServer(httpServer);