const express = require('express');
const healthRoute = require('../routes/system/health');
const paymentRoute = require('../routes/services/paymentService');
const authentication3dsRoute = require('../routes/services/3dsAuthenticationService');
const webhookRoute = require('../routes/notifications/webhook');
const loggerHandler = require('../helpers/logger');
const logger = loggerHandler.LoggerBuilder();

const PORT = process.env.PORT || 3000;
const app = express();

logger.log('info',loggerHandler.formatMessage(null,'Configuring server'));

/**
 * Hide the information about the build tool application
 */
app.disable('x-powered-by');

/**
 * Enable CORS into application
 */
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

logger.log('info',loggerHandler.formatMessage(null, 'Set application CORS'));

/**
 * occParametes is te data necessary to access the gatewaySettings in OCC settings.
 * This is importante to several parts of application. 
 * <br>&nbsp;&nbsp; • adminUrl:      URL to Oracle Commerce Cloud gateway settings 
 * <br>&nbsp;&nbsp; • apiVersion:    Version of the OCC API. 
 * <br>&nbsp;&nbsp; • appKey:        Identification of the application to allow access att OCC.
 * <br>&nbsp;&nbsp; • extensionName: Name of the extension where the application properties was setted.
 * @name occParameters
 * @constant {Object}
 */
logger.log('info',loggerHandler.formatMessage(null, 'Set application server variables'));
app.set('occParameters', {
  'adminUrl':'ccadmin-z9ta.oracleoutsourcing.com',
  'apiVersion':'v1', 
  'appKey':'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI1MTg5OGViOS00Y2U4LTRlZDItYWJjMy05ZGIxMmE3MTM5NWIiLCJpc3MiOiJhcHBsaWNhdGlvbkF1dGgiLCJleHAiOjE1ODU3NTM2NjMsImlhdCI6MTU1NDIxNzY2M30=.qpp5kuSrO2R01QSGyO1iq4cterufPf7115qYAAbB+5I=',
  'extensionName':'CustomPaymentGatewayBraspag',
});

/**
 * Define application routes
 */
logger.log('info',loggerHandler.formatMessage(null, 'Set application routes'));

app.use('/v1/system/check', healthRoute);
app.use('/v1/payment/confirmation', paymentRoute);
app.use('/v1/payment/authentication', authentication3dsRoute);
app.use('/v1/notification', webhookRoute);

/**
* Starting server using the specified port
* @name listen
* @method
* @inner
* @param {string} PORT - Port specified
* @param {callback} callback - Callback that starts if server was sucefull started 
*/
app.listen(PORT, () => {
  logger.log('info',loggerHandler.formatMessage(null, `Running on port ${PORT}`));
});

app.on('error',(err) => console.error(err))
module.exports = app;
