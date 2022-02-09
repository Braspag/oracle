const express = require('express');
const responseTime = require('response-time');
const Enext3dsAuthenticationServices = require('../../../../business/enextServices/enext3dsAuthenticationService');
const OracleCommerceCloud = require('../../../../helpers/occ');
const loggerHandler = require('../../../../helpers/logger');
const logger = loggerHandler.LoggerBuilder();
const router = express.Router();

router.use(express.json());
router.use(responseTime());

router.post('/token', async function(req, res) {
    let messagePrefix = [
        { key:'Order', value: req.body.orderId },
        { key:'Route', value: '3ds2.0 GetToken' },
    ];

    logger.log('info', loggerHandler.formatMessage(messagePrefix,'---------------------------------------------------------------------------------------'));
    logger.log('info', loggerHandler.formatMessage(messagePrefix,'Enext Custom Payment Gateway: Initiating 3ds 2.0 authentication get token processor route'));
    
    logger.log('info', loggerHandler.formatMessage(messagePrefix,'Request Headers: '));
    logger.log('info', loggerHandler.formatMessage(messagePrefix,'%j') ,req.headers);

    req.body.shopperDeviceIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    logger.log('info', loggerHandler.formatMessage(messagePrefix,'Request Payload: '));
    logger.log('info', loggerHandler.formatMessage(messagePrefix,'%j'), req.body);

    if(req.query.ENV){
        req.body.channel = req.query.ENV.toLowerCase();
        logger.log('info',loggerHandler.formatMessage(messagePrefix,`Enext Custom Payment Gateway: Running ${req.body.channel} occ environment`));
    }
    
    try{
        let gatewaySettings = await new OracleCommerceCloud().adminOperations().getGatewaySettings(req);
        if(gatewaySettings.error){
            logger.log('error',loggerHandler.formatMessage(messagePrefix,`Enext Custom Payment Gateway: An error has occurred when get gateway settings was processed. Message: ${gatewaySettings.message}`));
            return res.status(500).json({ message: gatewaySettings.message });
        }
        else{
            let ENEXT_PAYMENT_AUTHENTICATION_SERVICES = new Enext3dsAuthenticationServices(gatewaySettings.paymentProviderName);
            ENEXT_PAYMENT_AUTHENTICATION_SERVICES.setPaymentProviderImplementation = ENEXT_PAYMENT_AUTHENTICATION_SERVICES.getPaymentProviderName;
            req.body.gatewaySettings = gatewaySettings;
            return await ENEXT_PAYMENT_AUTHENTICATION_SERVICES.authenticateOperations().getToken(req, res);
        }
    }
    catch(e){
        logger.log('error', loggerHandler.formatMessage(messagePrefix,`Enext Custom Payment Gateway: ${e.message}`));
        logger.log('error', loggerHandler.formatMessage(messagePrefix,'%O'),e);

        return res
        .status(400)
        .json({ message: `Enext Custom Payment Gateway: ${e.message}`})
        .end();
    }
});


module.exports = router;