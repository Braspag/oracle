const loggerHandler = require('../../helpers/logger');
const logger = loggerHandler.LoggerBuilder();
const OracleCommerceCloud = require('../../helpers/occ');
const Cybersource = require('../antifraudProviders/cybersource/cybersource');
const EnextAntifraudServices = require('./enextAntifraudService');
const EnextPaymentServices = require('./enextPaymentService');

module.exports = class EnextBaseService {
    
    constructor(){
        this.ENEXT_ANTIFRAUD_SERVICES;
        this.ENEXT_PAYMENT_SERVICES;
        this.OCC = new OracleCommerceCloud();
    }

    checkoutOperations(req){
        let self = this;
        let orderId = req.body.orderProperties.orderId;
        let messagePrefix = [
            { key:'Order', value: orderId },
            { key:'PaymentProvider', value: req.body.gatewaySettings.paymentProviderName }
        ];
        let functionScopeMessagePrefix;

        let updateShopperProfileCardToken = async (req, card, removeCard=false) => {
            functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'updateShopperProfileCardToken' }];

            try{
                let payload = { _savedCards: req.body.orderProperties.paymentInfo.securityCardProperties.savedCards };

                if(removeCard && req.body.orderProperties.paymentInfo.securityCardProperties.savedCards.length !== 0)
                    payload._savedCards = payload._savedCards.filter((savedCard)=> savedCard.token !== card.token)
                else
                    payload._savedCards.push(card);
                
                payload._savedCards = JSON.stringify(payload._savedCards);
                
                let response = await self.OCC.storeOperations(orderId).updateShopperProfile(req,payload);
    
                if (response[req.body.orderProperties.customProperties.savedCardPropertyIndex])
                    logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: Token of the card saved on shopper profile'));
                else
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: An error has occurred when shopper profile was processed, ${response.message}`));
            }
            catch(e){
                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: An error has occurred when shopper profile was processed, ${e.message}`));
                logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%O'),e);
            }
        };

        let paymentMethods = {
            creditCard: 'card',
            debitCard: 'card',
            cash: 'cash'
        };

        return {
            
            async normalizeResponseToWebHook(req, lastOperation=undefined, ResponseCode=undefined, ReasonMessage=undefined, occResponseModel=undefined,isPreAuthorization=false){
                /*{
                    Template Object to format final response
    
                    antifraudResult: {
                        antifraudTransactionId: null,
                        antifraudAnalysisStatus: null
                    },
    
                    paymentResult: {
                        paymentTransactionId: null,
                        paymentAuthorizationStatus: null,
                        paymentTicketUrl: null,
                        paymentCardToken: null,
                        paymentCardAlias: null,
                        paymentCardBrand: null,
                        paymentCardLastDigits: null,
                    }
                }*/
                
                let payload = req.body;
    
                // -------------- Specifics fields from authorization request ----------------
                let transactionId = payload.transactionId; 
                let transactionType = payload.transactionType;
                let transactionTimestamp = payload.transactionTimestamp;
                let hostTimestamp = new Date().getTime();
                let merchantTransactionTimestamp = new Date(transactionTimestamp).getTime();
                //----------------------------------------------------------------------------

                let paymentMethod = paymentMethods[payload.orderProperties.paymentInfo.type];
                let orderId = payload.orderProperties.orderId;
                let amount = payload.orderProperties.paymentInfo.amount;
                let currencyCode = payload.orderProperties.paymentInfo.currencyCode;
                let gatewayId = payload.orderProperties.paymentInfo.gatewayId;
                let siteId = payload.orderProperties.siteId;
    
                let authorizationResponse = {
                    responseCode: ResponseCode || '9000',
                    responseReason: ReasonMessage || 'Internal error, check the logs of gateway'
                };
        
                let response = {
                    merchantTransactionTimestamp,
                    transactionId,
                    transactionType,
                    transactionTimestamp,
                    hostTimestamp,
                    paymentMethod,
                    orderId,
                    amount,
                    currencyCode,
                    gatewayId,
                    siteId,
                    authorizationResponse
                };
                
                if (payload.hasOwnProperty("referenceNumber")) response.referenceNumber = payload.referenceNumber;// For transactions with payment type cash
                else response.paymentId = payload.paymentId; // For transactions with payment type card 

                if (!isPreAuthorization){
                    response.authorizationResponse.hostTransactionId = occResponseModel.paymentResult.paymentTransactionId || occResponseModel.antifraudResult.antifraudTransactionId || transactionId

                    let additionalProperties = {};
                    additionalProperties.lastOperation = lastOperation;
                    additionalProperties.ticketUrl = occResponseModel.paymentResult.paymentTicketUrl;
                    additionalProperties.antifraudProviderTransactionId = occResponseModel.antifraudResult.antifraudTransactionId;
                    additionalProperties.antifraudProviderStatus = occResponseModel.antifraudResult.antifraudAnalysisStatus;
                    additionalProperties.paymentProviderTransactionId = occResponseModel.paymentResult.paymentTransactionId;
                    additionalProperties.paymentProviderStatus =  occResponseModel.paymentResult.paymentAuthorizationStatus;
                    additionalProperties.customProperties = JSON.stringify(payload.orderProperties.customProperties);
                    additionalProperties.shopperDeviceIp = req.body.shopperDeviceIp;
    
                    if (Object.keys(additionalProperties).length > 0)
                        response.additionalProperties = additionalProperties;

                    if (additionalProperties.ticketUrl || additionalProperties.paymentProviderStatus || additionalProperties.antifraudProviderStatus) 
                        response.customPaymentProperties = [];
                    
                    if (additionalProperties.ticketUrl) response.customPaymentProperties.push('ticketUrl');
                    if (additionalProperties.paymentProviderStatus) response.customPaymentProperties.push('paymentProviderStatus');
                    if (additionalProperties.antifraudProviderStatus) response.customPaymentProperties.push('antifraudProviderStatus');

                    if (payload.orderProperties.paymentInfo.type === 'creditCard' || payload.orderProperties.paymentInfo.type === 'debitCard')
                        if (payload.orderProperties.paymentInfo.securityCardProperties.saveCard && occResponseModel.securityCard.token && authorizationResponse.responseCode === OracleCommerceCloud.APPROV_CODE)
                            await updateShopperProfileCardToken(req, occResponseModel.securityCard);
                }
                else{
                    response.additionalProperties = {
                        customProperties: JSON.stringify(payload.orderProperties.customProperties),
                        shopperDeviceIp: req.body.shopperDeviceIp
                    }
                    logger.log('info',loggerHandler.formatMessage(messagePrefix,'Enext Base Service: Pre Authorization was processed successfully'));
                }
                
                logger.log('info',loggerHandler.formatMessage(messagePrefix,'Enext Base Service: Payment authorization webhook response %j'), response);
                return response;
            },

            async paymentWithAntiFraud(req, res, isOrderPreAuthorized) {
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'AntifraudProvider', value: req.body.gatewaySettings.antifraudProviderName }, { key:'Operation', value: 'paymentWithAntiFraud' }];

                try{
                    let gatewaySettings = req.body.gatewaySettings;
                    let responseToWebHook, occResponseModel;

                    self.ENEXT_ANTIFRAUD_SERVICES = new EnextAntifraudServices(gatewaySettings.antifraudProviderName);
                    self.ENEXT_PAYMENT_SERVICES = new EnextPaymentServices(gatewaySettings.paymentProviderName);
    
                    self.ENEXT_ANTIFRAUD_SERVICES.setAntifraudProviderImplementation = self.ENEXT_ANTIFRAUD_SERVICES.getAntifraudProviderName;
                    self.ENEXT_PAYMENT_SERVICES.setPaymentProviderImplementation = self.ENEXT_PAYMENT_SERVICES.getPaymentProviderName;
    
                    logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: Processing payment with antifraud'));
            
                    if (gatewaySettings.antifraudProviderFirstOperation !== gatewaySettings.antifraudProviderSecondOperation) {
    
                        logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: Processing creditCard payment'));
    
                        // ****************************** Order flow verification **********************************************
                        
                        //******************************* First Operation *******************************************************
                        if (gatewaySettings.antifraudProviderFirstOperation === 'analyze') {
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: Flow => Analyze (Antifraud First) then Authorize (Payment Second)'));
                            this.firstOperationResponse = await self.ENEXT_ANTIFRAUD_SERVICES.analysisOperations(orderId).sendToAnalysis(req);
                        }
                        else if (gatewaySettings.antifraudProviderFirstOperation === 'authorize') {
                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: Flow => Authorize (Payment First) then Analyze (Antifraud Second)'));
                            this.firstOperationResponse = await self.ENEXT_PAYMENT_SERVICES.paymentOperations(orderId).authorizePayment(req);
                        }
                        else
                            return res
                            .status(400)
                            .json({ message: 'Enext Custom Payment Gateway: Payment operations flow invalid, check your first operation in gateway settings' })
                            .end();
                        
                        if(this.firstOperationResponse.ResponseCode === OracleCommerceCloud.APPROV_CODE){
                            //******************************* Second Operation *******************************************************
                            if (gatewaySettings.antifraudProviderSecondOperation === 'analyze'){
                                //Getting fields from acquirer to send to analysis
                                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: Getting fields from acquirer to send to analysis'));
                                req.body.acquirerProperties = self.ENEXT_PAYMENT_SERVICES.normalizeOperations(orderId).normalizeResponseByAcquirerModel(this.firstOperationResponse);
                                this.secondOperationResponse = await self.ENEXT_ANTIFRAUD_SERVICES.analysisOperations(orderId).sendToAnalysis(req);
                            }
                            else if (gatewaySettings.antifraudProviderSecondOperation === 'authorize')
                                this.secondOperationResponse = await self.ENEXT_PAYMENT_SERVICES.paymentOperations(orderId).authorizePayment(req);
    
                            else
                                return res
                                .status(400)
                                .json({ message: 'Enext Custom Payment Gateway: Payment operations flow invalid, check your second operation in gateway settings' })
                                .end();
    
                            if(this.secondOperationResponse.ResponseCode === OracleCommerceCloud.APPROV_CODE){
                                if (gatewaySettings.antifraudProviderFirstOperation === 'authorize'){
                                    req.body.paymentProviderProperties = this.firstOperationResponse;
                                    req.body.antifraudProviderProperties = this.secondOperationResponse;
                                }
                                else{
                                    req.body.antifraudProviderProperties = this.firstOperationResponse;
                                    req.body.paymentProviderProperties = this.secondOperationResponse;
                                }
                                
                                if(gatewaySettings.antifraudProviderName === 'cybersource' && gatewaySettings.antifraudProviderSecondOperation === 'authorize'){
                                    logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: Getting fields from acquirer to make transaction association'));
                                    req.body.acquirerProperties = self.ENEXT_PAYMENT_SERVICES.normalizeOperations(orderId).normalizeResponseByAcquirerModel(req.body.paymentProviderProperties);

                                    logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: Initiating transaction association process between payment provider and antifraud provider [Cybersource]'));
                                    let associationIdOperationResponse = await new Cybersource().analysisOperations(orderId).associationTransaction(req, req.body.antifraudProviderProperties.antifraudTransactionId);

                                    if (!associationIdOperationResponse){
                                        occResponseModel = self.ENEXT_PAYMENT_SERVICES.normalizeOperations(orderId).normalizeResponsesByOccModel(req.body.paymentProviderProperties, req.body.antifraudProviderProperties);
                                        responseToWebHook = await this.normalizeResponseToWebHook(req, gatewaySettings.antifraudProviderSecondOperation, this.secondOperationResponse.ResponseCode, this.secondOperationResponse.ReasonMessage, occResponseModel);

                                        if(!isOrderPreAuthorized){
                                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: Response sent to CreditCard WebHook => ${responseToWebHook.authorizationResponse.responseReason}`));
            
                                            return res
                                            .status(200)
                                            .json(responseToWebHook)
                                            .end();
                                        }
                                        else{
                                            //TODO: Após ser accept e accept para pagamentos e análises de fraude, capturar o pedido.
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
                                            
                                            logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix, `Enext Base Service: Order ${req.body.orderProperties.orderId} authorized successfully`));

                                            req.body.antifraudProviderProperties = self.ENEXT_ANTIFRAUD_SERVICES.normalizeOperations(req.body.orderProperties.orderId).normalizeResponseByNotificationModel(req.body.antifraudProviderProperties);

                                            if(req.body.antifraudProviderProperties.antifraudTransactionStatus !== self.ENEXT_ANTIFRAUD_SERVICES.antifraudWebHookOperations().getStatusAllowedToCaptureOrder()){
                                                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: Order ${req.body.orderProperties.orderId} are await an notification from antifraud provider`));
                                                return res
                                                .status(200)
                                                .json({message: `Enext Base Service: Order ${req.body.orderProperties.orderId} authorized successfully`})
                                                .end();
                                            }
                                            else{
                                                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: Sending order ${req.body.orderProperties.orderId} to decision manager to capture payment`));
                                                return await self.ENEXT_PAYMENT_SERVICES.paymentWebHookOperations(req.body.orderProperties.orderId).decisionManager(req, res);
                                            }
                                        }
                                    }
                                    else{
                                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: An error has occurred when association transaction has been processed => ${associationIdOperationResponse.message}`));

                                        return res
                                        .status(associationIdOperationResponse.statusCode || 500)
                                        .json({message:`Enext Custom Payment Gateway: ${associationIdOperationResponse.message}`})
                                        .end();
                                    }
                                }
                                else{
                                    occResponseModel = self.ENEXT_PAYMENT_SERVICES.normalizeOperations(orderId).normalizeResponsesByOccModel(req.body.paymentProviderProperties, req.body.antifraudProviderProperties);
                                    responseToWebHook = await this.normalizeResponseToWebHook(req, gatewaySettings.antifraudProviderSecondOperation, this.secondOperationResponse.ResponseCode, this.secondOperationResponse.ReasonMessage, occResponseModel);
            
                                    if(!isOrderPreAuthorized){
                                        logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: Response sent to CreditCard WebHook => ${responseToWebHook.authorizationResponse.responseReason}`));
        
                                        return res
                                        .status(200)
                                        .json(responseToWebHook)
                                        .end();
                                    }
                                    else{
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
                                        
                                        logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: Order ${req.body.orderProperties.orderId} authorized successfully`));

                                        req.body.antifraudProviderProperties = self.ENEXT_ANTIFRAUD_SERVICES.normalizeOperations().normalizeResponseByNotificationModel(req.body.antifraudProviderProperties);

                                        if(req.body.antifraudProviderProperties.antifraudTransactionStatus !== self.ENEXT_ANTIFRAUD_SERVICES.antifraudWebHookOperations().getStatusAllowedToCaptureOrder()){
                                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: Order ${req.body.orderProperties.orderId} are await an notification from antifraud provider`));
                                            return res
                                            .status(200)
                                            .json({message: `Enext Base Service: Order ${req.body.orderProperties.orderId} authorized successfully`})
                                            .end();
                                        }
                                        else{
                                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: Sending order ${req.body.orderProperties.orderId} to decision manager to capture payment`));
                                            return await self.ENEXT_PAYMENT_SERVICES.paymentWebHookOperations(req.body.orderProperties.orderId).decisionManager(req, res);
                                        }
                                    }
                                }
                            }
                            else {
                                if (gatewaySettings.antifraudProviderSecondOperation === 'analyze') {
                                    logger.log('error', loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: Second operation analyze failed'));
    
                                    req.body.paymentProviderProperties = this.firstOperationResponse;
                                    req.body.antifraudProviderProperties = this.secondOperationResponse;
    
                                    //*******************  Refund/Cancel Transaction in Payment Provider **********************
                                    req.body.paymentProviderProperties = req.body.paymentProviderProperties;
                                    let refundOperationResponse = await self.ENEXT_PAYMENT_SERVICES.paymentOperations(orderId).refundPayment(req, true);

                                    if(!refundOperationResponse.error){
                                        occResponseModel = self.ENEXT_PAYMENT_SERVICES.normalizeOperations(orderId).normalizeResponsesByOccModel(req.body.paymentProviderProperties, req.body.antifraudProviderProperties);
                                        responseToWebHook = await this.normalizeResponseToWebHook(req, 'analyze', this.secondOperationResponse.ResponseCode, this.secondOperationResponse.ReasonMessage, occResponseModel);
                                        responseToWebHook.additionalProperties.paymentProviderMessage = 'Transaction canceled';
                                        
                                        if(!isOrderPreAuthorized){
                                            logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: Transaction canceled !`));

                                            return res
                                            .status(200)
                                            .json(responseToWebHook)
                                            .end();
                                        }
                                        else{
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
                                            
                                            logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: Order ${req.body.orderProperties.orderId} canceled successfully`));
                                            return res
                                            .status(200)
                                            .json({message: `Enext Base Service: Order ${req.body.orderProperties.orderId} canceled successfully`})
                                            .end();
                                        }
                                    }
                                    else{
                                        logger.log('error', loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: An error has occurred when refund creditCard has been processed. Message: ${err.message}`));
                                        logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,err));

                                        return res
                                        .status(refundOperationResponse.statusCode || 500)
                                        .json({ message: `Enext Custom Payment Gateway: ${err.message}` })
                                        .end();
                                    }
                                }
                                else {
                                    // ******************  Reject Order ***********************
                                    logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: Second operation authorization failed'));
                                    
                                    req.body.paymentProviderProperties = this.secondOperationResponse;
                                    req.body.antifraudProviderProperties = this.firstOperationResponse;
                                    
                                    if (!req.body.paymentProviderProperties.error){
                                        if(gatewaySettings.antifraudProviderName === 'cybersource' && gatewaySettings.antifraudProviderSecondOperation === 'authorize'){
                                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: Getting fields from acquirer to make transaction association'));
                                            req.body.acquirerProperties = self.ENEXT_PAYMENT_SERVICES.normalizeOperations(orderId).normalizeResponseByAcquirerModel(req.body.paymentProviderProperties);
        
                                            logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: Initiating transaction association process between payment provider and antifraud provider [Cybersource]'));
                                            let associationIdOperationResponse = await new Cybersource().analysisOperations(orderId).associationTransaction(req, req.body.antifraudProviderProperties.antifraudTransactionId);

                                            if (associationIdOperationResponse){
                                                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: An error has occurred when association transaction has been processed => ${associationIdOperationResponse.message}`));
        
                                                return res
                                                .status(500)
                                                .json({message:`Enext Custom Payment Gateway: ${associationIdOperationResponse.message}`})
                                                .end();
                                            }
                                        }
                                    }

                                    occResponseModel = self.ENEXT_PAYMENT_SERVICES.normalizeOperations(orderId).normalizeResponsesByOccModel(req.body.paymentProviderProperties, req.body.antifraudProviderProperties);
                                    responseToWebHook = await this.normalizeResponseToWebHook(req, 'authorize', this.secondOperationResponse.ResponseCode, this.secondOperationResponse.ReasonMessage, occResponseModel);

                                    if(!isOrderPreAuthorized){
                                        logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: ${responseToWebHook.authorizationResponse.responseReason}`));
                                    
                                        return res
                                        .status(200)
                                        .json(responseToWebHook)
                                        .end();
                                    }
                                    else{
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
                                        
                                        logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: Order ${req.body.orderProperties.orderId} canceled successfully`));
                                        return res
                                        .status(200)
                                        .json({message: `Enext Base Service: Order ${req.body.orderProperties.orderId} canceled successfully`})
                                        .end();
                                    }
                                }
                            }
                        }
                        else{
                            // ******************  Reject Order ***********************                               
                            if (gatewaySettings.antifraudProviderFirstOperation === 'analyze'){
                                logger.log('error', loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: First operation analyze failed'));
                                req.body.antifraudProviderProperties = this.firstOperationResponse;
                            }
                            else{
                                logger.log('error', loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: First operation authorization failed'));
                                req.body.paymentProviderProperties = this.firstOperationResponse;
                            }

                            occResponseModel = self.ENEXT_PAYMENT_SERVICES.normalizeOperations(orderId).normalizeResponsesByOccModel(req.body.paymentProviderProperties, req.body.antifraudProviderProperties);
                            responseToWebHook = await this.normalizeResponseToWebHook(req, gatewaySettings.antifraudProviderFirstOperation, this.firstOperationResponse.ResponseCode, this.firstOperationResponse.ReasonMessage, occResponseModel);

                            if(!isOrderPreAuthorized){
                                logger.log('error', loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: ${responseToWebHook.authorizationResponse.responseReason}`));

                                return res
                                .status(200)
                                .json(responseToWebHook)
                                .end();
                            }
                            else{
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
                                
                                logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: Order ${req.body.orderProperties.orderId} canceled successfully`));
                                return res
                                .status(200)
                                .json({message: `Enext Base Service: Order ${req.body.orderProperties.orderId} canceled successfully`})
                                .end();

                            }
                        }
                    }
                    else{
                        logger.log('error', loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: First operation and second operation can not be equals !'));
                        
                        return res
                        .status(400)
                        .json({ message: 'Enext Custom Payment Gateway: First operation and second operation can not be equals !' })
                        .end();
                    }
                }
                catch(e){
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: An error has occurred when payment with antifraud has been processed. Message: ${e.message}`));
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%O'),e);

                    return res
                    .status(500)
                    .json({ message: `Enext Custom Payment Gateway: ${e.message}`})
                    .end();
                }
            },

            async paymentWithoutAntiFraud(req, res) {
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'paymentWithoutAntiFraud' }];

                try{
                    let gatewaySettings = req.body.gatewaySettings;
                    let  responseToWebHook, occResponseModel;
                    
                    self.ENEXT_PAYMENT_SERVICES = new EnextPaymentServices(gatewaySettings.paymentProviderName);
                    self.ENEXT_PAYMENT_SERVICES.setPaymentProviderImplementation = self.ENEXT_PAYMENT_SERVICES.getPaymentProviderName;
    
                    logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: Processing payment without antifraud'));
    
                    // ****************************** Order flow **********************************************
                    logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: Flow => Authorize'));
                    
                    req.body.orderProperties.paymentInfo.amount /= 100;

                    this.operationResponse = await self.ENEXT_PAYMENT_SERVICES.paymentOperations(orderId).authorizePayment(req);

                    occResponseModel = self.ENEXT_PAYMENT_SERVICES.normalizeOperations(orderId).normalizeResponsesByOccModel(this.operationResponse);
                    responseToWebHook = await this.normalizeResponseToWebHook(req, 'authorize', this.operationResponse.ResponseCode, this.operationResponse.ReasonMessage, occResponseModel);
                    
                    if(this.operationResponse.ResponseCode === OracleCommerceCloud.APPROV_CODE){
                        logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: Response sent to WebHook => ${responseToWebHook.authorizationResponse.responseReason}`));
                        
                        return res
                        .status(200)
                        .json(responseToWebHook)
                        .end();
                    }
                    else {
                        // ******************  Reject Order ***********************
                        logger.log('error', loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Base Service: Operation authorization failed'));
                        logger.log('error', loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: ${responseToWebHook.authorizationResponse.responseReason}`));
                        
                        return res
                        .status(this.operationResponse.statusCode || 500)
                        .json(responseToWebHook)
                        .end();
                    }
                }
                catch(e){
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Enext Base Service: An error has occurred when payment without antifraud has been processed. Message: ${e.message}`));
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%O'),e);

                    return res
                    .status(500)
                    .json({ message: `Enext Custom Payment Gateway: ${e.message}`})
                    .end();
                }
            }
        }
    }
}