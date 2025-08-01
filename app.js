const express = require('express');
const { default: ParseServer, ParseGraphQLServer } = require('parse-server');
const http = require('http');
const https = require('https');
const { path, resolve } = require('path');
const cors = require('cors');
const helmet = require('helmet');

const config = process.env.app ? require("./configs/" + process.env.app) : require("./configs/password-manager-prod.json");

const parseMount = config.parseMount;
const serverURL = config.serverURL + ":" + config.port;
const graphQLServerURL = serverURL + "/graphql";

var schemesProjectApp;
var defaultDataProjectApp;
try {
    const { schemes, defaultData } = require(config.projectPath + '/cloud/schemes/schemes.js');
    schemesProjectApp = schemes;
    defaultDataProjectApp = defaultData;
} catch (_) {
    schemesProjectApp = [];
    defaultDataProjectApp = [];
}


var configParse = {
  appName: config.appName,
  appId: config.appId,
  masterKey: config.masterKey,
  restAPIKey: config.restAPIKey,
  clientKey: config.clientKey,
  databaseURI: config.databaseURI,
  cloud: config.projectPath + '/cloud/main.js',
  serverURL: serverURL + config.parseMount,
  publicServerURL: config.publicServerURL,
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
  "sessionLength": 3600 * 24 * 15, // Session expires in 15 days
  "jsonLogs": true,
  "logsFolder": "./logs/" + config.appName,
  "startLiveQueryServer": true,
  "liveQuery": {
    "classNames": config.liveQueryClasses,
    "liveQueryServerURL": "ws://localhost:1337"
  },
  "schema": {
    "definitions": schemesProjectApp,
    "lockSchemas": false,
    "strict": false,
    "recreateModifiedFields": false,
    "deleteExtraFields": false,
  },
  "accountLockout": null,
  "passwordPolicy": {
    // "maxPasswordAge": null,
    "doNotAllowUsername": true,
    "maxPasswordHistory": null,
    "validationError": 'password_must_contain_1_to_18_digits',
    "validatorCallback": (password) => {
      return password.length > 3 && password.length <= 18;
    },
    // enforce password with at least 8 char with at least 1 lower case, 1 upper case and 1 digit
    // "validatorPattern": /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,})/,
  },
  "fileUpload": {
    "enableForPublic": false,
    "enableForAnonymousUser": false,
    "enableForAuthenticatedUser": true,
  },
  "security": {
    "enableCheck": false,
    "enableCheckLog": false,
    "checkGroups": [],
  },
  "serverStartComplete": () => {
    console.log('Parse server started');
    Parse.Cloud.startJob("createDefaultData", {"data": defaultDataProjectApp});
  }
}

const parseServer = new ParseServer(configParse);

var app;
try {
    app = require(config.projectPath + '/cloud/app.js');
    app.enable('trust proxy');
    app.set('trust proxy', true);
} catch (_) {
    app = express();
    app.enable('trust proxy');
    app.set('trust proxy', true);
}

const projectPath = config.projectPath || __dirname;

const webAppPath = config.webApp || '/';
const webFolder = config.webAppFolder || '/public';

app.use('/public', express.static(resolve(projectPath + '/public')));

if (webFolder === '/public') {
  app.use(express.static(resolve(projectPath + '/public')));
} else {
  app.use(express.static(resolve(projectPath + webFolder)));
  app.use(webAppPath, express.static(resolve(projectPath + webFolder)));
}

if (webAppPath !== '/') {
  app.get('/', (_, res) => {
    res.redirect(webAppPath);
  });
}

app.get(webAppPath, (_, res) => {
  res.sendFile(resolve(projectPath + webFolder + '/index.html'));
});

app.get('/privacy-policy', (_, res) => {
  res.sendFile(resolve(projectPath + '/public/privacy_policy.html'));
});

app.get('/terms-conditions', (_, res) => {
  res.sendFile(resolve(projectPath + '/public/terms_conditions.html'));
});

var allowedOrigins = config.allowed_origins_cors || [];

if (allowedOrigins.length > 0) {
  app.use(helmet.hidePoweredBy());
  app.use(helmet.hsts());
  app.use(helmet.ieNoOpen());
  app.use(helmet.noSniff());
  app.use(helmet.frameguard());
  app.use(helmet.xssFilter());

  app.use(cors({
    origin: true,
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

app.all('*', (req, res, next) => {
  const origin = req.get('origin') || req.headers.origin;
  const ignoreGetRequest = req.method !== 'GET';
  if (origin === undefined && ignoreGetRequest) {
    if (req.header('X-Parse-Client-Key') !== config.clientKey) {
      return res.status(403).send({
        'error': 'unauthorized',
      });
    }
  }
  next();
});

// Certificates and credentials for HTTPS server
// var fs = require('fs')
// var privateKey  = fs.readFileSync("../certificate/key.pem", "utf8")
// var certificate = fs.readFileSync("../certificate/cert.pem", "utf8")
// var ca = fs.readFileSync("../certificate/cert.pem", "utf8")

// const credentials = {
//   key: privateKey,
//   cert: certificate,
//   ca: ca
// }

app.use(parseMount, parseServer.app);

const parseGraphQLServer = new ParseGraphQLServer(
  parseServer, { graphQLPath: '/graphql' }
);

parseGraphQLServer.applyGraphQL(app);

const server = http.createServer(app); // https.createServer(credentials, app);

server.listen(config.port, function () {
  console.log(`Parse App ${config.appName}`);
  console.log(`Parse running on ${serverURL}`);
  console.log('Parse Web App ' + serverURL + webAppPath);
  console.log('Parse Public URL ' + config.publicServerURL);
  console.log(`REST API running on ${serverURL + parseMount}`);
  console.log(`GraphQL API running on ${serverURL + "/graphql"}`);
  console.log(`Allowed Origins [${allowedOrigins}]`);
});

ParseServer.createLiveQueryServer(server);