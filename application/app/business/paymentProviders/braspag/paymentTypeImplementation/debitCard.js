const CardAbstraction = require('../paymentTypeAbstraction/card');
const Cybersource = require('../../../antifraudProviders/cybersource/cybersource');
const loggerHandler = require('../../../../helpers/logger');
const logger = loggerHandler.LoggerBuilder();

/** 
 * This module treats the integration with Braspag API when the order checkout calls generic card payment.
 * @module paymentProvidesr/braspag/card
 * @requires logger
 */

/**
 * @fileoverview This route treats all the calls from OCC using the generic card payment webhook;
 */

module.exports = class DebitCard extends CardAbstraction {
    
    constructor(){
        super();
    }

    /**
    * @namespace authorizeOperations
    * authorizePayments is able to pre-authorizea payment or to capture automaticaly. According to the business rule.
    * @override CardAbstraction authorizePayment()
    * @param {Object} req - Request payload
    * @returns {Promise}
    */
    authorizeOperations(orderId){
        let parentAuthorizeOperations = super.authorizeOperations();
        let messagePrefix = [
            { key:'Order', value: orderId },
            { key:'PaymentProvider', value: 'braspag' },
        ];
        let functionScopeMessagePrefix;
        
        let buildAuthorizeObject = (req) => {
            functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'buildAuthorizeObject' }];

            try{
                let orderProperties = req.body.orderProperties;
                let gatewaySettings = req.body.gatewaySettings;

                let body = {
                    MerchantOrderId: orderProperties.orderId,
                    Customer: {
                        Name: orderProperties.shopperInfo.name,
                        Identity: orderProperties.shopperInfo.document,
                        IdentityType: orderProperties.shopperInfo.documentType, 
                        Email: orderProperties.shopperInfo.email, 
                        Birthdate: orderProperties.shopperInfo.dateOfBirth, 
                        Phone: orderProperties.shopperInfo.phoneNumber, 
                        Address: {
                            Street: orderProperties.billingAddress.address1, 
                            Number: orderProperties.billingAddress.number, 
                            ZipCode: orderProperties.billingAddress.postalCode, 
                            City: orderProperties.billingAddress.city, 
                            State: orderProperties.billingAddress.state, 
                            Country: orderProperties.billingAddress.country, 
                            District: orderProperties.billingAddress.district 
                        },
                        DeliveryAddress: {
                            Street: orderProperties.shippingAddress.address1, 
                            Number: orderProperties.shippingAddress.number, 
                            ZipCode: orderProperties.shippingAddress.postalCode, 
                            City: orderProperties.shippingAddress.city, 
                            State: orderProperties.shippingAddress.state, 
                            Country: orderProperties.shippingAddress.country, 
                            District: orderProperties.shippingAddress.district 
                        },
                    },
                    Payment: {
                        Provider: gatewaySettings.debitCardProvider,
                        Type: 'DebitCard',
                        Amount: orderProperties.paymentInfo.amount, 
                        Currency: orderProperties.paymentInfo.currencyCode,
                        Installments: 1,
                        Capture: true,
                        Authenticate: true,
                        DebitCard: {
                            SecurityCode: orderProperties.paymentInfo.cardInfo.cvv || orderProperties.paymentInfo.securityCardProperties.cvv, 
                            Brand: (orderProperties.paymentInfo.cardInfo.type)? DebitCard.CARD_BRANDS[orderProperties.paymentInfo.cardInfo.type]:DebitCard.CARD_BRANDS[orderProperties.paymentInfo.securityCardProperties.brand]
                        }
                    }
                };

                //TODO: Atualizar gateway extension para o 3DS e testar implementação
                if(gatewaySettings.use3dsAuthentication){

                    orderProperties.customProperties.properties3ds = JSON.parse(orderProperties.customProperties.properties3ds);

                    if(orderProperties.customProperties.properties3ds.Success){
                        body.Payment.ExternalAuthentication = {
                            Cavv: orderProperties.customProperties.properties3ds.cavv,
                            Xid: orderProperties.customProperties.properties3ds.xid,
                            Eci:orderProperties.customProperties.properties3ds.eci,
                            Version: orderProperties.customProperties.properties3ds.version,
                            ReferenceID: orderProperties.customProperties.properties3ds.referenceId
                        };
                    }

                    if(gatewaySettings.authentication3dsVersion == '1')
                        body.Payment.ReturnUrl = gatewaySettings.authentication3dsReturnUrl
                }

                //Create transaction with debit card alias
                if (orderProperties.paymentInfo.securityCardProperties.haveCardToken && orderProperties.paymentInfo.securityCardProperties.alias){
                    logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider DebitCard Implementation: This payment use debit card alias')); 
                    body.Payment.DebitCard.Alias = orderProperties.paymentInfo.securityCardProperties.alias;
                }
                //Create transaction with debit card token
                else if (orderProperties.paymentInfo.securityCardProperties.haveCardToken && orderProperties.paymentInfo.securityCardProperties.token){
                    logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider DebitCard Implementation: This payment use debit card token')); 
                    body.Payment.DebitCard.CardToken = orderProperties.paymentInfo.securityCardProperties.token;
                }
                else {
                    body.Payment.DebitCard.CardNumber = orderProperties.paymentInfo.cardInfo.number;
                    body.Payment.DebitCard.Holder = orderProperties.paymentInfo.cardInfo.holderName;
                    body.Payment.DebitCard.ExpirationDate = `${orderProperties.paymentInfo.cardInfo.expirationMonth}/${orderProperties.paymentInfo.cardInfo.expirationYear}`;
                    
                    //Save card on Braspag payment provider
                    if (orderProperties.paymentInfo.securityCardProperties.saveCard){
                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider DebitCard Implementation: This debit card will be saved and tokenized'));
                        body.Payment.DebitCard.SaveCard = orderProperties.paymentInfo.securityCardProperties.saveCard;
                        
                        //Create an alias for the debit card to use in the next payments
                        if(orderProperties.paymentInfo.securityCardProperties.alias)
                            body.Payment.DebitCard.Alias = orderProperties.paymentInfo.securityCardProperties.alias
                    }
                    else
                        body.Payment.DebitCard.SaveCard = false;
                }

                if (orderProperties.shippingAddress.complement){
                    body.Customer.Address.Complement = orderProperties.billingAddress.complement;
                    body.Customer.DeliveryAddress.Complement = orderProperties.shippingAddress.complement;
                }

                return body;
            }
            catch(e){
                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider DebitCard Implementation: An error has occurred when authorize object body was builded. Message: ${e.message}`));
                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%O'),e);
            
                return {
                    message: e.message,
                    error: true
                };
            }
        };
    
        let buildAuthorizeOptionsRequest = (gatewaySettings,authorizeObj)=> {
            let options = {
                method: 'POST',
                uri: `${gatewaySettings.paymentProviderEndpoint}/v2/sales`,
                headers: {
                    'Content-Type': 'application/json',
                    'merchantId': gatewaySettings.paymentProviderMerchantId,
                    'merchantKey': gatewaySettings.paymentProviderMerchantKey
                },
                body: authorizeObj,
                json: true,
            };

            return options;
        };

        return {
            
            /**
             * authorizePayments is able to pre-authorizea payment or to capture automaticaly. According to the business rule.
             * @override CardAbstraction authorizePayment()
             * @param {Object} req - Request payload
             * @returns {Promise}
             */
            async authorizePayment(req){
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'authorizePayment' }];
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider DebitCard Implementation: Processing DebitCard payment authorization')); 

                let authorizeObj = buildAuthorizeObject(req);
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider DebitCard Implementation: Object sent to Braspag %j'), authorizeObj); 
                return await parentAuthorizeOperations.authorizePayment(buildAuthorizeOptionsRequest(req.body.gatewaySettings, authorizeObj));
            },
            
            async authorizePaymentWithAntiFraud(req){
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'authorizePaymentWithAntiFraud' }];
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider DebitCard Implementation: Processing native integration, DebitCard payment with anti fraud authorization'));

                let authorizeObj = buildAuthorizeObject(req);

                authorizeObj.Payment.FraudAnalysis = await new Cybersource().analysisOperations(req.body.orderProperties.orderId).buildAnalysisObjectToFullIntegrationRequest(req);

                if (authorizeObj.Payment.FraudAnalysis.error){
                    authorizeObj.ReasonMessage = authorizeObj.Payment.FraudAnalysis.message;
                    authorizeObj.statusCode = authorizeObj.Payment.FraudAnalysis.statusCode;
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider DebitCard Implementation: Object sent to Braspag %j'), authorizeObj);
                    return authorizeObj;
                }
                else{
                    logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider DebitCard Implementation: Object sent to Braspag %j'), authorizeObj);
                    return await parentAuthorizeOperations.authorizePayment(buildAuthorizeOptionsRequest(req.body.gatewaySettings, authorizeObj), true);   
                }        
            }
        };
    }
}