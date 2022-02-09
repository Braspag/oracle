const Utils = require('./utils');
const querystring = require('querystring');
const loggerHandler = require('./logger');
const logger = loggerHandler.LoggerBuilder();
const enextPaymentServiceClass = require('../business/enextServices/enextPaymentService');
const enextAnfifraudServiceClass = require('../business/enextServices/enextAntifraudService');

/** 
 * This module has the methods related to OCC interaction, like get the gatewaySettings when this is not present into request payload.
 * @module occ
 * @requires request-promise
 * @requires logger
 * @requires querystring
 */

/**
 * @fileoverview This module has the methods related to OCC interaction, like get the gatewaySettings when this is not present into request payload.
 */

module.exports = class OracleCommerceCloud{

    constructor(){
        this.UTILS = new Utils();
    }

    /**
     * Approvation code into OCC. This code interfers with order status after some operation.
     * @constant {string}
     */
    static get APPROV_CODE(){return '1000'};
   
    /**
     * Reprovation code into OCC. This code interfers with order status after some operation.
     * @constant {string}
     */
    static get REPROV_CODE(){return '9000'};

    /**
     * gatewaySettings can have three: Preveiw, Storefront and Agent. Storefront is the config that is valid on site.
     * @constant {Array.<string, string>}
     */
    static get DEFAUT_GATEWAY_SETTINGS(){
        return ["data"];
    };

    static get CODE_BY_API_ERROR(){
        return {
            //Order not exists in occ
            '28107': { 
                status: 200, 
                continue: false
            }
        };
    }
    
    static restApiErrorHandler(err){
        if (err.error){
            if (err.error.message){
                let parsedResponse = (err.error.length)? err.error[0]:err.error;
                let statusCode = 500;
                let _continue = false;
                
                if (parsedResponse.errorCode){
                    if (OracleCommerceCloud.CODE_BY_API_ERROR[parsedResponse.errorCode]){
                        statusCode = OracleCommerceCloud.CODE_BY_API_ERROR[parsedResponse.errorCode].status;
                        _continue = OracleCommerceCloud.CODE_BY_API_ERROR[parsedResponse.errorCode].continue
                    }
                }
                
                return {
                    statusCode,
                    message: parsedResponse.message,
                    continue: _continue,
                    error: true
                };
            }
            else{
                if (err.statusCode)
                    return  new Utils().requestUtils().httpErrorHandler(err);
                else
                    return {
                        message: err.message,
                        continue: false,
                        error: true
                    };
            }
        }
        else{
            if (err.statusCode)
                return  new Utils().requestUtils().httpErrorHandler(err);
            else
                return {
                    message: err.message,
                    continue: false,
                    error: true
                };
        }
    }

    async doRequest(options){ return await this.UTILS.requestUtils().doRequest(options, 0, OracleCommerceCloud); }

    //Authentication operation namespace
    authenticationOperations(){
        let self = this;
        
        let buildGetTokenOptionsRequest = (params) => {
            var options = {
                url: `https://${params.occParameters.adminUrl}/ccadmin/${params.occParameters.apiVersion}/login`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': params.contentLength,
                    'Authorization': `Bearer ${params.occParameters.appKey}`
                },
                body: params.formData,
                json: true
            }
            return options
        };

        return {

            /**
             * getToken uses the occParaments, setted in server.js module to authenticate a session on OCC Auth API
             * and get a valid token that authorize others API requests, like get gatewaySettings.
             * @param {Object} req - Request payload 
             * @returns {Promise}
             */
            async getToken(req){
                let messagePrefix = [{ key:'Operation', value: 'getToken' }];

                try{
                    const occParameters = req.app.get('occParameters');
                    if (occParameters.accessToken !== undefined && (new Date(occParameters.expirationToken)) > new Date()) {
                        logger.log('info',loggerHandler.formatMessage(messagePrefix,'Oracle Commerce Cloud: There is a valid occ accessToken'));
    
                        return occParameters.accessToken;
                    } 
                    else {
                        logger.log('info',loggerHandler.formatMessage(messagePrefix,'Oracle Commerce Cloud: Requesting a new occ accessToken'));
    
                        let formData = querystring.stringify({ 'grant_type': 'client_credentials' });
                        let params = {
                            occParameters,
                            formData,
                            contentLength: formData.length,
                        }
    
                        let result = await self.doRequest(buildGetTokenOptionsRequest(params));
    
                        if (!result.error){
                            logger.log('info',loggerHandler.formatMessage(messagePrefix,'Oracle Commerce Cloud: New accessToken was received successfully'));
        
                            var date = new Date();
                            date.setMinutes(date.getMinutes() + 4);
                            occParameters.accessToken = result.access_token;
                            occParameters.expirationToken = date.toString();
                            req.app.set('occParameters', occParameters);
                            return result.access_token;
                        }
                        else{
                            logger.log('error',loggerHandler.formatMessage(messagePrefix,'Oracle Commerce Cloud: An error has occurred when request was made to get a new accessToken'));
                            logger.log('error',loggerHandler.formatMessage(messagePrefix,result.message));
    
                            return result;
                        }
                    }
                }
                catch(e){
                    logger.log('error',loggerHandler.formatMessage(messagePrefix,'Oracle Commerce Cloud: An error has occurred when get token was processed'));
                    logger.log('error',loggerHandler.formatMessage(messagePrefix,'%O'),e);
                
                    return {
                        message: e.message,
                        error: true
                    };
                }
            }
        }
    };

    //Store operation namespace
    storeOperations(orderId){
        let self = this;
        let messagePrefix = [
            { key:'Order', value: orderId },
        ];
        let functionScopeMessagePrefix;

        let buildUpdateShopperProfileOptionsRequest = (params) => {
            let options = {
                url:`https://${params.occParameters.adminUrl}/ccadmin/${params.occParameters.apiVersion}/profiles/${params.shopperId}`,
                qs: {
                    'preview': params.channel === 'preview'
                },
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${params.accessToken}`
                },
                json: true,
                body: params.payload
            }
            return options;
        };

        let buildUpdateOrderOptionsRequest = (params) => {
            let options = {
                url:`https://${params.occParameters.adminUrl}/ccadmin/${params.occParameters.apiVersion}/orders/${params.orderId}`,
                qs: {
                    'preview': params.channel === 'preview'
                },
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${params.accessToken}`
                },
                json: true,
                body: params.payload
            }
            return options;
        };

        let buildGetOrderOptionsRequest = (params) => {
            let options = {
                url: `https://${params.occParameters.adminUrl}/ccadmin/${params.occParameters.apiVersion}/orders/${params.orderId}`,
                qs: {
                    'preview': params.channel == 'preview'
                },
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${params.accessToken}`
                },
                json: true
            }
            return options;
        };

        return {

            /**
             * updateOrder sets a new status in a order. Its occurs, for example, when the antifraud indicates
             * a fraud and cancel the order.
             * @param {Object} req - Request payload
             * @param {Object} payload - Payload to be sended to OCC. It needs to be a right format, according to
             * OCC REST Documentation.
             * @returns {Promise}
             */
            async updateShopperProfile(req, payload){
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'ShopperId', value: req.body.orderProperties.shopperInfo.id }, { key:'Operation', value: 'updateShopperProfile' }];
                let accessToken = await self.authenticationOperations().getToken(req);

                if (accessToken.error)
                    return accessToken;
                    
                let params = {
                    channel: req.body.channel,
                    occParameters: req.app.get('occParameters'),
                    shopperId: req.body.orderProperties.shopperInfo.id,
                    accessToken,
                    payload
                }
                
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Oracle Commerce Cloud: Updating shopper: ${req.body.orderProperties.shopperInfo.id} with preview: ${(req.body.channel === 'preview')}`));
                return await self.doRequest(buildUpdateShopperProfileOptionsRequest(params));
            },

            /**
             * updateOrder sets a new status in a order. Its occurs, for example, when the antifraud indicates
             * a fraud and cancel the order.
             * @param {Object} req - Request payload
             * @param {Object} payload - Payload to be sended to OCC. It needs to be a right format, according to
             * OCC REST Documentation.
             * @returns {Promise}
             */
            async updateOrder(req, payload){
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'updateOrder' }];
                let accessToken = await self.authenticationOperations().getToken(req);

                if (accessToken.error)
                    return accessToken;

                let params = {
                    channel: req.body.channel,
                    occParameters: req.app.get('occParameters'),
                    orderId: req.body.orderProperties.orderId,
                    accessToken,
                    payload
                }
                
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Oracle Commerce Cloud: Updating order: ${req.body.orderProperties.orderId} with preview: ${(req.body.channel === 'preview')}`));
                return await self.doRequest(buildUpdateOrderOptionsRequest(params));
            },
        
            /**
             * getOrder search the current status in a order.
             * @param {Object} req - Request payload. It already contains order id to be consulted.
             * See OCC REST Documentation for more information.
             * @returns {Promise}
             */
            async getOrder(req){
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'getOrder' }];
                let accessToken = await self.authenticationOperations().getToken(req);

                if (accessToken.error)
                    return accessToken;

                let params = {
                    channel: req.body.channel,
                    occParameters: req.app.get('occParameters'),
                    orderId: req.body.orderProperties.orderId,
                    accessToken
                }

                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Oracle Commerce Cloud: Getting order ${req.body.orderProperties.orderId} with preview: ${(req.body.channel === 'preview')}`));

                return await self.doRequest(buildGetOrderOptionsRequest(params));
            }
        }
    };

    //Admin operation namespace
    adminOperations(){
        let self = this;
        let messagePrefix =[{ key:'Operation', value: 'getGatewaySettings' }];

        let buildGetGatewaySettingsOptionsRequest = (params) => {
            let options = {
                url: `https://${params.occParameters.adminUrl}/ccadmin/${params.occParameters.apiVersion}/sitesettings/${params.occParameters.extensionName}`,
                qs: {
                    preview: params.channel === 'preview'
                },
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${params.accessToken}`
                }
            }
            return options
        };

        return {
            /**
             * getGatewaySettings searchs the gatewaySettings into OCC Settings.
             * @param {Object} req - Request payload 
             * @returns {Promise}
             */
            async getGatewaySettings(req){
                try{
                    let accessToken = await self.authenticationOperations().getToken(req)

                    if (accessToken.error)
                        return accessToken;

                    let params = {
                        channel: req.body.channel,
                        occParameters: req.app.get('occParameters'),
                        accessToken
                    }
                    
                    logger.log('info',loggerHandler.formatMessage(messagePrefix,'Oracle Commerce Cloud: Getting gateway settings'));
                    let gatewaySettings = await self.doRequest(buildGetGatewaySettingsOptionsRequest(params));
                    let gatewaySettingsPathConfig = OracleCommerceCloud.DEFAUT_GATEWAY_SETTINGS;

                    if (gatewaySettings.error)
                        return gatewaySettings;

                    gatewaySettings = JSON.parse(gatewaySettings);
                    gatewaySettingsPathConfig.push((req.body.channel === 'preview')? 'preview':'storefront');
                    
                    for (let i = 0; i < gatewaySettingsPathConfig.length; i++)
                        gatewaySettings = gatewaySettings[gatewaySettingsPathConfig[i]];
                    
                    return gatewaySettings;
                }
                catch(e){
                    logger.log('error',loggerHandler.formatMessage(messagePrefix,`Oracle Commerce Cloud: ${e.message}`));
                    logger.log('error',loggerHandler.formatMessage(messagePrefix,'%O'),e);
                    
                    return {
                        message: e.message,
                        error:true
                    };
                }
            }
        }
    };

    //Normalize operations namespace
    normalizeOperations(){

        return {

            normalizeOccOrderProperties(payload, isOrderDetails=false) {
                
                if(payload.error)
                    return payload;

                let customProperties;
                if (isOrderDetails){
                    if (payload.paymentGroups[0].authorizationStatus[0].statusProps.customProperties)
                        customProperties = JSON.parse(payload.paymentGroups[0].authorizationStatus[0].statusProps.customProperties);
                }
                else
                    customProperties = payload.customProperties;
                
                // Set properties from checkout request payload or order submit webhook request payload
                let orderProperties = {
                    orderId: (isOrderDetails)? payload.id : payload.orderId,
                    state: (isOrderDetails)? payload.state : undefined,
                    paymentInfo: {
                        paymentGroupId:(isOrderDetails)? payload.paymentGroups[0].id : payload.paymentId || payload.referenceNumber,
                        amount: Number((isOrderDetails)? payload.paymentGroups[0].amount : payload.amount)*100, // Parse amount to cents
                        currencyCode: (isOrderDetails)? payload.paymentGroups[0].currencyCode : payload.currencyCode,
                        type: (isOrderDetails)? payload.paymentGroups[0].paymentMethod : customProperties.paymentType,
                        gatewayId: (isOrderDetails)? payload.paymentGroups[0].gatewayName : payload.gatewayId,
                        state: (isOrderDetails)? payload.paymentGroups[0].state : undefined,
                        paymentAuthorizatedProperties: (isOrderDetails)? payload.paymentGroups[0].authorizationStatus : undefined
                    },
                    siteId: payload.siteId,
                    cartInfo: JSON.parse(customProperties.cartItems),
                    shopperInfo: {
                        id: (isOrderDetails)? payload.profileId : payload.profile.id,
                        document: customProperties.identity,
                        documentType: customProperties.identityType,
                        dateOfBirth: (isOrderDetails)? customProperties.dateOfBirth : payload.profileDetails.dateOfBirth
                    },
                    shippingAsBilling: customProperties.shippingAsBilling,
                    shippingAddress: (isOrderDetails)? payload.shippingGroups[0].shippingAddress : payload.shippingAddress,
                    billingAddress: (isOrderDetails)? payload.paymentGroups[0].billingAddress : payload.billingAddress,
                    customProperties: customProperties,
                    shopperDeviceIp: (isOrderDetails)? payload.paymentGroups[0].authorizationStatus[0].statusProps.shopperDeviceIp : payload.shopperDeviceIp
                }

                orderProperties.shopperInfo.name = `${orderProperties.shippingAddress.firstName || ''} ${orderProperties.shippingAddress.middleName || ''} ${orderProperties.shippingAddress.lastName || ''}`.split('  ').join(' ');
                
                if (orderProperties.shopperInfo.dateOfBirth && isOrderDetails)
                    orderProperties.customProperties.dateOfBirth = orderProperties.shopperInfo.dateOfBirth

                if (orderProperties.paymentInfo.paymentAuthorizatedProperties)
                    orderProperties.paymentInfo.paymentAuthorizatedProperties[0].transactionId = orderProperties.paymentInfo.paymentAuthorizatedProperties[0].statusProps.occs_tx_id;

                if (orderProperties.paymentInfo.type === 'creditCard'){

                    orderProperties.paymentInfo.cardInfo = (isOrderDetails)? orderProperties.customProperties.cardDetails : payload.cardDetails;
                    orderProperties.customProperties.cardDetails = orderProperties.paymentInfo.cardInfo;

                    if(orderProperties.customProperties.securityCardProperties)
                        orderProperties.paymentInfo.securityCardProperties = JSON.parse(orderProperties.customProperties.securityCardProperties);
                    
                    orderProperties.paymentInfo.installments = orderProperties.customProperties.paymentInstallments || '1';                
                }

                orderProperties.shippingAddress.number = orderProperties.shippingAddress.address2; 
                orderProperties.shippingAddress.complement = orderProperties.shippingAddress.address3;
                orderProperties.shippingAddress.district = orderProperties.shippingAddress.county;

                if (orderProperties.paymentInfo.type === 'cash'){
                    orderProperties.shopperInfo.email = (isOrderDetails)? orderProperties.shippingAddress.email : payload.profile.email;
                    orderProperties.shopperInfo.phoneNumber = (isOrderDetails)? orderProperties.shippingAddress.phoneNumber : payload.profile.phoneNumber || payload.billingAddress.phoneNumber || payload.shippingAddress.phoneNumber;
                }
                else{
                    orderProperties.shopperInfo.email = (isOrderDetails)? orderProperties.billingAddress.email || orderProperties.shippingAddress.email : payload.profile.email;
                    orderProperties.shopperInfo.phoneNumber = (isOrderDetails)? orderProperties.billingAddress.phoneNumber || orderProperties.shippingAddress.phoneNumber : payload.profile.phoneNumber || payload.billingAddress.phoneNumber || payload.shippingAddress.phoneNumber;                    

                    orderProperties.billingAddress.number = (orderProperties.shippingAsBilling)? orderProperties.shippingAddress.number : orderProperties.billingAddress.address2; 
                    orderProperties.billingAddress.complement = (orderProperties.shippingAsBilling)? orderProperties.shippingAddress.complement : orderProperties.billingAddress.address3;
                    orderProperties.billingAddress.district =  (orderProperties.shippingAsBilling)? orderProperties.shippingAddress.district : orderProperties.billingAddress.county;
                }

                /* -------------------------- Treat special characters -------------------------- 
                    1 - Remove special characters: (/[\u0300-\u036f,\\/@#$%¨&*()§°ºª?+--_=<>|]/g, "")
                    2 - Remove white spaces characters before between words: (/\B\s+|\s+\B/g). Example: Input:  hello world! , this is Cecy and D ’ EL - REI  , Output: hello world!,this is Cecy and D’EL-REI
                */
               orderProperties.shopperInfo.phoneNumber = (orderProperties.shopperInfo.phoneNumber) ? orderProperties.shopperInfo.phoneNumber.replace(/[() -]/gi,"") : orderProperties.shopperInfo.phoneNumber;
               orderProperties.shippingAddress.phoneNumber = (orderProperties.shippingAddress.phoneNumber) ? orderProperties.shippingAddress.phoneNumber.replace(/[() -]/gi,"") : orderProperties.shippingAddress.phoneNumber;
               orderProperties.billingAddress.phoneNumber = (orderProperties.billingAddress.phoneNumber) ? orderProperties.billingAddress.phoneNumber.replace(/[() -]/gi,"") : orderProperties.billingAddress.phoneNumber;

               orderProperties.shippingAddress.address1 = (orderProperties.shippingAddress.address1) ? orderProperties.shippingAddress.address1/*.substring(0, 60)*/.normalize('NFD').replace(/[\u0300-\u036f,\\/@#$%¨&*()§°ºª?+--_=<>|]/g, "").replace(/\B\s+|\s+\B/g,"") : orderProperties.shippingAddress.address1;
               orderProperties.billingAddress.address1 = (orderProperties.billingAddress.address1) ? orderProperties.billingAddress.address1/*.substring(0, 60)*/.normalize('NFD').replace(/[\u0300-\u036f,\\/@#$%¨&*()§°ºª?+--_=<>|]/g, "").replace(/\B\s+|\s+\B/g,"") : orderProperties.billingAddress.address1;
               
               orderProperties.shippingAddress.number = orderProperties.shippingAddress.address2 = (orderProperties.shippingAddress.address2) ?orderProperties.shippingAddress.address2.substring(0, 10) : orderProperties.shippingAddress.address2;
               orderProperties.billingAddress.number = orderProperties.billingAddress.address2 = (orderProperties.billingAddress.address2) ? orderProperties.billingAddress.address2.substring(0, 10) : orderProperties.billingAddress.address2;

               orderProperties.shippingAddress.complement = orderProperties.shippingAddress.address3 = (orderProperties.shippingAddress.address3) ? orderProperties.shippingAddress.address3/*.substring(0, 60)*/.normalize('NFD').replace(/[\u0300-\u036f,\\/@#$%¨&*()§°ºª?+--_=<>|]/g, "").replace(/\B\s+|\s+\B/g,"") : orderProperties.shippingAddress.address3;
               orderProperties.billingAddress.complement = orderProperties.billingAddress.address3 = (orderProperties.billingAddress.address3) ? orderProperties.billingAddress.address3/*.substring(0, 60)*/.normalize('NFD').replace(/[\u0300-\u036f,\\/@#$%¨&*()§°ºª?+--_=<>|]/g, "").replace(/\B\s+|\s+\B/g,"") : orderProperties.billingAddress.address3;
               
               orderProperties.shippingAddress.city = (orderProperties.shippingAddress.city) ? orderProperties.shippingAddress.city/*.substring(0, 60)*/.normalize('NFD').replace(/[\u0300-\u036f,\\/@#$%¨&*()§°ºª?+--_=<>|]/g, "").replace(/\B\s+|\s+\B/g,"") : orderProperties.shippingAddress.city;
               orderProperties.billingAddress.city = (orderProperties.billingAddress.city) ? orderProperties.billingAddress.city/*.substring(0, 60)*/.normalize('NFD').replace(/[\u0300-\u036f,\\/@#$%¨&*()§°ºª?+--_=<>|]/g, "").replace(/\B\s+|\s+\B/g,"") : orderProperties.billingAddress.city;

               orderProperties.shippingAddress.district = orderProperties.shippingAddress.county = (orderProperties.shippingAddress.county) ? orderProperties.shippingAddress.county.substring(0, 15).normalize('NFD').replace(/[\u0300-\u036f,\\/@#$%¨&*()§°ºª?+--_=<>|]/g, "").replace(/\B\s+|\s+\B/g,"") : orderProperties.shippingAddress.county;
               orderProperties.billingAddress.district = orderProperties.billingAddress.county = (orderProperties.billingAddress.county) ? orderProperties.billingAddress.county.substring(0, 15).normalize('NFD').replace(/[\u0300-\u036f,\\/@#$%¨&*()§°ºª?+--_=<>|]/g, "").replace(/\B\s+|\s+\B/g,"") : orderProperties.billingAddress.county;

                return orderProperties;
            },
            
            normalizeResponseByAcquirerModel(paymentResult){
                let acquire = {
                    braspagTransactionId: paymentResult.Payment.PaymentId || undefined, //Transaction Id Braspag
                    transactionId: paymentResult.Payment.AcquirerTransactionId, //Acquirer - trasaction id ,
                    uniqueSequentialNumber: paymentResult.Payment.ProofOfSale,  //Acquirer - proof of sale number
                    authorizationCode: paymentResult.Payment.AuthorizationCode, //Acquirer - authorization code
                    saleDate: paymentResult.Payment.ReceivedDate //Acquirer - transaction authorization date
                }

                return acquire;
            }
        }
    }

    //OCC webhook operation namespace
    webhookOperations(){
        let self = this;

        return {
            async notificationRequestHandler(req, res){
                let messagePrefix =[
                    { key:'Order', value: req.body.order.id },
                    { key:'Operation', value: 'notificationRequestHandler' },
                ];
                
                logger.log('info',loggerHandler.formatMessage(messagePrefix,'Oracle Commerce Cloud: Processing order submit webhook notification'));
                req.body.orderProperties = self.normalizeOperations().normalizeOccOrderProperties(req.body.order, true);

                try{
                    let ENEXT_PAYMENT_SERVICES = new enextPaymentServiceClass(req.body.gatewaySettings.paymentProviderName);
                    ENEXT_PAYMENT_SERVICES.setPaymentProviderImplementation = ENEXT_PAYMENT_SERVICES.getPaymentProviderName;
                    
                    //Process pre authorized orders
                    if (req.body.orderProperties.paymentInfo.type === 'creditCard' && req.body.gatewaySettings.useAntiFraudAnalysis)
                        return ENEXT_PAYMENT_SERVICES.checkoutOperations(req.body.orderProperties.orderId).checkoutRequestHandler(req, res, true).then((result)=>result, (err)=> err);
                    //Process authorized orders
                    else{
                        //Get payment transaction details
                        req.body.paymentProviderProperties = {
                            paymentProviderTransactionId: req.body.orderProperties.paymentInfo.paymentAuthorizatedProperties[0].statusProps.paymentProviderTransactionId
                        };
                        logger.log('info',loggerHandler.formatMessage(messagePrefix,'Oracle Commerce Cloud: Getting payment transaction details'));
                        req.body.paymentProviderProperties = await ENEXT_PAYMENT_SERVICES.paymentOperations(req.body.orderProperties.orderId).getPaymentTransactionStatus(req, req.body.paymentProviderProperties.paymentProviderTransactionId);

                        if (req.body.paymentProviderProperties.error){
                            logger.log('error',loggerHandler.formatMessage(messagePrefix,`Oracle Commerce Cloud: An error has occurred when get payment transaction details has been processed. Message: ${req.body.paymentProviderProperties.message}`));
                            logger.log('error',loggerHandler.formatMessage(messagePrefix,'%o'), req.body.paymentProviderProperties);

                            return res
                            .status(req.body.paymentProviderProperties.statusCode || 500)
                            .json({message: `Enext Custom Payment Gateway: An error has occurred when get payment transaction details has been processed. Message: ${req.body.paymentProviderProperties.message}`})
                            .end();
                        }
                        
                        req.body.antifraudProviderProperties = undefined;

                        if(req.body.orderProperties.paymentInfo.paymentAuthorizatedProperties[0].statusProps.antifraudProviderTransactionId){
                            //Get antifraud transaction details
                            let ENEXT_ANTIFRAUD_SERVICES = new enextAnfifraudServiceClass(req.body.gatewaySettings.antifraudProviderName);
                            ENEXT_ANTIFRAUD_SERVICES.setAntifraudProviderImplementation = ENEXT_ANTIFRAUD_SERVICES.getAntifraudProviderName;

                            req.body.antifraudProviderProperties = {
                                antifraudProviderTransactionId: req.body.orderProperties.paymentInfo.paymentAuthorizatedProperties[0].statusProps.antifraudProviderTransactionId
                            };
                            logger.log('info',loggerHandler.formatMessage(messagePrefix,'Oracle Commerce Cloud: Getting antifraud transaction details'));
                            req.body.antifraudProviderProperties = ENEXT_ANTIFRAUD_SERVICES.normalizeOperations().normalizeResponseByNotificationModel(await ENEXT_ANTIFRAUD_SERVICES.analysisOperations(req.body.orderProperties.orderId).getAntifraudTransactionStatus(req, req.body.antifraudProviderProperties.antifraudProviderTransactionId));

                            if (req.body.antifraudProviderProperties.error){
                                logger.log('error',loggerHandler.formatMessage(messagePrefix,`Oracle Commerce Cloud: An error has occurred when get antifraud transaction details has been processed. Message: ${req.body.antifraudProviderProperties.message}`));
                                logger.log('error',loggerHandler.formatMessage(messagePrefix,'%o'), req.body.antifraudProviderProperties);

                                return res
                                .status(req.body.antifraudProviderProperties.statusCode || 500)
                                .json({ message:`Enext Custom Payment Gateway: An error has occurred when get antifraud transaction details has been processed. Message: ${req.body.antifraudProviderProperties.message}`})
                                .end();
                            }

                            if(req.body.antifraudProviderProperties.antifraudTransactionStatus !== ENEXT_ANTIFRAUD_SERVICES.antifraudWebHookOperations().getStatusAllowedToCaptureOrder() &&
                                req.body.antifraudProviderProperties.antifraudTransactionStatus !== ENEXT_ANTIFRAUD_SERVICES.antifraudWebHookOperations().getStatusUnallowedToCaptureOrder()){
                                
                                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Oracle Commerce Cloud: Notification received, but the order ${req.body.orderProperties.orderId} are await an notification from antifraud provider`));
                                return res
                                .status(200)
                                .json({message:`Enext Custom Payment Gateway: Notification received, but the order ${req.body.orderProperties.orderId} are await an notification from antifraud provider`})
                                .end();
                            }
                        }

                        logger.log('info',loggerHandler.formatMessage(messagePrefix,'Oracle Commerce Cloud: Sending data to payment decision manager'));
                        return await ENEXT_PAYMENT_SERVICES.paymentWebHookOperations(req.body.orderProperties.orderId).decisionManager(req, res);
                    }
                }
                catch(e){
                    logger.log('error',loggerHandler.formatMessage(messagePrefix,`Oracle Commerce Cloud: ${e.message}`));
                    logger.log('error',loggerHandler.formatMessage(messagePrefix,'%O'),e);

                    return res
                    .status(500)
                    .json({ message: e.message})
                    .end();
                }
            }
        }
    };
}