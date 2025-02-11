const express = require('express');
const { default: ParseServer, ParseGraphQLServer } = require('parse-server');
const http = require('http');
const { path, resolve } = require('path');
const cors = require('cors');
const helmet = require('helmet');

const config = process.env.app ? require("./configs/" + process.env.app) : require("./configs/example.json");

const parseMount = config.parseMount;
const serverURL = config.serverURL + ":" + config.port;
const graphQLServerURL = serverURL + "/graphql";

var configParse = {
  appName: config.appName,
  appId: config.appId,
  masterKey: config.masterKey,
  restAPIKey: config.restAPIKey,
  databaseURI: config.databaseURI,
  cloud: config.projectPath + '/cloud/main.js',
  serverURL: serverURL + config.parseMount,
  publicServerURL: serverURL + config.parseMount,
  graphQLServerURL: graphQLServerURL,
  "verbose": false,
  "directAccess": true,
  "verifyUserEmails": false,
  "preventLoginWithUnverifiedEmail": false,
  "emailVerifyTokenValidityDuration": 3600 * 1, // Token expires in 1 hour
  "revokeSessionOnPasswordReset": true,
  "enforcePrivateUsers": true,
  "enableAnonymousUsers": false,
  "allowClientClassCreation": false,
  "allowExpiredAuthDataToken": false,
  "expireInactiveSessions": true,
  "sessionLength": 3600 * 24 * 5, // Session expires in 5 days
  "jsonLogs": true,
  "logsFolder": "./logs/" + config.appName,
  "startLiveQueryServer": true,
  "liveQuery": {
    "classNames": config.liveQueryClasses,
    "liveQueryServerURL": "ws://localhost:1337"
  },
  // "schema": {
  //   "definitions": schemes,
  //   "lockSchemas": false,
  //   "strict": false,
  //   "recreateModifiedFields": false,
  //   "deleteExtraFields": false,
  // },
  "accountLockout": null,
  "passwordPolicy": {
    "doNotAllowUsername": true,
    "maxPasswordHistory": null,
  },
  "fileUpload": {
    "enableForPublic": false,
    "enableForAnonymousUser": false,
    "enableForAuthenticatedUser": true,
  },
  "security": {
    "enableCheck": true,
    "enableCheckLog": true,
    "checkGroups": [],
  },
  "serverStartComplete": () => {
    console.log('Parse server started');
  }
}

const parseServer = new ParseServer(configParse);

var app;
try {
    app = require(config.cloud + '/app.js');
    app.set('trust proxy', true);
} catch (_) {
    app = express();
    app.set('trust proxy', true);
}

const projectPath = config.projectPath || __dirname;

app.use(express.static(resolve(projectPath + '/public')));
app.use('/public', express.static(resolve(projectPath + '/public')));

const webAppPath = config.webApp || "/";

if (webAppPath !== "/") {
  app.get("/", (_, res) => {
    res.redirect(webAppPath);
  });
}

app.get(webAppPath, (_, res) => {
  res.sendFile(resolve(projectPath + '/public/test.html'));
});

var allowedOrigins = config.allowed_origins_cors;

if (allowedOrigins.length > 0) {
  app.use(helmet.hidePoweredBy());
  app.use(helmet.hsts());
  app.use(helmet.ieNoOpen());
  app.use(helmet.noSniff());
  app.use(helmet.frameguard());
  app.use(helmet.xssFilter());

  app.use(cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        var msg = 'The CORS policy for this site does not ' + 'allow access from the specified Origin.';
        return callback(Error(msg), false);
      }
      return callback(null, true);
    }
  }));
} else {
  app.options('*', cors());
}

app.use(parseMount, parseServer.app);

const parseGraphQLServer = new ParseGraphQLServer(
  parseServer, { graphQLPath: '/graphql' }
);

parseGraphQLServer.applyGraphQL(app);

const httpServer = http.createServer(app);

httpServer.listen(config.port, function () {
  console.log(`Parse App ${config.appName}`);
  console.log(`Parse running on ${serverURL}`);
  console.log('Parse Web App ' + serverURL + webAppPath);
  console.log(`REST API running on ${serverURL + parseMount}`);
  console.log(`GraphQL API running on ${serverURL + "/graphql"}`);
  console.log(`Allowed Origins ${allowedOrigins}`);
});

ParseServer.createLiveQueryServer(httpServer);

module.exports = { httpServer, configParse };