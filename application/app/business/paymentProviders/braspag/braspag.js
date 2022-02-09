const Utils = require('../../../helpers/utils');
const CreditCardImplementation = require('./paymentTypeImplementation/creditCard');
const DebitCardImplementation = require('./paymentTypeImplementation/debitCard');
const CashImplementation = require('./paymentTypeImplementation/cash');
const OracleCommerceCloud = require('../../../helpers/occ');
const Cybersource = require('../../antifraudProviders/cybersource/cybersource');
const Authentication3DS = require('./paymentAuthentication/3dsAuthentication');
const EnextAntifraudServices = require('../../enextServices/enextAntifraudService');
const EnextPaymentServices = require('../../enextServices/enextPaymentService');
const EnextBaseService = require('../../enextServices/enextBaseService');
const loggerHandler = require('../../../helpers/logger');
const logger = loggerHandler.LoggerBuilder();

module.exports = class Braspag {
    
    constructor(){   
        this.ENEXT_ANTIFRAUD_SERVICES;
        this.ENEXT_PAYMENT_SERVICES;
        this.UTILS = new Utils();
        this.OCC = new OracleCommerceCloud();
        this.occResponseModel = {
            antifraudResult: {
                antifraudTransactionId: undefined,
                antifraudAnalysisStatus: undefined
            },
            paymentResult: {
                paymentTransactionId: undefined,
                paymentAuthorizationStatus: undefined,
                paymentTicketUrl: undefined,
                paymentCardToken: undefined,
                paymentCardAlias: undefined,
                paymentCardBrand: undefined,
                paymentCardLastDigits: undefined,
            }
        };
    }

    //https://braspag.github.io/manual/braspag-pagador#lista-de-reasoncode/reasonmessage
    static get REASONMESSAGE_BY_REASONCODE(){
        return {
            0: 'Successful',
            1: 'AffiliationNotFound',
            2: 'IssuficientFunds',
            3: 'CouldNotGetCreditCard',
            4: 'ConnectionWithAcquirerFailed',
            5: 'InvalidTransactionType',
            6: 'InvalidPaymentPlan',
            7: 'Denied',
            8: 'Scheduled',
            9: 'Waiting',
           10: 'Authenticated',
           11: 'NotAuthenticated',
           12: 'ProblemsWithCreditCard',
           13: 'CardCanceled',
           14: 'BlockedCreditCard',
           15: 'CardExpired',
           16: 'AbortedByFraud',
           17: 'CouldNotAntifraud',
           18: 'TryAgain',
           19: 'InvalidAmount',
           20: 'ProblemsWithIssuer',
           21: 'InvalidCardNumber',
           22: 'TimeOut',
           23: 'CartaoProtegidoIsNotEnabled',
           24: 'PaymentMethodIsNotEnabled',
           98: 'InvalidRequest',
           99: 'InternalError'
        };
    }

    //https://braspag.github.io/manual/braspag-pagador#lista-de-status-da-transa%C3%A7%C3%A3o
    static get TRANSACTION_STATUS(){
        return {
            0: {
                status: 'NotFinished',
                description: 'Payment processing failure'
            },
            1:{
                status: 'Authorized',
                description: 'Payment ready to capture or payed (Ticket)'
            },
            2:{
                status: 'PaymentConfirmed',
                description: 'Payment confirmed'
            },
            3:{
                status: 'Denied',
                description: 'Payment denied'
            },
            10:{
                status: 'Voided',
                description: 'Payment canceled'
            },
            11:{
                status: 'Refunded',
                description: 'Payment refunded'
            },
            12:{
                status: 'Pending',
                description: 'Awaiting return of the financial institution'
            },
            13:{
                status: 'Aborted',
                description: 'Payment canceled by fraud or processing failure'
            },
            20:{
                status: 'Scheduled',
                description: 'Recurrence scheduled'
            }
        };
    }

    static get CODE_BY_API_ERROR(){
        return {
            //Data sent exceeds field size
            0:{
                status: 200,
                continue: false
            },
            //The MerchantId sent is not a GUID
            114:{
                status: 200,
                continue: false
            },
            //The provided MerchantId was not found
            115:{
                status: 200,
                continue: false
            },
            //The provided MerchantId is blocked
            116:{
                status: 200,
                continue: false
            },
            //MerchantOrderId is required
            122:{
                status: 200,
                continue: false
            },
            //MerchantKey is required
            131	:{
                status: 200,
                continue: false
            },
            //MerchantKey is invalid
            132:{
                status: 200,
                continue: false
            },
            //Provider is not supported for this Payment Type
            133:{
                status: 200,
                continue: false
            },
            //Address Number length exceeded
            148:{
                status: 200,
                continue: false
            },
            //Transaction not found
            307:{
                status: 200,
                continue: false
            },
            //Transaction not available to capture
            308:{
                status: 200,
                continue: false
            },
            //Transaction not available to void
            309:{
                status: 200,
                continue: false
            },
            //Operation not supported by payment type. Ex: Refund/Cancel transaction with payment type [Boleto]
            310:{
                status: 200,
                continue: false
            },
            //Refund is not enabled for this merchant
            311:{
                status: 200,
                continue: false
            }
        }
    }

    static restApiErrorHandler(err){
        if (err.error){
            if (Array.isArray(err.error)){
                let statusCode = 500;
                let _continue = false;
                
                statusCode = 200;               
                
                return {
                    statusCode,
                    message: err.error[0].Message,
                    continue: _continue,
                    error: true
                };
            }
            else if (err.error.Message){
                let parsedResponse = err.error;
                let statusCode = 500;
                let _continue = false;
                
                if (parsedResponse.Code){
                    if (OracleCommerceCloud.CODE_BY_API_ERROR[parsedResponse.Code]){
                        statusCode = Braspag.CODE_BY_API_ERROR[parsedResponse.Code].status;
                        _continue = Braspag.CODE_BY_API_ERROR[parsedResponse.Code].continue
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

    async doRequest(options){ return await this.UTILS.requestUtils().doRequest(options, 0, Braspag); } 

    //Checkout operations namespace
    checkoutOperations(orderId){
        let self = this;
        let messagePrefix = [
            { key:'Order', value: orderId },
            { key:'PaymentProvider', value: 'braspag'},
        ];
        let functionScopeMessagePrefix;

        return {
            checkoutRequestHandler(req, res, isOrderPreAuthorized) {
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'checkoutRequestHandler' }];
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: Processing checkout request'));

                if (!isOrderPreAuthorized)
                    return new EnextBaseService().checkoutOperations(req).paymentWithoutAntiFraud(req, res).then((response) => response, (err) => err);
                else{
                    /* If the customer bought using credit card and the store uses antifraud analysis, 
                    *  the order will be processed when order submit webhook sends a notification with the order created.
                    * 
                    * This solution has been implemented because sometimes the checkout page send a request and the gateway 
                    * returned an error of the request timeout.
                    */
                    if (req.body.gatewaySettings.useAntiFraudAnalysis && (req.body.orderProperties.paymentInfo.type === 'creditCard' || req.body.orderProperties.paymentInfo.type === 'debitCard'))
                        if(req.body.gatewaySettings.antifraudProviderName === "cybersource" && req.body.gatewaySettings.useNativeIntegration) 
                            return this.paymentWithAntiFraudFullIntegration(req, res, isOrderPreAuthorized).then((response)=> response,(err)=> err);
                        else
                            return new EnextBaseService().checkoutOperations(req).paymentWithAntiFraud(req, res, isOrderPreAuthorized).then((response) => response, (err) => err);
                }
            },

            async paymentWithAntiFraudFullIntegration(req, res, isOrderPreAuthorized){
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'paymentWithAntiFraudFullIntegration' }];

                //Used when the integration is between Cybersource + Braspag
                try{
                    let gatewaySettings = req.body.gatewaySettings;
                    let orderId = req.body.orderProperties.orderId;
                    let responseToWebHook;
    
                    self.ENEXT_PAYMENT_SERVICES = new EnextPaymentServices(gatewaySettings.paymentProviderName);
                    self.ENEXT_PAYMENT_SERVICES.setPaymentProviderImplementation = self.ENEXT_PAYMENT_SERVICES.getPaymentProviderName;
                    
                    logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: Processing full provider integration payment with anti fraud'));
            
                    if (gatewaySettings.antifraudProviderFirstOperation !== gatewaySettings.antifraudProviderSecondOperation) {    
                        logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: Processing creditCard payment'));
    
                        // ****************************** Order flow verification **********************************************
                        
                        //******************************* First Operation *******************************************************
                        if (gatewaySettings.antifraudProviderFirstOperation === 'analyze')
                            logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: Flow => Analyze (Antifraud First) then Authorize (Payment Second)'));
                        
                        else if (gatewaySettings.antifraudProviderFirstOperation === 'authorize')
                            logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: Flow => Authorize (Payment First) then Analyze (Antifraud Second)'));

                        else
                            return res
                            .status(400)
                            .json({ message: 'Enext Custom Payment Gateway: Payment operations flow invalid, check your first operation in gateway settings' })
                            .end();
                        
                        this.operationResponse = await self.ENEXT_PAYMENT_SERVICES.paymentOperations(orderId).fullIntegrationAuthorizePayment(req);
                        req.body.paymentProviderProperties = this.operationResponse;
                        req.body.antifraudProviderProperties = (this.operationResponse.Payment)? this.operationResponse.Payment.FraudAnalysis:undefined;
                        let occResponseModel = self.normalizeOperations().normalizeResponsesByOccModel(req.body.paymentProviderProperties, req.body.antifraudProviderProperties);

                        if(this.operationResponse.ResponseCode === OracleCommerceCloud.APPROV_CODE){
                            responseToWebHook = await new EnextBaseService().checkoutOperations(req).normalizeResponseToWebHook(req, gatewaySettings.antifraudProviderSecondOperation, this.operationResponse.ResponseCode, this.operationResponse.ReasonMessage, occResponseModel);
                            
                            if (!isOrderPreAuthorized){
                                logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: Response sent to Credit Card WebHook => ${responseToWebHook.authorizationResponse.responseReason}`));
                            
                                return res
                                .status(200)
                                .json(responseToWebHook)
                                .end();
                            }
                            else{
                                //If authorized with success, the order is updated with transaction information. 
                                //Capture or Refund will be done by Payment or Antifraud Webhook
                                let payload = {
                                    paymentGroups: [
                                        {
                                            id: req.body.orderProperties.paymentInfo.paymentGroupId,
                                            authorizationStatus: req.body.orderProperties.paymentInfo.paymentAuthorizatedProperties
                                        }
                                    ]
                                };
                                
                                Object.assign(payload.paymentGroups[0].authorizationStatus[0].statusProps, responseToWebHook.additionalProperties);
                                payload.paymentGroups[0].authorizationStatus[0].statusProps.customProperties = JSON.parse(payload.paymentGroups[0].authorizationStatus[0].statusProps.customProperties);
                                delete payload.paymentGroups[0].authorizationStatus[0].statusProps.customProperties.cardDetails;
                                payload.paymentGroups[0].authorizationStatus[0].statusProps.customProperties = JSON.stringify(payload.paymentGroups[0].authorizationStatus[0].statusProps.customProperties);

                                let result = await self.OCC.storeOperations(req.body.orderProperties.orderId).updateOrder(req,payload);

                                if (result.error)
                                    return res
                                    .status(500)
                                    .json(result)
                                    .end();
                                
                                logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: Order ${req.body.orderProperties.orderId} authorized successfully`));
                                return res
                                .status(200)
                                .json({message: `Enext Custom Payment Gateway: Order ${req.body.orderProperties.orderId} authorized successfully`})
                                .end();
                            }

                        }
                        else {
                            // ******************  Reject order is automatic ***********************
                            logger.log('error', loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: Operation failed'));
                            logger.log('error', loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: ${this.operationResponse.ReasonMessage || this.operationResponse.message}`));
                            
                            if (!isOrderPreAuthorized){
                                if (this.operationResponse.statusCode)
                                    return res
                                    .status(this.operationResponse.statusCode)
                                    .json({ message: `Enext Custom Payment Gateway: ${this.operationResponse.ReasonMessage || this.operationResponse.message}` })
                                    .end();
                                
                                else {
                                    responseToWebHook = await new EnextBaseService().checkoutOperations(req).normalizeResponseToWebHook(req, gatewaySettings.antifraudProviderSecondOperation, this.operationResponse.ResponseCode, this.operationResponse.ReasonMessage, occResponseModel);

                                    return res
                                    .status(200)
                                    .json(responseToWebHook)
                                    .end();
                                }
                            }
                            else{
                                responseToWebHook = await new EnextBaseService().checkoutOperations(req).normalizeResponseToWebHook(req, gatewaySettings.antifraudProviderSecondOperation, this.operationResponse.ResponseCode, this.operationResponse.ReasonMessage, occResponseModel);
                                responseToWebHook.additionalProperties.antifraudProviderStatus = Cybersource.ANALYSIS_STATUS[responseToWebHook.additionalProperties.antifraudProviderStatus];

                                let payload = {
                                    state: 'FAILED',
                                    paymentGroups: [
                                        {
                                            id: req.body.orderProperties.paymentInfo.paymentGroupId,
                                            state: 'AUTHORIZE_FAILED',
                                            authorizationStatus: req.body.orderProperties.paymentInfo.paymentAuthorizatedProperties
                                        }
                                    ]
                                };
                                
                                Object.assign(payload.paymentGroups[0].authorizationStatus[0].statusProps, responseToWebHook.additionalProperties);
                                payload.paymentGroups[0].authorizationStatus[0].statusProps.customProperties = JSON.parse(payload.paymentGroups[0].authorizationStatus[0].statusProps.customProperties);
                                delete payload.paymentGroups[0].authorizationStatus[0].statusProps.customProperties.cardDetails;
                                payload.paymentGroups[0].authorizationStatus[0].statusProps.customProperties = JSON.stringify(payload.paymentGroups[0].authorizationStatus[0].statusProps.customProperties);

                                let result = await self.OCC.storeOperations(req.body.orderProperties.orderId).updateOrder(req,payload);

                                if (result.error)
                                    return res
                                    .status(500)
                                    .json(result)
                                    .end();
                                
                                logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: Order ${req.body.orderProperties.orderId} canceled successfully`));
                                return res
                                .status(200)
                                .json({message: `Braspag Payment Provider: Order ${req.body.orderProperties.orderId} canceled successfully`})
                                .end();
                            }
                        }
                    }
                    else{
                        logger.log('error', loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: First operation and second operation can not be equals !'));
                        return res
                        .status(400)
                        .json({ message: 'Enext Custom Payment Gateway: First operation and second operation can not be equals !' })
                        .end();
                    }
                }
                catch(e){
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: ${e.message}`));
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%O'),e);

                    return res
                    .status(500)
                    .json({ message: `Enext Custom Payment Gateway: ${e.message}` })
                    .end();
                }
            }
        };
    };

    //Normalize operations namespace
    normalizeOperations(){
        let self = this;
        return {

            normalizeResponsesByOccModel(paymentResult=undefined, antifraudResult=undefined) {
                
                if (paymentResult){
                    if (paymentResult.Payment){
                        self.occResponseModel.paymentResult.paymentTransactionId =  paymentResult.Payment.PaymentId || self.occResponseModel.paymentResult.paymentTransactionId;
                        self.occResponseModel.paymentResult.paymentAuthorizationStatus = (paymentResult.Payment.Status)? Braspag.TRANSACTION_STATUS[paymentResult.Payment.Status].status:self.occResponseModel.paymentResult.paymentAuthorizationStatus;
                        self.occResponseModel.paymentResult.paymentTicketUrl = paymentResult.Payment.Url || self.occResponseModel.paymentResult.paymentTicketUrl;
                        self.occResponseModel.securityCard = {};

                        if (paymentResult.Payment.Type === 'CreditCard'){
                            self.occResponseModel.securityCard = {
                                token: paymentResult.Payment.CreditCard.CardToken || self.occResponseModel.paymentResult.paymentCardToken,
                                alias: paymentResult.Payment.CreditCard.Alias || self.occResponseModel.paymentResult.paymentCardAlias,
                                brand: paymentResult.Payment.CreditCard.Brand || self.occResponseModel.paymentResult.paymentCardBrand,
                                lastDigits: (paymentResult.Payment.CreditCard.CardNumber)?"*".repeat(12).concat(paymentResult.Payment.CreditCard.CardNumber.substr(-4)):self.occResponseModel.paymentResult.paymentCardLastDigits
                            };
                        }
                    }
                }

                if (antifraudResult){
                    self.occResponseModel.antifraudResult.antifraudTransactionId = antifraudResult.antifraudTransactionId || antifraudResult.Id;
                    self.occResponseModel.antifraudResult.antifraudAnalysisStatus = antifraudResult.Status;
                }
                return self.occResponseModel;
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

    //Authorize operation namespace
    authorizeOperations(){
        return {
            async authorizePayment(req){
                if (req.body.orderProperties.paymentInfo.type === 'creditCard')
                    return await new CreditCardImplementation().authorizeOperations(req.body.orderProperties.orderId).authorizePayment(req);     
                else if (req.body.orderProperties.paymentInfo.type === 'debitCard')
                    return await new DebitCardImplementation().authorizeOperations(req.body.orderProperties.orderId).authorizePayment(req);                   
                else if (req.body.orderProperties.paymentInfo.type === 'cash')
                    return await new CashImplementation().authorizeOperations(req.body.orderProperties.orderId).authorizePayment(req);
                else
                    return {
                        ResponseCode: OracleCommerceCloud.REPROV_CODE,
                        ReasonMessage: `Enext Custom Payment Gateway not support payment type ${req.body.orderProperties.paymentInfo.type}`
                    }
            },

            async fullIntegrationAuthorizePayment(req){
                return await new CreditCardImplementation().authorizeOperations(req.body.orderProperties.orderId).authorizePaymentWithAntiFraud(req);
            }
        };
    };

    //Payment operation namespace
    paymentOperations(orderId){
        let self = this;
        let messagePrefix = [
            { key:'PaymentProvider', value: 'braspag'},
        ];
        if (orderId)
            messagePrefix.push({ key:'Order', value: orderId });
        let functionScopeMessagePrefix;

        let buildCaptureOptionsRequest = (params) => {
            let options = {
                method: 'PUT',
                uri: `${params.gatewaySettings.paymentProviderEndpoint}/v2/sales/${params.paymentProviderTransactionId}/capture`,
                headers: {
                    'Content-Type': 'application/json',
                    'merchantId': params.gatewaySettings.paymentProviderMerchantId,
                    'merchantKey': params.gatewaySettings.paymentProviderMerchantKey
                },
                json: true,
                resolveWithFullResponse: true
            };
    
            return options;
        };

        let buildRefundOptionsRequest = (params) => {
            let options = {
                method: 'PUT',
                uri: `${params.gatewaySettings.paymentProviderEndpoint}/v2/sales/${params.transactionId}/void`,
                qs: {
                    'amount': params.amount
                },
                headers: {
                    'Content-Type': 'application/json',
                    'MerchantId': params.gatewaySettings.paymentProviderMerchantId,
                    'MerchantKey': params.gatewaySettings.paymentProviderMerchantKey
                },
                json: true,
                resolveWithFullResponse: true
            };
    
            return options;
        };

        let buildGetPaymentStatusOptionsRequest = (params) => {
            let options = {
                url: `${params.gatewaySettings.paymentProviderQueryEndpoint}/v2/sales/${params.transactionId}`,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'merchantId': params.gatewaySettings.paymentProviderMerchantId,
                    'merchantKey': params.gatewaySettings.paymentProviderMerchantKey
                },
                json: true
            };
            return options;
        };

        return {
            async capturePayment(req){
                functionScopeMessagePrefix = [
                    ...messagePrefix,, 
                    { key:'Operation', value: 'capturePayment' }, 
                    { key:'PaymentTransactionId', value: req.body.paymentProviderProperties.Payment.PaymentId }
                ];
                logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: Processing capture transaction'));

                let params = {
                    gatewaySettings: req.body.gatewaySettings,
                    paymentProviderTransactionId: req.body.paymentProviderProperties.Payment.PaymentId
                };

                let captureRequestResponse = await self.doRequest(buildCaptureOptionsRequest(params));

                if (captureRequestResponse){
                    if (!captureRequestResponse.error){
                        if (captureRequestResponse.Status === 2 && captureRequestResponse.ReasonCode === 0)
                            return {
                                status: captureRequestResponse.Status,
                                reasonCode: captureRequestResponse.ReasonCode,
                                message: 'Transaction in payment provider was captured successful'
                            }
                        else
                            return {
                                status: captureRequestResponse.Status,
                                reasonCode: captureRequestResponse.ReasonCode,
                                message: captureRequestResponse.ReasonMessage
                            }
                    }
                    else{
                        return {
                            statusCode: (captureRequestResponse.statusCode !== undefined)? captureRequestResponse.statusCode: 500,
                            message: captureRequestResponse.message,
                            error: true
                        }
                    }
                }
                else
                    return captureRequestResponse
            },

            async refundPayment(req, isCheckoutOrderConfirmation=false){
                functionScopeMessagePrefix = [
                    ...messagePrefix, 
                    { key:'Operation', value: 'refundPayment' }, 
                    { key:'PaymentTransactionId', value: req.body.paymentProviderProperties.Payment.PaymentId }
                ];

                logger.log('info',  loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: Processing refund transaction'));

                let params = {
                    transactionId: req.body.paymentProviderProperties.Payment.PaymentId,
                    amount: req.body.paymentProviderProperties.Payment.Amount,
                    gatewaySettings: req.body.gatewaySettings
                }
                
                let refundRequestResponse = await self.doRequest(buildRefundOptionsRequest(params));

                if (refundRequestResponse){
                    if (!refundRequestResponse.error){
                        if (isCheckoutOrderConfirmation){
                            logger.log('info',  loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: Transaction in payment provider was refunded successful'));
                            return {
                                ResponseCode: OracleCommerceCloud.REPROV_CODE,
                                ReasonMessage: 'Transaction in payment provider was refunded successful'
                            }
                        }
                        else{
                            if((refundRequestResponse.Status === 10 || refundRequestResponse.Status === 11) && refundRequestResponse.ReasonCode === 0)
                                return {
                                    status: refundRequestResponse.Status,
                                    reasonCode: refundRequestResponse.ReasonCode,
                                    message: 'Transaction in payment provider was refunded successful'
                                }
                            else
                                return {
                                    status: refundRequestResponse.Status,
                                    reasonCode: refundRequestResponse.ReasonCode,
                                    message: refundRequestResponse.ReasonMessage
                                }
                        }
                    }
                    else{
                        return {
                            statusCode: (refundRequestResponse.statusCode !== undefined)? refundRequestResponse.statusCode: 500,
                            message: refundRequestResponse.message,
                            error: true
                        }
                    }
                }
                else
                    return refundRequestResponse;
            },

            async getPaymentTransactionStatus (req, transactionId){
                let params = {
                    gatewaySettings: req.body.gatewaySettings,
                    transactionId,
                }
                return await self.doRequest(buildGetPaymentStatusOptionsRequest(params));   
            }
        }
    }

    //Payment 3DS authentication operation namespace
    paymentAuthentication(){
        let messagePrefix = [
            { key:'PaymentProvider', value: 'braspag'},
        ];
        let functionScopeMessagePrefix;
        return {
            async getToken(req, res){
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'getToken'}];

                try{
                    let authentication3dsResponse = await new Authentication3DS().authenticationOperations().getToken(req);
                    return (!authentication3dsResponse.error)? res.status(200).json(authentication3dsResponse).end():res.status(500).json({ message: authentication3dsResponse.message}).end();
                }
                catch(e){
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: An error has occurred when 3DS authentication get token was processed. Message: ${e.message}`));
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%o'),e);
    
                    return res
                    .status(500)
                    .json({message: `Enext Custom Payment Gateway: ${e.message}`})
                    .end();
                }
            }
        }
    }

    //Payment webhook operation namespace
    paymentWebHookOperations(){
        let self = this;
        let messagePrefix = [{ key:'PaymentProvider', value: 'braspag'}];
        let functionScopeMessagePrefix;

        let processUpdateOrderFlow = async (req, res, newOrderPaymentState, cancelOrder=false) => {
            functionScopeMessagePrefix = 
                (()=> {
                    let options = [
                        ...messagePrefix,
                        { key:'Operation', value: 'processUpdateOrderFlow' },
                        { key:'Order', value: req.body.orderProperties.orderId },
                        { key:'PaymentTransaction', value: req.body.paymentProviderProperties.Payment.PaymentId }
                    ];

                    if (req.body.paymentProviderProperties.Payment.FraudAnalysis)
                        options.push({ key:'AntifraudTransaction', value: req.body.paymentProviderProperties.Payment.FraudAnalysis.Id});

                    return options;
                    
                })();

            try{
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: Initiating updating order status in Oracle Commerce Cloud'));
                let payload;

                //Checks if order was authorized previously
                if (req.body.orderProperties.paymentInfo.paymentAuthorizatedProperties[0].statusProps.responseCode === '1000'){
                    //Checks if order was not processed yet or if has been captured previously and now will be refunded/canceled
                    if (req.body.orderProperties.paymentInfo.state === 'AUTHORIZED' || req.body.orderProperties.paymentInfo.state === 'PAYMENT_REQUEST_ACCEPTED' || ((newOrderPaymentState === 'SETTLE_FAILED' || newOrderPaymentState === 'CREDIT_FAILED') && req.body.orderProperties.paymentInfo.state === 'SETTLED')){
                        //Update status of paymentGroups from order to SETTLED if debited successfully, else SETTLE_FAILED 
                        payload = {
                            paymentGroups: [
                                {
                                    id: req.body.orderProperties.paymentInfo.paymentGroupId,
                                    state: newOrderPaymentState
                                }
                            ]
                        };

                        if (cancelOrder)
                            payload.state = 'FAILED'

                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: Updating order status'));

                        let updateResponse = await self.OCC.storeOperations(req.body.orderProperties.orderId).updateOrder(req,payload);

                        if (!updateResponse.error){
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: Update order state in Oracle Commerce Cloud successful | New order state: ${newOrderPaymentState}`));

                            return res
                            .status(200)
                            .json({message: `Enext Custom Payment Gateway: Braspag Payment Provider: Update order state in Oracle Commerce Cloud successful | New order state: ${newOrderPaymentState}`})
                            .end();
                        }
                        else{
                            logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: An error has occurred when request to update order has been processed'));
                            logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: ${updateResponse.message}`));

                            return res
                            .status(500)
                            .json({message:`Enext Custom Payment Gateway: ${updateResponse.message}`})
                            .end();
                        }
                    }
                    else{
                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Notification received, the order ${req.body.orderProperties.orderId} has been processed successful`));
                        return res
                        .status(200)
                        .json({message:`Enext Custom Payment Gateway: Notification received, the order ${req.body.orderProperties.orderId} has been processed successful`})
                        .end();
                    }
                }
                else{
                    logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Notification received, the order ${req.body.orderProperties.orderId} has been processed successful. The order was not authorized`));
                    return res
                    .status(200)
                    .json({message:`Enext Custom Payment Gateway: Notification received, the order ${req.body.orderProperties.orderId} has been processed successful. The order was not authorized`})
                    .end();
                }
            }
            catch(e){
                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: An error has occurred when update order flow has been processed. Message: ${e.message}`));
                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%o'),e);

                return res
                .status(500)
                .json({message: `Enext Custom Payment Gateway: ${e.message}`})
                .end();
            }
        };

        let processCapturePaymentFlow = async (req, res) => {
            functionScopeMessagePrefix =
                (()=> {
                    let options = [
                        ...messagePrefix,
                        { key:'Operation', value: 'processCapturePaymentFlow' },
                        { key:'Order', value: req.body.orderProperties.orderId },
                        { key:'PaymentTransaction', value: req.body.paymentProviderProperties.Payment.PaymentId }
                    ];

                    if (req.body.paymentProviderProperties.Payment.FraudAnalysis)
                        options.push({ key:'AntifraudTransaction', value: req.body.paymentProviderProperties.Payment.FraudAnalysis.Id});

                    return options;
                })();

            try{
                let ENEXT_PAYMENT_SERVICES = new EnextPaymentServices(req.body.gatewaySettings.paymentProviderName);
                ENEXT_PAYMENT_SERVICES.setPaymentProviderImplementation = ENEXT_PAYMENT_SERVICES.getPaymentProviderName;

                let captureOperationResponse = await ENEXT_PAYMENT_SERVICES.paymentOperations(req.body.orderProperties.orderId).capturePayment(req);

                if(!captureOperationResponse.error){
                    if(captureOperationResponse.status === 2 && captureOperationResponse.reasonCode === 0){
                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: ${captureOperationResponse.message}`));
                        return await processUpdateOrderFlow(req, res, 'SETTLED');
                    }
                    else{
                        logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: An error has occured when capture payment flow has been processed. Message: ${captureOperationResponse.message}`));
                        logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%o'),captureOperationResponse);

                        return res
                        .status(500)
                        .json({message: `Enext Custom Payment Gateway: ${captureOperationResponse.message}`})
                        .end();
                    }
                }
                else {
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: An error has occured when capture payment flow has been processed. Message: ${captureOperationResponse.message}`));
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%o'),captureOperationResponse);

                    return res
                    .status(500)
                    .json({message: `Enext Custom Payment Gateway: ${captureOperationResponse.message}`})
                    .end();
                }
            }
            catch(e){
                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: An error has occured when capture payment flow has been processed. Message: ${e.message}`));
                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%o'),e);

                return res
                .status(500)
                .json({message: `Enext Custom Payment Gateway: ${e.message}`})
                .end();
            }
        };

        let processRefundPaymentFlow = async (req, res, updateOrder=true, newOrderStatus, cancelOrder=false) => {
            functionScopeMessagePrefix = 
                (()=> {
                    let options = [
                        ...messagePrefix,
                        { key:'Operation', value: 'processRefundPaymentFlow' },
                        { key:'Order', value: req.body.orderProperties.orderId },
                        { key:'PaymentTransaction', value: req.body.paymentProviderProperties.Payment.PaymentId }
                    ];

                    if (req.body.paymentProviderProperties.Payment.FraudAnalysis)
                        options.push({ key:'AntifraudTransaction', value: req.body.paymentProviderProperties.Payment.FraudAnalysis.Id});

                    return options;
                })();

            try{
                let ENEXT_PAYMENT_SERVICES = new EnextPaymentServices(req.body.gatewaySettings.paymentProviderName);
                ENEXT_PAYMENT_SERVICES.setPaymentProviderImplementation = ENEXT_PAYMENT_SERVICES.getPaymentProviderName;

                let refundOperationResponse = await ENEXT_PAYMENT_SERVICES.paymentOperations(req.body.orderProperties.orderId).refundPayment(req);

                if(!refundOperationResponse.error){
                    if((refundOperationResponse.status === 10 || refundOperationResponse.status === 11) && refundOperationResponse.reasonCode === 0){
                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: ${refundOperationResponse.message}`));
                        
                        if (updateOrder)                                  //(cancelOrder)?'CREDIT_FAILED':'SETTLE_FAILED'
                            return await processUpdateOrderFlow(req, res, newOrderStatus, cancelOrder);
                        else
                            return res.sendStatus(200);
                    }
                    else{
                        logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: An error has occured when refund payment flow has been processed. Message: ${refundOperationResponse.message}`));
                        logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%o'),refundOperationResponse);

                        return res
                        .status(500)
                        .json({message: `Enext Custom Payment Gateway: ${refundOperationResponse.message}`})
                        .end();
                    }
                }
                else {
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: An error has occured when refund payment flow has been processed. Message: ${refundOperationResponse.message}`));
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%o'),refundOperationResponse);

                    return res
                    .status(500)
                    .json({message: `Enext Custom Payment Gateway: ${refundOperationResponse.message}`})
                    .end();
                }
            }
            catch(e){
                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: An error has occured when refund handler flow has been processed. Message: ${e.message}`));
                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%O'),e);

                return res
                .status(500)
                .json({message: `Enext Custom Payment Gateway: ${e.message}`})
                .end();
            }
        };

        return {

            async notificationRequestHandler(req, res){

                if (req.body.PaymentId){
                    req.body.paymentProviderProperties = {
                        paymentProviderTransactionId: req.body.PaymentId
                    }

                    functionScopeMessagePrefix =
                    (()=> {
                        let options = [
                            ...messagePrefix,
                            { key:'Operation', value: 'notificationRequestHandler' },
                            { key:'PaymentTransaction', value: req.body.paymentProviderProperties.paymentProviderTransactionId }
                        ]; 
                        return options;
                    })();

                    logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: Payment notification received'));

                    try{
                        if (req.body.ChangeType === 1){
                            //Get payment transaction details
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: Getting payment transaction details'));
                            req.body.paymentProviderProperties = await self.paymentOperations(null).getPaymentTransactionStatus(req, req.body.paymentProviderProperties.paymentProviderTransactionId);

                            if (req.body.paymentProviderProperties.error){
                                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: An error has occurred when get payment transaction details has been processed. Message: ${req.body.paymentProviderProperties.message}`));
                                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%o'), req.body.paymentProviderProperties);
    
                                return res
                                .status(req.body.paymentProviderProperties.statusCode || 500)
                                .json({message: `Enext Custom Payment Gateway: ${req.body.paymentProviderProperties.message}`})
                                .end();
                            }
                            
                            //Get order details
                            req.body.orderProperties = {
                                orderId: req.body.paymentProviderProperties.MerchantOrderId
                            }

                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: Getting order details'));
                            req.body.orderProperties = await self.OCC.storeOperations(req.body.orderProperties.orderId).getOrder(req);

                            if (req.body.orderProperties.error){
                                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: An error has occurred when get order details has been processed. Message: ${req.body.orderProperties.message}`));
                                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%o'), req.body.orderProperties);
    
                                return res
                                .status(req.body.orderProperties.statusCode || 500)
                                .json({message: `Enext Custom Payment Gateway: An error has occurred when get order details has been processed. Message: ${req.body.orderProperties.message}`})
                                .end();
                            }
                            else if (req.body.orderProperties.state === 'FAILED' || req.body.orderProperties.state === 'CREDIT_FAILED' || req.body.orderProperties.paymentGroups[0].state === 'AUTHORIZE_FAILED'){
                                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: The order ${req.body.orderProperties.id} state is ${req.body.orderProperties.state} and payment state is ${req.body.orderProperties.paymentGroups[0].state}. This order will not be processed, your state is not authorized to follow the payment flow`));
    
                                return res
                                .status(200)
                                .json({message: `Enext Custom Payment Gateway: The order ${req.body.orderProperties.id} state is ${req.body.orderProperties.state} and payment state is ${req.body.orderProperties.paymentGroups[0].state}. This order will not be processed, your state is not authorized to follow the payment flow`})
                                .end();
                            }
                            else{
                                req.body.orderProperties = self.OCC.normalizeOperations().normalizeOccOrderProperties(req.body.orderProperties, true);                            
                                req.body.antifraudProviderProperties = undefined;
    
                                //If true, transaction not use native integration (Braspag + Cybersource)
                                if (!req.body.paymentProviderProperties.Payment.FraudAnalysis){
                                    //If true, transaction use default integration (Braspag + Antifraud Provider)
                                    if (req.body.orderProperties.paymentInfo.paymentAuthorizatedProperties[0].statusProps.antifraudProviderTransactionId){
                                        //Get antifraud transaction details
                                        let ENEXT_ANTIFRAUD_SERVICES = new EnextAntifraudServices(req.body.gatewaySettings.antifraudProviderName);
                                        ENEXT_ANTIFRAUD_SERVICES.setAntifraudProviderImplementation = ENEXT_ANTIFRAUD_SERVICES.getAntifraudProviderName;
    
                                        req.body.antifraudProviderProperties = {
                                            antifraudProviderTransactionId: req.body.orderProperties.paymentInfo.paymentAuthorizatedProperties[0].statusProps.antifraudProviderTransactionId
                                        };
                                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: Getting antifraud transaction details'));
                                        req.body.antifraudProviderProperties = ENEXT_ANTIFRAUD_SERVICES.normalizeOperations().normalizeResponseByNotificationModel(await ENEXT_ANTIFRAUD_SERVICES.analysisOperations(req.body.orderProperties.orderId).getAntifraudTransactionStatus(req,req.body.antifraudProviderProperties.antifraudProviderTransactionId));
            
                                        if (req.body.antifraudProviderProperties.error){
                                            logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: An error has occurred when get antifraud transaction details has been processed. Message: ${req.body.antifraudProviderProperties.message}`));
                                            logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%o'), req.body.antifraudProviderProperties);
        
                                            return res
                                            .status(req.body.antifraudProviderProperties.statusCode || 500)
                                            .json({ message:`Enext Custom Payment Gateway: An error has occurred when get antifraud transaction details has been processed. Message: ${req.body.antifraudProviderProperties.message}`})
                                            .end();
                                        }
    
                                        if(req.body.antifraudProviderProperties.antifraudTransactionStatus !== ENEXT_ANTIFRAUD_SERVICES.antifraudWebHookOperations().getStatusAllowedToCaptureOrder() &&
                                           req.body.antifraudProviderProperties.antifraudTransactionStatus !== ENEXT_ANTIFRAUD_SERVICES.antifraudWebHookOperations().getStatusUnallowedToCaptureOrder()){
                                            
                                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: Notification received, but the order ${req.body.orderProperties.orderId} are await an notification from antifraud provider`));
                                            return res
                                            .status(200)
                                            .json({message:`Enext Custom Payment Gateway: Notification received, but the order ${req.body.orderProperties.orderId} are await an notification from antifraud provider`})
                                            .end();
                                        }
                                    }
                                }
                                    
                                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: Sending data to payment decision manager'));
                                return await self.paymentWebHookOperations(req.body.orderProperties.orderId).decisionManager(req, res);
                            }
                        }
                        else if (req.body.ChangeType === 3){
                            return res
                            .status(200)
                            .json({message: 'Enext Custom Payment Gateway: Notification received, but this transaction will be processed when payment service send a notification'})
                            .end();
                        }
                        else{
                            return res
                            .status(200)
                            .json({message: 'Enext Custom Payment Gateway: Notification change type yet not implemented'})
                            .end();
                        }
                    }
                    catch(e){
                        logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: ${e.message}`));
                        logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%O'),e);

                        return res
                        .status(500)
                        .json({ message: `Enext Custom Payment Gateway: ${e.message}`})
                        .end();
                    }
                }
                else{
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: An error has occurred when notification request handler has been processed. Message: PaymentId is missing'));
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%O'),e);

                    return res
                    .status(400)
                    .json({ message: 'Enext Custom Payment Gateway: An error has occurred when notification request handler has been processed. Message: PaymentId is missing'})
                    .end();
                }
            },

            async decisionManager(req, res){

                //Full Integration (Braspag Payment + Anti fraud Cybersource)
                if (req.body.paymentProviderProperties.Payment.FraudAnalysis){
                    //Payment accept after manual review and current status is Authorized
                    if (req.body.paymentProviderProperties.Payment.FraudAnalysis.Status === 'Accept' || req.body.paymentProviderProperties.Payment.FraudAnalysis.StatusDescription === 'Accept'){
                        //If status is Authorized, we should awaits the capture or cancellation of the transaction by admin panel.
                        if (req.body.paymentProviderProperties.Payment.Status === 1){
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: Notification received, but the order ${req.body.paymentProviderProperties.MerchantOrderId} are await an notification from payment provider informing their capture or cancellation`));
                            
                            return res
                            .status(200)
                            .json({message:`Enext Custom Payment Gateway: Notification received, but the order ${req.body.paymentProviderProperties.MerchantOrderId} are await an notification from payment provider informing their capture or cancellation`})
                            .end();
                        }
                        //Payment captured
                        else if (req.body.paymentProviderProperties.Payment.Status === 2){
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: This transaction has been captured previously, maybe client use automatic capture or did this action by admin panel'));
                            return await processUpdateOrderFlow(req, res, 'SETTLED');
                        }
                        //Payment refunded or canceled 
                        else if (req.body.paymentProviderProperties.Payment.Status === 10 || req.body.paymentProviderProperties.Payment.Status === 11){
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: This transaction has been refunded previously, maybe client use automatic refund/cancel or did this action by admin panel'));
                            return await processUpdateOrderFlow(req, res, 'SETTLE_FAILED', true);
                        }
                        else{
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: Notification received, canceling order ${req.body.paymentProviderProperties.MerchantOrderId}. Transaction status: ${Braspag.TRANSACTION_STATUS[req.body.paymentProviderProperties.Payment.Status].status}`));
                            return await processUpdateOrderFlow(req, res, 'CREDIT_FAILED', true);
                        }
                    }
                    else if (req.body.paymentProviderProperties.Payment.FraudAnalysis.Status === 'Review' || req.body.paymentProviderProperties.Payment.FraudAnalysis.StatusDescription === 'Review'){
                        logger.log('info',`Braspag Payment Provider: Notification received, but the order ${req.body.paymentProviderProperties.MerchantOrderId} are await an notification from anti fraud provider`);
                        
                        return res
                        .status(200)
                        .json({message:`Enext Custom Payment Gateway: Notification received, but the order ${req.body.paymentProviderProperties.MerchantOrderId} are await an notification from anti fraud provider`})
                        .end();
                    }
                    //Refund or Cancel payment after antifraud rejection
                    else{
                        if (req.body.paymentProviderProperties.Payment.Status === 1){
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: Notification received, but the order ${req.body.paymentProviderProperties.MerchantOrderId} are await an notification from payment provider informing their refund or cancellation`));
                            
                            return res
                            .status(200)
                            .json({message:`Enext Custom Payment Gateway: Notification received, but the order ${req.body.paymentProviderProperties.MerchantOrderId} are await an notification from payment provider informing their refund or cancellation`})
                            .end();
                        }
                        //Refund or Cancel payment
                        else if (req.body.paymentProviderProperties.Payment.Status === 10 || req.body.paymentProviderProperties.Payment.Status === 11){
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: This transaction has been refunded previously, maybe client use automatic refund/cancel or did this action by admin panel'));
                            return await processUpdateOrderFlow(req, res, 'CREDIT_FAILED', true);
                        }
                        else{
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: Notification received, canceling order ${req.body.paymentProviderProperties.MerchantOrderId}. Transaction status: ${Braspag.TRANSACTION_STATUS[req.body.paymentProviderProperties.Payment.Status].status}`));
                            return await processUpdateOrderFlow(req, res, 'CREDIT_FAILED', true);
                        }
                    }
                }
                else{
                    if (req.body.paymentProviderProperties.Payment.Status === 1 && req.body.paymentProviderProperties.Payment.Type !== 'Boleto'){
                        //Check if the merchant use other antifraud and if transaction has been authorized previously
                        if (req.body.gatewaySettings.useAntiFraudAnalysis && req.body.antifraudProviderProperties){
                            let ENEXT_ANTIFRAUD_SERVICES = new EnextAntifraudServices(req.body.gatewaySettings.antifraudProviderName);
                            ENEXT_ANTIFRAUD_SERVICES.setAntifraudProviderImplementation = ENEXT_ANTIFRAUD_SERVICES.getAntifraudProviderName;
                            
                            if (req.body.antifraudProviderProperties.antifraudTransactionStatus === ENEXT_ANTIFRAUD_SERVICES.antifraudWebHookOperations().getStatusAllowedToCaptureOrder())
                                return await processCapturePaymentFlow(req, res);
                            else
                                return await processRefundPaymentFlow(req, res, true, 'CREDIT_FAILED', true);                                        
                        }
                        else{
                            // If the merchant not use fraud analysis and not use automatic capture or automatic refund, we should wait a notification sent from payment webhook informig the new status of the transaction
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: Notification received, but the order ${req.body.paymentProviderProperties.MerchantOrderId} are await an notification from payment provider informing their capture or cancellation`));
                            return res
                            .status(200)
                            .json({message:`Enext Custom Payment Gateway: Notification received, but the order ${req.body.paymentProviderProperties.MerchantOrderId} are await an notification from payment provider informing their capture or cancellation`})
                            .end();
                        }
                    }
                    //Trasaction has been paid previously
                    else if (req.body.paymentProviderProperties.Payment.Status === 2){
                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: This transaction has been captured previously or client use automatic capture or did this action by admin panel'));
                        return await processUpdateOrderFlow(req, res, 'SETTLED');
                    }
                    //Refund or Cancel payment
                    else if (req.body.paymentProviderProperties.Payment.Status === 10 || req.body.paymentProviderProperties.Payment.Status === 11){
                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider: This transaction has been refunded previously, maybe client use automatic refund/cancel or did this action by admin panel'));
                        return await processUpdateOrderFlow(req, res, 'SETTLE_FAILED', true);
                    }
                    //Transaction with any payment type except cash (Boleto) has a status not mapped
                    else if (req.body.paymentProviderProperties.Payment.Type !== 'Boleto'){
                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: Notification received, canceling order ${req.body.paymentProviderProperties.MerchantOrderId}. Transaction status: ${Braspag.TRANSACTION_STATUS[req.body.paymentProviderProperties.Payment.Status].status}`));
                        return await processUpdateOrderFlow(req, res, 'CREDIT_FAILED', true);
                    }
                    else{
                        // Payment type is cash (Boleto) and payment status = 1 (Authorized)
                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider: Notification received, but the order ${req.body.paymentProviderProperties.MerchantOrderId} are await an notification from payment provider. Payment cash (Boleto) is not completed, awaiting payment confirmation.`));
                        return res
                        .status(200)
                        .json({message:`Enext Custom Payment Gateway: Notification received, but the order ${req.body.paymentProviderProperties.MerchantOrderId} are await an notification from payment provider. Payment cash (Boleto) is not completed, awaiting payment confirmation.`})
                        .end();
                    }
                }
            }
        }
    };
};