const loggerHandler = require('../../../../helpers/logger');
const logger = loggerHandler.LoggerBuilder();
const OracleCommerceCloud = require('../../../../helpers/occ');
const Utils = require('../../../../helpers/utils');

/** 
 * This module treats the integration with Braspag API when the order checkout calls generic card payment.
 * @module paymentProvidesr/braspag/cash
 * @requires Utils
 * @requires logger
 * @requires occ
 */

/**
 * @fileoverview This route treats all the calls from OCC using the generic card payment webhook;
 */

module.exports = class CashAbstraction{
    
    constructor(){
        this.UTILS = new Utils();
        this.Braspag = require('../braspag');
    }
    
    /**
     * Braspag Cash Providers
     * @constant {Object}
     */
    static get PROVIDERS(){
        return [
            "Simulado",
            "Bradesco2",
            "BancoDoBrasil2",
            "ItauShopline",
            "Santander2",
            "Caixa2",
            "Citibank2"
        ]
    }
    
    /**
     * Custom fields per bank provider
     * @constant {Object}
     */
    static get CUSTOM_FIELDS(){
        return {
            Bradesco2: ['DaysToFine','FineRate','FineAmount','DaysToInterest','InterestRate','InterestAmount'],
            Santander2: ['NullifyDays']
        }
    }
    
    //Authorize operation namespace
    authorizeOperations(orderId){
        let self = this;
        let messagePrefix = [
            { key:'Order', value: orderId },
            { key:'PaymentProvider', value: 'braspag' },
        ];
        let functionScopeMessagePrefix;

        let buildAuthorizeObject = (req) => {
            let orderProperties = req.body.orderProperties;
            let body = {
                MerchantOrderId: orderProperties.orderId,
                Customer:{
                    Name: orderProperties.shopperInfo.name,
                    Identity: orderProperties.shopperInfo.document,
                    IdentityType: orderProperties.shopperInfo.documentType,
                    Address:{  
                        Street: orderProperties.billingAddress.address1,
                        Number: orderProperties.billingAddress.number,
                        ZipCode: orderProperties.billingAddress.postalCode,
                        City: orderProperties.billingAddress.city,
                        State: orderProperties.billingAddress.state,
                        Country: orderProperties.billingAddress.country,
                        District: orderProperties.billingAddress.district
                    }
                },
                Payment: {
                    Provider: req.body.gatewaySettings.cashProvider,
                    Type: 'Boleto',
                    Amount: orderProperties.paymentInfo.amount,
                }
            };

            if (orderProperties.billingAddress.complement)
                body.Customer.Address.Complement = orderProperties.billingAddress.complement;
            
            return body;
        };
        
        let buildAuthorizeOptionsRequest = (gatewaySettings,authorizeObj) => {
            let options = {
                uri: `${gatewaySettings.paymentProviderEndpoint}/v2/sales/`,
                method: "POST",
                headers: {
                    "Content-Type":"application/json",
                    "MerchantId":gatewaySettings.paymentProviderMerchantId,
                    "MerchantKey":gatewaySettings.paymentProviderMerchantKey
                },
                json: authorizeObj
            }
        
            return options;
        };

        /**
         * Each bank provider has custom fields and there are configurable on custom payment gateway.
         * @param {Object} gatewaySettings - Settings of payment gateway received by request payload
         * @param {Object} authorizeObj - Basic configuration object to request Braspag endpoint.
         * @returns {Object}
         */
        let mapperCustomFieldsFromBankProvider = (gatewaySettings,authorizeObj) => {
            functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'mapperCustomFieldsFromBankProvider' }];

            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider Cash Abstraction: Mapping custom fields from bank provider'));
        
            if (gatewaySettings.cashProvidersCustomFields === '')
                return authorizeObj;
        
            let cashProvidersCustomFields = gatewaySettings.cashProvidersCustomFields.split(',');
            
            /* Check if the config.json of gateway extension has the custom field propertie and check if the client bank provider use this field */
            cashProvidersCustomFields.forEach((customField) => {
                if (gatewaySettings.hasOwnProperty(customField) && CashAbstraction.CUSTOM_FIELDS.hasOwnProperty(gatewaySettings.cashProvider))
                    if (CashAbstraction.CUSTOM_FIELDS[gatewaySettings.cashProvider].includes(customField))
                        authorizeObj.Payment[customField] = gatewaySettings[customField];
                    else
                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider Cash Abstraction: ${gatewaySettings.cashProvider} hasn't authorization to receive this field`));
                else
                    logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider Cash Abstraction: ${customField} is missing in gatewaySettings or your bank provider not support this field.`));
            });

            return authorizeObj;
        };

        return {                    
            /**
             * When a cash payment is made, it's necessary return received ticket URL by Braspag.
             * @param {Object} req - Request payload
             * @returns {Object}
             */
            async authorizePayment(req){
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'authorizePayment' }];

                try {
                    logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider Cash Abstraction: Processing payment authorization'));
                       
                    if(!CashAbstraction.PROVIDERS.includes(req.body.gatewaySettings.cashProvider)){
                        logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider Cash Abstraction: Bank Provider is unauthorized or not exists.'));
                        return {
                            statusCode: 400,
                            ResponseCode: OracleCommerceCloud.REPROV_CODE,
                            ReasonMessage: "Enext Custom Payment Gateway: Bank Provider is unauthorized or not exists."
                        };
                    }
                    else{
                        logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider Cash Abstraction: Bank Provider is authorized.'));
                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider Cash Abstraction: Building object to Braspag request'));

                        let authorizeObj = buildAuthorizeObject(req);
                        authorizeObj = mapperCustomFieldsFromBankProvider(req.body.gatewaySettings, authorizeObj);
                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider Cash Abstraction: Object sent to Braspag %j'), authorizeObj);

                        let response = await self.UTILS.requestUtils().doRequest(buildAuthorizeOptionsRequest(req.body.gatewaySettings,authorizeObj), 0, self.Braspag);
                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider Cash Abstraction: Authorization response %j'), response);

                        if (!response.error){
                            if (response.Payment.ReasonCode === 0 && response.Payment.Status === 1) {
                                response.ResponseCode = OracleCommerceCloud.APPROV_CODE;
                                response.ReasonMessage = 'Success, ticket generated';
                                return response;
                            }
                            else
                                return {
                                    ResponseCode: OracleCommerceCloud.REPROV_CODE,
                                    ReasonMessage:`Enext Custom Payment Gateway: ${response.Payment.ReasonMessage}`,
                                    Payment:{
                                        PaymentId : response.Payment.PaymentId
                                    } 
                                }
                        }
                        else{
                            return{
                                ResponseCode: OracleCommerceCloud.REPROV_CODE,
                                ReasonMessage:`Enext Custom Payment Gateway Response: ${response.message}`,
                            }
                        }
                    }
                }
                catch(e){
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider Cash Abstraction: An error has occurred when cash payment authorization was processed. Message ${e.message}`));
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%O'),e);
                    
                    let response = {
                        ResponseCode: OracleCommerceCloud.REPROV_CODE,
                        ReasonMessage: `Enext Custom Payment Gateway Response: ${e.message}`
                    }
                    return response;
                }
            }
        }
    }    
};