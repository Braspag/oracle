const Utils = require('../../../helpers/utils');
const OracleCommerceCloud = require('../../../helpers/occ');
const EnextPaymentServices = require('../../enextServices/enextPaymentService');
const loggerHandler = require('../../../helpers/logger');
const logger = loggerHandler.LoggerBuilder();
const querystring = require('querystring');
const btoa = require('btoa');

module.exports = class Cybersource{

    constructor(){
        this.UTILS = new Utils();
        this.OCC = new OracleCommerceCloud();
    }

    static get CARD_BRANDS(){
        return {
            elo: 'Elo',
            visa: 'Visa',
            mastercard: 'Master',
            amex: 'Amex'
        }
    };

    static get ANALYSIS_STATUS(){
        return {
            0: 'Unknown',
            1: 'Accept',
            2: 'Reject',
            3: 'Review',
            4: 'Aborted',
            5: 'Unfinished'
        }
    };

    static get STATUS_ALLOWED_TO_CAPTURE_ORDER(){
        return 'Accept';
    }

    static get STATUS_UNALLOWED_TO_CAPTURE_ORDER(){
        return 'Reject';
    }

    static get RESPONSE_CODE(){
        return {
            Accept: OracleCommerceCloud.APPROV_CODE,
            Review: OracleCommerceCloud.APPROV_CODE,
            Reject: OracleCommerceCloud.REPROV_CODE,
            Pendent: OracleCommerceCloud.REPROV_CODE,
            Unfinished: OracleCommerceCloud.REPROV_CODE,
            ProviderError: OracleCommerceCloud.REPROV_CODE
        };
    }

    static restApiErrorHandler(err){
        if (err.error){
            if (err.error.Message){
                let parsedResponse = (err.error.length)? err.error[0]:err.error;
                let statusCode = 500;
                let _continue = false;
    
                if (parsedResponse.ModelState){
                    if (parsedResponse.ModelState.FraudAnalysisRequestError){
                        statusCode = 200;
                        if (Array.isArray(parsedResponse.ModelState.FraudAnalysisRequestError))
                            parsedResponse.Message = parsedResponse.ModelState.FraudAnalysisRequestError[0];
                        else
                            parsedResponse.Message = parsedResponse.ModelState.FraudAnalysisRequestError;             
                    }
                }
                                
                return {
                    statusCode,
                    message: parsedResponse.Message,
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

    async doRequest(options){ return await this.UTILS.requestUtils().doRequest(options, 0, Cybersource); }

    authenticationOperations(){
        let self = this;

        // Getting access token in the API
        let auth = async (gatewaySettings) => {
            let options = {
                url: `${gatewaySettings.antifraudProviderAuthEndpoint}/oauth2/token`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${btoa(`${gatewaySettings.antifraudProviderClientId}:${gatewaySettings.antifraudProviderClientSecret}`)}`
                },
                body: querystring.stringify({ 'scope': 'AntifraudGatewayApp', 'grant_type': 'client_credentials' }),
                json: true
            }
            return await self.doRequest(options);
        };

        return {
            // Setting in the memory the access token
            async getToken(gatewaySettings, app){
                let messagePrefix = [
                    { key:'AntifraudProvider', value: 'cybersource'},
                    { key:'Operation', value: 'getToken' }
                ];

                logger.log('info',loggerHandler.formatMessage(messagePrefix,'Cybersource Antifraud Provider: Processing getToken'));

                var credentials = app.get('cybersource_credentials');

                if(credentials === undefined || credentials.ExpirationDate === undefined || credentials.ExpirationDate === "" || (new Date(credentials.ExpirationDate) < new Date())){
                    logger.log('info',loggerHandler.formatMessage(messagePrefix,'Cybersource Antifraud Provider: There is no Token or this is expirated'));
                    
                    let result = await auth(gatewaySettings);

                    if (!result.error){
                        //Setting credentials to cluster memory
                        let treat_credentials = {};
                        treat_credentials.Token = result.access_token;
                        treat_credentials.ExpirationDate = new Date(new Date()+(result.expires_in * 1000));
                        app.set('cybersource_credentials', treat_credentials)

                        logger.log('info',loggerHandler.formatMessage(messagePrefix,'Cybersource Antifraud Provider: New token requested'));
                    }
                    else{
                        logger.log('error',loggerHandler.formatMessage(messagePrefix,`Cybersource Antifraud Provider: An error has occurred while request to get Token from Cybersource was made. Message: ${result.message}`));
                        logger.log('error', loggerHandler.formatMessage(messagePrefix,'%O'), result);
                    }
                }
                else{
                    logger.log('info',loggerHandler.formatMessage(messagePrefix,'Cybersource Antifraud Provider: There is a valid token'));
                    logger.log('info',loggerHandler.formatMessage(messagePrefix,'%O'), app.get('cybersource_credentials'));
                }
            }
        }
    };

    analysisOperations(orderId){
        let self = this;
        let messagePrefix = [
            { key:'AntifraudProvider', value: 'cybersource' }
        ];
        if (orderId)
            messagePrefix.push({ key:'Order', value: orderId });

        let functionScopeMessagePrefix;

        let buildAnalysisOptionsRequest = (req, orderRequest, gatewaySettings) => {
            let options = {
                url: `${gatewaySettings.antifraudProviderEndpoint}/analysis/v2/`,
                method: 'POST',
                headers: {
                    'Content-Type':'application/json',
                    'Authorization': `Bearer ${req.app.get('cybersource_credentials').Token}`,
                    'MerchantId': gatewaySettings.antifraudProviderMerchantId
                },
                body: orderRequest,
                json: true
            };

            return options;
        };

        let buildAssociationTransactionObjectRequest = (req) => {
            let body = {};
            
            if (req.body.acquirerProperties.braspagTransactionId)
                body.BraspagTransactionId = req.body.acquirerProperties.braspagTransactionId;
            else{
                body.Tid = req.body.acquirerProperties.transactionId,
                body.Nsu = req.body.acquirerProperties.uniqueSequentialNumber,
                body.AuthorizationCode = req.body.acquirerProperties.authorizationCode,
                body.SaleDate = req.body.acquirerProperties.saleDate
            }

            return body;
        };

        let buildAssociationTransactionOptionsRequest = (req, transactionId) => {
            let options = {
                url: `${req.body.gatewaySettings.antifraudProviderEndpoint}/transaction/${transactionId}`,
                method: (req.body.acquirerProperties.braspagTransactionId)? 'PATCH':'PUT',
                headers: {
                    'Content-Type':'application/json',
                    'Authorization': `Bearer ${req.app.get('cybersource_credentials').Token}`,
                    'MerchantId': req.body.gatewaySettings.antifraudProviderMerchantId
                },
                body: buildAssociationTransactionObjectRequest(req),
                json: true
            };
            return options;
        };

        let buildGetAntifraudTransactionStatusOptionsRequest = (params) => {
            let options = {
                url: `${params.gatewaySettings.antifraudProviderEndpoint}/analysis/v2/${params.transactionId}`,
                method: 'GET',
                headers: {
                    'Content-Type':'application/json',
                    'Authorization': `Bearer ${params.req.app.get('cybersource_credentials').Token}`,
                    'MerchantId': params.gatewaySettings.antifraudProviderMerchantId
                },
                json: true
            };
            return options;
        };
        
        //This method builds an object to send to Braspag Cybersource Antifraud
        let buildAnalysisObjectRequest = (req) => {

            req.body.cybersourceProperties = self.normalizeOperations().normalizeCybersourceFingerprintProperties(req.body.orderProperties);
            let orderProperties = req.body.orderProperties;
            let cybersourceProperties = req.body.cybersourceProperties;

            if (!orderProperties.customProperties.browserFingerprint)
                throw new Error('The field browserFingerprint is missing, check your fingerprint implementation');
            
            if (!orderProperties.customProperties.cartItems)
                throw new Error('The field cartItems is missing, check your checkout implementation');

            let body = {
                MerchantOrderId: orderProperties.orderId,
                TotalOrderAmount: orderProperties.paymentInfo.amount,
                TransactionAmount: orderProperties.paymentInfo.amount,
                Currency: orderProperties.paymentInfo.currencyCode,
                Provider: 'Cybersource',
                Card: {
                    Brand: (orderProperties.paymentInfo.cardInfo.type)? Cybersource.CARD_BRANDS[orderProperties.paymentInfo.cardInfo.type]:Cybersource.CARD_BRANDS[orderProperties.paymentInfo.securityCardProperties.brand],
                    Cvv: orderProperties.paymentInfo.cardInfo.cvv || orderProperties.paymentInfo.securityCardProperties.cvv
                },
                Billing: {
                    Street: orderProperties.billingAddress.address1, 
                    Number: orderProperties.billingAddress.number, 
                    Neighborhood: orderProperties.billingAddress.district, 
                    City: orderProperties.billingAddress.city, 
                    State: orderProperties.billingAddress.state, 
                    Country: orderProperties.billingAddress.country, 
                    ZipCode: orderProperties.billingAddress.postalCode 
                },
                Shipping: {
                    Street: orderProperties.shippingAddress.address1, 
                    Number: orderProperties.shippingAddress.number, 
                    Neighborhood: orderProperties.shippingAddress.district, 
                    City: orderProperties.shippingAddress.city, 
                    State: orderProperties.shippingAddress.state, 
                    Country: orderProperties.shippingAddress.country, 
                    ZipCode: orderProperties.shippingAddress.postalCode, 
                    FirstName: orderProperties.shippingAddress.firstName, 
                    LastName: orderProperties.shippingAddress.lastName, 
                    Phone: orderProperties.shippingAddress.phoneNumber 
                },
                Customer: {
                    MerchantCustomerId: orderProperties.shopperInfo.document, 
                    FirstName: orderProperties.shippingAddress.firstName, 
                    LastName: orderProperties.shippingAddress.lastName, 
                    BirthDate: orderProperties.shopperInfo.dateOfBirth, 
                    Email: orderProperties.shopperInfo.email, 
                    Phone: orderProperties.shopperInfo.phoneNumber, 
                    Ip: cybersourceProperties.browser.ipAddress, 
                    BrowserHostName: cybersourceProperties.browser.hostName, 
                    BrowserCookiesAccepted: cybersourceProperties.browser.cookiesAccepted,
                    BrowserEmail: cybersourceProperties.browser.email, 
                    BrowserType: cybersourceProperties.browser.type, 
                    BrowserFingerprint: cybersourceProperties.fingerprint 
                },
                CartItems: []
            };

            // Used for payment with tokenized cards by Braspag
            if(req.body.gatewaySettings.paymentProviderName === 'braspag' && orderProperties.paymentInfo.securityCardProperties.token)
                body.Card.Token = orderProperties.paymentInfo.securityCardProperties.token
            else{
                body.Card = {
                    Number: orderProperties.paymentInfo.cardInfo.number, 
                    Holder: orderProperties.paymentInfo.cardInfo.holderName, 
                    ExpirationDate: `${orderProperties.paymentInfo.cardInfo.expirationMonth}/${orderProperties.paymentInfo.cardInfo.expirationYear}`,
                    // Save: orderProperties.paymentInfo.securityCardProperties.saveCard
                };

                // if(orderProperties.paymentInfo.securityCardProperties.alias)
                //     body.Card.Alias = orderProperties.paymentInfo.securityCardProperties.alias
            }

            if (orderProperties.shippingAddress.complement){
                body.Billing.Complement = orderProperties.billingAddress.complement; 
                body.Shipping.Complement = orderProperties.shippingAddress.complement; 
            }

            if (cybersourceProperties.merchantDefinedFields)
                body.MerchantDefinedFields = cybersourceProperties.merchantDefinedFields; 
            
            for (let i in orderProperties.cartInfo){
                let item = orderProperties.cartInfo[i];
                let itemProperties = {
                    ProductName: item.displayName, //item.productDisplayName,
                    UnitPrice: (item.detailedItemPriceInfo[0].detailedUnitPrice)*100, //(item.priceInfo.amount)*100,
                    Sku: item.catRefId || item.productId, //SKU do produto | item.productId - SKU do produto pai
                    Quantity: item.quantity
                };

                body.CartItems.push(itemProperties);
            }

            if (req.body.acquirerProperties){ //Fields of acquirer received from payment provider
                if (req.body.acquirerProperties.braspagTransactionId)
                    body.BraspagTransactionId = req.body.acquirerProperties.braspagTransactionId;
                else{
                    body.Tid = req.body.acquirerProperties.transactionId;
                    body.Nsu = req.body.acquirerProperties.uniqueSequentialNumber;
                    body.AuthorizationCode = req.body.acquirerProperties.authorizationCode;
                    body.SaleDate = req.body.acquirerProperties.saleDate;
                }
            }

            return body;
        };

        return{

            async buildAnalysisObjectToFullIntegrationRequest(req){
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'buildAnalysisObjectToFullIntegrationRequest' }];
                try{

                    req.body.cybersourceProperties = self.normalizeOperations().normalizeCybersourceFingerprintProperties(req.body.orderProperties);
                    let orderProperties = req.body.orderProperties;
                    let cybersourceProperties = req.body.cybersourceProperties;
                    let gatewaySettings = req.body.gatewaySettings

                    if (!orderProperties.customProperties.browserFingerprint) 
                        throw new Error('The field browserFingerprint is missing, check your fingerprint implementation');
                    
                    if (!orderProperties.cartInfo)
                        throw new Error('The field cartItems is missing, check your checkout implementation');
                    
                    let body = {
                        Sequence: (gatewaySettings.antifraudProviderFirstOperation === 'analyze')? 'AnalyseFirst':'AuthorizeFirst',
                        SequenceCriteria: gatewaySettings.antifraudProviderSequenceCriteria,
                        Provider: 'Cybersource',
                        CaptureOnLowRisk: gatewaySettings.antifraudProviderCaptureOnLowRisk || false,
                        VoidOnHighRisk: gatewaySettings.antifraudProviderVoidOnHighRisk || false,
                        TotalOrderAmount: orderProperties.paymentInfo.amount,
                        FingerPrintId: cybersourceProperties.fingerprint,
                        Browser: {
                            HostName: cybersourceProperties.browser.hostName,
                            CookiesAccepted: cybersourceProperties.browser.cookiesAccepted,
                            Email: cybersourceProperties.browser.email,
                            Type: cybersourceProperties.browser.type,
                            IpAddress: cybersourceProperties.browser.ipAddress
                        },
                        Cart: {
                            Items: []
                        },
                        Shipping: {
                            Addressee: orderProperties.shopperInfo.name
                        }
                    };

                    if (cybersourceProperties.merchantDefinedFields)
                        body.MerchantDefinedFields = cybersourceProperties.merchantDefinedFields;

                    for (let i in orderProperties.cartInfo){
    
                        let item = orderProperties.cartInfo[i];
                        let itemProperties = {
                            Name: item.displayName,
                            UnitPrice: (item.detailedItemPriceInfo[0].detailedUnitPrice)*100,
                            Sku: item.catRefId || item.productId, // item.catRefId - (SKU do produto) | item.productId - (SKU do produto pai)
                            Quantity: item.quantity
                        };

                        body.Cart.Items.push(itemProperties);
                    }
                    
                    return body;
                }
                catch(e){
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix, `Cybersource Antifraud Provider: An error has occurred when buildAnalysisObjectToFullIntegrationRequest was processed. Message: ${e.message}`));
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%O'),e);

                    return {
                        message: e.message,
                        error:true
                    };
                }
            },

            // Insert transaction to analysis
            async sendToAnalysis(req){
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'sendToAnalysis' }];

                try{
                    logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Cybersource Antifraud Provider: Submiting order to analysis in antifraud'));
    
                    await self.authenticationOperations().getToken(req.body.gatewaySettings, req.app);
    
                    logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Cybersource Antifraud Provider: Antifraud access token generated successfully'));
                    
                    let orderRequest = buildAnalysisObjectRequest(req);
                    logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Cybersource Antifraud Provider: Object sent to Cybersource %j'), orderRequest);
                    logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Cybersource Antifraud Provider: Submitting data of payment to fraud analysis'));
                    
                    let result = await self.doRequest(buildAnalysisOptionsRequest(req, orderRequest, req.body.gatewaySettings));

                    if(!result.error){
                        if(Cybersource.RESPONSE_CODE[result.Status] === OracleCommerceCloud.APPROV_CODE || Cybersource.RESPONSE_CODE[result.Status] === OracleCommerceCloud.REPROV_CODE){
                            result.antifraudTransactionId = result.TransactionId;
                            result.ResponseCode = Cybersource.RESPONSE_CODE[result.Status];
                            result.ReasonMessage = `Antifraud provider returned status: ${result.Status}`;
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Cybersource Antifraud Provider: Analisys result %j'),result);
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Cybersource Antifraud Provider: TransactionId added to result, antifraud returned status: ${result.Status}`));
                            
                            return result;
                        }
                        else{
                            logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Cybersource Antifraud Provider: Antifraud return invalid status ${result.Status}`));
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Cybersource Antifraud Provider: %j'),result);
                            return {
                                ResponseCode: OracleCommerceCloud.REPROV_CODE,
                                ReasonMessage: `Cybersource Antifraud Provider: Antifraud return invalid status ${result.Status}`
                            };
                        }
                    }
                    
                    result.ResponseCode = OracleCommerceCloud.REPROV_CODE;
                    result.ReasonMessage = result.message;
                    return result;
                }
                catch(e){
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Cybersource Antifraud Provider: Antifraud Request Error, Message: ${e.message}`));
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%O'),e);

                    return {
                        ResponseCode: OracleCommerceCloud.REPROV_CODE,
                        ReasonMessage: e.message,
                        message: e.message,
                        error: true
                    }
                }
            },
            
            async associationTransaction(req, transactionId){
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'AntifraudTransaction', value: transactionId }, { key:'Operation', value: 'associationTransaction' }];

                try{
                    await self.authenticationOperations().getToken(req.body.gatewaySettings, req.app);
                    return await self.doRequest(buildAssociationTransactionOptionsRequest(req, transactionId));
                }
                catch(e){
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Cybersource Antifraud Provider: An error has occurred when association transaction was processed. Message: ${e.message}`));
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%O'),e);
                    return {
                        message: e.message,
                        error:true
                    };
                }
            },

            async getAntifraudTransactionStatus(req, transactionId){
                functionScopeMessagePrefix = [
                    ...messagePrefix,
                    { key:'Operation', value: 'getTransactionStatus' },
                    { key:'AntifraudTransaction', value: transactionId }
                ];

                try{
                    await self.authenticationOperations().getToken(req.body.gatewaySettings, req.app);
           
                    let params = {
                        gatewaySettings: req.body.gatewaySettings,
                        req,
                        transactionId
                    }
                    return await self.doRequest(buildGetAntifraudTransactionStatusOptionsRequest(params));   
                }
                catch(e){
                    logger.log('error', loggerHandler.formatMessage(functionScopeMessagePrefix,`Cybersource Antifraud Provider: An error has occurred when getTransactionStatus was processed. Message: ${e.message}`));
                    logger.log('error', loggerHandler.formatMessage(functionScopeMessagePrefix,'%O'),e);

                    return {
                        message: e.message,
                        error: true
                    };
                }
            }
        };
    }

    normalizeOperations(){
        return {

            normalizeResponseByNotificationModel(antifraudResult) {
                if (antifraudResult.error)
                    return antifraudResult;

                let payload = {
                    orderId: antifraudResult.MerchantOrderId,
                    antifraudTransactionStatus: antifraudResult.Status,
                    antifraudTransactionId: antifraudResult.TransactionId || antifraudResult.Id,
                    paymentTransactionId: antifraudResult.BraspagTransactionId || antifraudResult.PaymentId
                }
                return payload;
            },

            normalizeCybersourceFingerprintProperties(orderProperties) {

                let cybersourceProperties = {
                    fingerprint: orderProperties.customProperties.browserFingerprint,
                    merchantDefinedFields: JSON.parse(orderProperties.customProperties.merchantDefinedFields),
                    browser: {
                        hostName: orderProperties.customProperties.hostName,
                        cookiesAccepted: orderProperties.customProperties.browserCookiesAccepted,
                        email: orderProperties.shopperInfo.email,
                        type: orderProperties.customProperties.browserType,
                        ipAddress: orderProperties.shopperDeviceIp
                    }
                }
                return cybersourceProperties;
            }
        }
    }

    antifraudWebHookOperations(){
        let self = this;
        let messagePrefix = [{ key:'AntifraudProvider', value: 'cybersource' }];
        let functionScopeMessagePrefix;

        return {
            async notificationRequestHandler(req, res){
                functionScopeMessagePrefix = (() => {
                    let options = [
                        ...messagePrefix,
                        { key:'Operation', value: 'notificationRequestHandler' }
                    ];
                    
                    if (req.body.Id)
                        options.push({ key:'AntifraudTransaction', value: req.body.Id });

                    return options;
                })();

                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Cybersource Antifraud Provider: Processing antifraud notification'));
                
                try{
                    if(req.body.Id){

                        //Get transaction analysis details
                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Cybersource Antifraud Provider: Getting antifraud transaction details'));
                        req.body.antifraudProviderProperties = self.normalizeOperations().normalizeResponseByNotificationModel(await self.analysisOperations(null).getAntifraudTransactionStatus(req,req.body.Id));

                        if (req.body.antifraudProviderProperties.error){
                            logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Cybersource Antifraud Provider: An error has occurred when get antifraud transaction details has been processed. Message: ${req.body.antifraudProviderProperties.message}`));
                            logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%o'), req.body.antifraudProviderProperties);

                            return res
                            .status(500)
                            .json({ message:`Enext Custom Payment Gateway: An error has occurred when get antifraud transaction details has been processed. Message: ${req.body.antifraudProviderProperties.message}`})
                            .end();
                        }

                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Cybersource Antifraud Provider: New transaction status ${req.body.antifraudProviderProperties.antifraudTransactionStatus}`));
                        
                        //Get order details
                        req.body.orderProperties = {
                            orderId: req.body.antifraudProviderProperties.orderId
                        }

                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Cybersource Antifraud Provider: Getting order details'));
                        req.body.orderProperties = self.OCC.normalizeOperations().normalizeOccOrderProperties(await self.OCC.storeOperations(req.body.orderProperties.orderId).getOrder(req), true);

                        if (req.body.orderProperties.error){
                            logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Cybersource Antifraud Provider: An error has occurred when get order details has been processed. Message: ${req.body.orderProperties.message}`));
                            logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%o'), req.body.orderProperties);

                            return res
                            .status(req.body.orderProperties.statusCode || 500)
                            .json({message: `Enext Custom Payment Gateway: ${req.body.orderProperties.message}`})
                            .end();
                        }
                        else if (req.body.orderProperties.state === 'FAILED' || req.body.orderProperties.state === 'CREDIT_FAILED' || req.body.orderProperties.paymentInfo.state === 'AUTHORIZE_FAILED'){
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: The order ${req.body.orderProperties.id} state is ${req.body.orderProperties.state} and payment state is ${req.body.orderProperties.paymentGroups[0].state}. This order will not be processed, your state is not authorized to follow the payment flow`));

                            return res
                            .status(200)
                            .json({message: `Enext Custom Payment Gateway: The order ${req.body.orderProperties.id} state is ${req.body.orderProperties.state} and payment state is ${req.body.orderProperties.paymentGroups[0].state}. This order will not be processed, your state is not authorized to follow the payment flow`})
                            .end();
                        }
                        else{
                            if (!req.body.orderProperties.paymentInfo.paymentAuthorizatedProperties[0].statusProps.paymentProviderTransactionId){
                                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Cybersource Antifraud Provider: An error has occurred when notification request handler has been processed. Message: The order ${req.body.orderProperties.orderId} not contains paymentProviderTransactionId`));
    
                                return res
                                .status(500)
                                .json({message: `Enext Custom Payment Gateway: The order ${req.body.orderProperties.orderId} not contains paymentProviderTransactionId`})
                                .end();
                            }
                            
                            req.body.paymentProviderProperties = {
                                paymentProviderTransactionId: req.body.orderProperties.paymentInfo.paymentAuthorizatedProperties[0].statusProps.paymentProviderTransactionId
                            }                                
    
                            let ENEXT_PAYMENT_SERVICES = new EnextPaymentServices(req.body.gatewaySettings.paymentProviderName);
                            ENEXT_PAYMENT_SERVICES.setPaymentProviderImplementation = ENEXT_PAYMENT_SERVICES.getPaymentProviderName;
                            
                            //Get payment transaction details
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Cybersource Antifraud Provider: Getting payment transaction details'));
                            req.body.paymentProviderProperties = await ENEXT_PAYMENT_SERVICES.paymentOperations(req.body.orderProperties.orderId).getPaymentTransactionStatus(req, req.body.paymentProviderProperties.paymentProviderTransactionId);
    
                            if (req.body.paymentProviderProperties.error){
                                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Cybersource Antifraud Provider: An error has occurred when get payment transaction details has been processed. Message: ${req.body.paymentProviderProperties.message}`));
                                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%o'), req.body.paymentProviderProperties);
    
                                return res
                                .status(req.body.paymentProviderProperties.statusCode || 500)
                                .json({message: `Enext Custom Payment Gateway: ${req.body.paymentProviderProperties.message}`})
                                .end();
                            }
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Cybersource Antifraud Provider: Sending data to payment decision manager'));
                            return await ENEXT_PAYMENT_SERVICES.paymentWebHookOperations(req.body.orderProperties.orderId).decisionManager(req, res);
                        }
                    }
                    else{
                        logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'Cybersource Antifraud Provider: Id of transaction is missing'));

                        return res
                        .status(400)
                        .json({ message: 'Enext Custom Payment Gateway: TransactionId is missing' })
                        .end();
                    }
                }
                catch(e){
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Cybersource Antifraud Provider: ${e.message}`));
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%O'),e);
                    
                    return res
                    .status(500)
                    .json({ message: `Enext Custom Payment Gateway: ${e.message}`})
                    .end();
                }
            },

            getStatusAllowedToCaptureOrder(){
                return Cybersource.STATUS_ALLOWED_TO_CAPTURE_ORDER;
            },

            getStatusUnallowedToCaptureOrder(){
                return Cybersource.STATUS_UNALLOWED_TO_CAPTURE_ORDER;
            }
        }
    }
}