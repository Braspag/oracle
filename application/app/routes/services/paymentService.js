const EnextPaymentServices = require('../../business/enextServices/enextPaymentService');
const EnextBaseService = require('../../business/enextServices/enextBaseService');
const express = require('express');
const responseTime = require('response-time');
const fileSystem = require('fs');
const loggerHandler = require('../../helpers/logger');
const OracleCommerceCloud = require('../../helpers/occ');
const logger = loggerHandler.LoggerBuilder();
const router = express.Router();

router.use(express.json());
router.use(responseTime());

const validator = (payload, messagePrefix)=> {

    let gatewaySettingsRequiredFields = [
        'paymentProviderName',
        'paymentProviderEndpoint',
        'useAntiFraudAnalysis'
    ]

    let customPropertiesRequiredFields = [
        'shippingAddressDistrict',
        'shippingAddressNumber',
        'shippingAsBilling',
        'paymentType'
    ];

    let response = {
        isValid: true
    };
    
    if(payload.hasOwnProperty('gatewaySettings') && payload.hasOwnProperty('customProperties')){
        gatewaySettingsRequiredFields.forEach((element) =>{
            if (response.isValid){
                if (payload.gatewaySettings.hasOwnProperty(element)){

                    //Check if payment provider and anti fraude provider (case exist) are supported
                    if(element === 'paymentProviderName'){
                        if (payload.gatewaySettings.useAntiFraudAnalysis){
                            response.isValid = fileSystem.existsSync(__dirname.concat(`/../../business/paymentProviders/${payload.gatewaySettings.paymentProviderName}`)) && fileSystem.existsSync(__dirname.concat(`/../../business/antifraudProviders/${payload.gatewaySettings.antifraudProviderName}`));
                            if (!response.isValid)
                                response.message = 'Enext Custom Payment Gateway: Payment provider or antifraud provider not supported';
                        }
                            
                        else{
                            response.isValid = fileSystem.existsSync(__dirname.concat(`/../../business/paymentProviders/${payload.gatewaySettings.paymentProviderName}`))
                            if (!response.isValid)
                                response.message = 'Enext Custom Payment Gateway: Payment provider not supported';
                        }
                    }
                }
                else{
                    logger.log('error', loggerHandler.formatMessage(messagePrefix,`Enext Custom Payment Gateway: The required field ${element} are missing in gatewaySettings, check your configuration !`));
                    response.isValid = false;
                    response.message = `Enext Custom Payment Gateway: The required field ${element} are missing in gatewaySettings, check your configuration !`;
                }
            }
        });
        
        if(response.isValid){
            customPropertiesRequiredFields.forEach((element) =>{
                if (!payload.customProperties.hasOwnProperty(element)){
                    logger.log('error',loggerHandler.formatMessage(messagePrefix,`Enext Custom Payment Gateway: The required field ${element} are missing in customProperties, check your JS code in checkout page !`));
                    response.isValid = false;
                    response.message = `Enext Custom Payment Gateway: The required field ${element} are missing in customProperties, check your JS code in checkout page !`;
                }
            });
        }
        
        return response;
    }
    else{
        response.isValid = false;
        response.message = 'Enext Custom Payment Gateway: gatewaySettings or customProperties is missing, check your request body';
        logger.log('error',loggerHandler.formatMessage(messagePrefix,'Enext Custom Payment Gateway: gatewaySettings or customProperties is missing, check your request body'));
        return response;
    }
};

router.post('/', function(req, res){
    let messagePrefix = [
        { key:'Order', value: req.body.orderId },
        { key:'Route', value: 'CheckoutConfirmation' },
    ];

    let validationResponse = validator(req.body,messagePrefix);

    if (validationResponse.isValid){
        let gatewaySettings = req.body.gatewaySettings;
        logger.log('info', loggerHandler.formatMessage(messagePrefix,'---------------------------------------------------------------------------------------'));
        logger.log('info', loggerHandler.formatMessage(messagePrefix,'Enext Custom Payment Gateway: Initiating checkout processor route'));
        
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
            let ENEXT_PAYMENT_SERVICES = new EnextPaymentServices(gatewaySettings.paymentProviderName);
            ENEXT_PAYMENT_SERVICES.setPaymentProviderImplementation = ENEXT_PAYMENT_SERVICES.getPaymentProviderName;

            req.body.orderProperties = new OracleCommerceCloud().normalizeOperations().normalizeOccOrderProperties(req.body);
            
            /* Used when payment type is card. This solution avoid timeout of the request while 
            * purchase is processed in checkout page. The payment will be process in background when Order Submit webhook
            * send a notification to custom gateway warning which the order was been made
            */
            if(gatewaySettings.useAntiFraudAnalysis && req.body.orderProperties.paymentInfo.type === 'creditCard'){
                functionScopeMessagePrefix = [ ...messagePrefix,{ key:'Operation', value: 'preAuthorizePayment' }];
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Custom Payment Gateway Operation: Pre authorize payment'));
                return new EnextBaseService().checkoutOperations(req).normalizeResponseToWebHook(req,null,'1000','Card pre authorized successfully',null,true).then((result)=> res.status(200).json(result).end(), (err)=> res.status(500).json(err).end());
            }
            else
                return ENEXT_PAYMENT_SERVICES.checkoutOperations(req.body.orderProperties.orderId).checkoutRequestHandler(req, res).then((result)=>result, (err)=> err);
        }
        catch(e){
            logger.log('error', loggerHandler.formatMessage(messagePrefix,`Enext Custom Payment Gateway: ${e.message}`));
            logger.log('error', loggerHandler.formatMessage(messagePrefix,'%O'),e);

            return res
            .status(400)
            .json({ message: `Enext Custom Payment Gateway: ${e.message}`})
            .end();
        }
    }
    else{
        logger.log('error', loggerHandler.formatMessage(messagePrefix,validationResponse.message));

        return res
        .status(400)
        .json({ message: validationResponse.message })
        .end();
    }
});


module.exports = router;