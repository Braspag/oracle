const OracleCommerceCloud = require('../../helpers/occ');
const EnextAntifraudService = require('../../business/enextServices/enextAntifraudService');
const EnextPaymentService = require('../../business/enextServices/enextPaymentService');
const loggerHandler = require('../../helpers/logger');
const logger = loggerHandler.LoggerBuilder();
const express = require('express');
const responseTime = require('response-time');
const router = express.Router();

router.use(express.json());
router.use(responseTime());

router.post('/antifraud', async (req, res) => {
    let messagePrefix = [{ key:'Route', value: 'AntifraudWebhookListener' }];
    logger.log('info',loggerHandler.formatMessage(messagePrefix,'---------------------------------------------------------------------------------------'));
    logger.log('info',loggerHandler.formatMessage(messagePrefix,'Enext Custom Payment Gateway: Initiating antifraud webhook notification processor route'));
    logger.log('info',loggerHandler.formatMessage(messagePrefix,'%j'),req.body);
    
    if(req.query.ENV){
        req.body.channel = req.query.ENV.toLowerCase();
        logger.log('info',loggerHandler.formatMessage(messagePrefix,`Enext Custom Payment Gateway: Running ${req.body.channel} occ environment`));
    }

    try{
        let gatewaySettings = await new OracleCommerceCloud().adminOperations().getGatewaySettings(req);
        
        if (gatewaySettings.paymentProviderName){
            let ENEXT_ANTIFRAUD_SERVICES = new EnextAntifraudService(gatewaySettings.antifraudProviderName);
            ENEXT_ANTIFRAUD_SERVICES.setAntifraudProviderImplementation = ENEXT_ANTIFRAUD_SERVICES.getAntifraudProviderName;
            req.body.gatewaySettings = gatewaySettings;
            return await ENEXT_ANTIFRAUD_SERVICES.antifraudWebHookOperations().notificationRequestHandler(req, res);
        }
        else{
            return res
            .status(400)
            .json({ message: 'Enext Custom Payment Gateway: Payment provider name is missing, check your gateway settings ' })
            .end();
        }
    }
    catch(e){
        logger.log('error',loggerHandler.formatMessage(messagePrefix,'Enext Custom Payment Gateway: An error has occurred when notification from anti fraud provider webhook was received'));
        logger.log('error',loggerHandler.formatMessage(messagePrefix,'%O'),e);

        return res
        .status(400)
        .json({ message: `Enext Custom Payment Gateway: ${e.message}`})
        .end();
    }    
});

router.post('/payment', async (req, res) => {
    let messagePrefix = [{ key:'Route', value: 'PaymentWebhookListener' }];

    logger.log('info',loggerHandler.formatMessage(messagePrefix,'---------------------------------------------------------------------------------------'));
    logger.log('info',loggerHandler.formatMessage(messagePrefix,'Enext Custom Payment Gateway: Initiating payment webhook processor route'));
    logger.log('info',loggerHandler.formatMessage(messagePrefix,'%j'),req.body);
    
    if(req.query.ENV){
        req.body.channel = req.query.ENV.toLowerCase();
        logger.log('info',loggerHandler.formatMessage(messagePrefix,`Enext Custom Payment Gateway: Running ${req.body.channel} occ environment`));
    }

    try{
        let gatewaySettings = await new OracleCommerceCloud().adminOperations().getGatewaySettings(req);
        
        if (gatewaySettings.error){
            logger.log('error',loggerHandler.formatMessage(messagePrefix,`Enext Custom Payment Gateway: An error has occurred when get gateway settings was processed. Message: ${gatewaySettings.message}`));
            return res.status(500).json({ message: gatewaySettings.message });
        }
        else{
            if (gatewaySettings.paymentProviderName){
                let ENEXT_PAYMENT_SERVICES = new EnextPaymentService(gatewaySettings.paymentProviderName);
                ENEXT_PAYMENT_SERVICES.setPaymentProviderImplementation = ENEXT_PAYMENT_SERVICES.getPaymentProviderName;
                req.body.gatewaySettings = gatewaySettings;
                return await ENEXT_PAYMENT_SERVICES.paymentWebHookOperations().notificationRequestHandler(req, res);
            }
            else
                return res
                .status(400)
                .json({ message: 'Enext Custom Payment Gateway: Payment provider name is missing, check your gateway settings ' })
                .end();
        }        
    }
    catch(e){
        logger.log('error',loggerHandler.formatMessage(messagePrefix,'Enext Custom Payment Gateway: An error has occurred when notification from payment provider webhook was received'));
        logger.log('error',loggerHandler.formatMessage(messagePrefix,'%O'),e);

        return res
        .status(400)
        .json({ message: `Enext Custom Payment Gateway: ${e.message}`})
        .end();
    }
});

router.post('/store', async (req, res) =>{
    let messagePrefix = [{ key:'OrderId', value: req.body.order.id },{ key:'Route', value: 'OracleCommerceCloudWebhookListener' }];
    
    logger.log('info',loggerHandler.formatMessage(messagePrefix,'---------------------------------------------------------------------------------------'));
    logger.log('info',loggerHandler.formatMessage(messagePrefix,'Enext Custom Payment Gateway: Initiating oracle commerce cloud webhook order submit processor route'));
    logger.log('info',loggerHandler.formatMessage(messagePrefix,'Body: %j'),req.body);

    if(req.query.ENV){
        req.body.channel = req.query.ENV.toLowerCase();
        logger.log('info',loggerHandler.formatMessage(messagePrefix,`Enext Custom Payment Gateway: Running ${req.body.channel} occ environment`));
    }

    try{
        let OCC =  new OracleCommerceCloud();
        req.body.gatewaySettings = await OCC.adminOperations().getGatewaySettings(req);
        
        if (req.body.gatewaySettings.paymentProviderName)
            return await OCC.webhookOperations().notificationRequestHandler(req,res);
        
        else{
            return res
            .status(400)
            .json({ message: 'Enext Custom Payment Gateway: Payment provider name is missing, check your gateway settings ' })
            .end();
        }
    }
    catch(e){
        logger.log('error',loggerHandler.formatMessage(messagePrefix,'Enext Custom Payment Gateway: An error has occurred when notification from Oracle Commerce Cloud order submit webhook was received'));
        logger.log('error',loggerHandler.formatMessage(messagePrefix,'%O'),e);

        return res
        .status(400)
        .json({ message: `Enext Custom Payment Gateway: ${e.message}` })
        .end();
    }
});

module.exports = router;