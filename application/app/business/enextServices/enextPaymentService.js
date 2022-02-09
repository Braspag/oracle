const loggerHandler = require('../../helpers/logger');
const logger = loggerHandler.LoggerBuilder();

module.exports = class EnextPaymentServices{

    constructor(paymentProviderName){
        this.paymentProviderName = paymentProviderName;
    }

    get getPaymentProviderName(){ return this.paymentProviderName }

    get getPaymentProviderImplementation(){ return this.paymentProviderImplementation }

    set setPaymentProviderImplementation(paymentProviderName){
        let paymentProviderClass = require(`../paymentProviders/${paymentProviderName}/${paymentProviderName}`);
        this.paymentProviderImplementation = new paymentProviderClass();
    }

    //Checkout operation namespace
    checkoutOperations(orderId){
        let paymentProviderImplementation = this.getPaymentProviderImplementation;
        let messagePrefix = [
            { key:'Order', value: orderId },
            { key:'PaymentProvider', value: this.getPaymentProviderName},
        ];
        let functionScopeMessagePrefix;

        return {
            //Used when the customer's ends the purchase in checkout page
            checkoutRequestHandler(req, res, isOrderPreAuthorized=false) {
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'checkoutRequestHandler' }];
                logger.log('info',loggerHandler.formatMessage(messagePrefix,`Enext Custom Payment Gateway Operation: ${(!isOrderPreAuthorized)?'Processing checkout request':'Processing payment before the pre authorization'}`));
                return paymentProviderImplementation.checkoutOperations(orderId).checkoutRequestHandler(req,res,isOrderPreAuthorized);
            },
            
            //Used when the gateway's processing the payment authorization
            authorizePayment(req){
                functionScopeMessagePrefix = [ ...messagePrefix,{ key:'Operation', value: 'authorizePayment' }];
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Custom Payment Gateway Operation: Authorize payment'));
                return paymentProviderImplementation.authorizeOperations().authorizePayment(req);
            },

            //Used when the store chooses use the native integration between payment provider (Braspag) + antifraud provider (Cybersource)
            fullIntegrationAuthorizePayment(req){
                functionScopeMessagePrefix = [ ...messagePrefix,{ key:'Operation', value: 'fullIntegrationAuthorizePayment' }];
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Custom Payment Gateway Operation: Full integration authorize payment'));
                return paymentProviderImplementation.authorizeOperations().fullIntegrationAuthorizePayment(req);
            }
        }
    };

    //Normalize operation namespace
    normalizeOperations(orderId){
        let paymentProviderImplementation = this.getPaymentProviderImplementation;
        let messagePrefix = [
            { key:'Order', value: orderId },
            { key:'PaymentProvider', value: this.getPaymentProviderName},
        ];
        let functionScopeMessagePrefix;

        return {
            normalizeResponsesByOccModel(paymentResult, antifraudResult) {
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'normalizeResponsesByOccModel' }];
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Custom Payment Gateway Operation: Processing response normalization by occ model'));
                return paymentProviderImplementation.normalizeOperations().normalizeResponsesByOccModel(paymentResult, antifraudResult);
            },

            normalizeResponseByAcquirerModel(paymentResult) {
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'normalizeResponseByAcquirerModel' }];
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Custom Payment Gateway Operation: Processing response normalization by acquirer model'));
                return paymentProviderImplementation.normalizeOperations().normalizeResponseByAcquirerModel(paymentResult);
            }
        }
    }

    //Payment operation namespace
    paymentOperations(orderId){
        let paymentProviderImplementation = this.getPaymentProviderImplementation;
        let messagePrefix = [
            { key:'Order', value: orderId },
            { key:'PaymentProvider', value: this.getPaymentProviderName},
        ];
        let functionScopeMessagePrefix;

        return {
            //Used when the gateway's processing the payment authorization
            authorizePayment(req){
                functionScopeMessagePrefix = [ ...messagePrefix,{ key:'Operation', value: 'authorizePayment' }];
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Custom Payment Gateway Operation: Authorize payment'));
                return paymentProviderImplementation.authorizeOperations().authorizePayment(req);
            },

            //Used when the store chooses use the native integration between payment provider (Braspag) + antifraud provider (Cybersource)
            fullIntegrationAuthorizePayment(req){
                functionScopeMessagePrefix = [ ...messagePrefix,{ key:'Operation', value: 'fullIntegrationAuthorizePayment' }];
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Custom Payment Gateway Operation: Full integration authorize payment'));
                return paymentProviderImplementation.authorizeOperations().fullIntegrationAuthorizePayment(req);
            },

            refundPayment(req,isCheckoutOrderConfirmation=false){
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'refundPayment' }];
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Custom Payment Gateway Operation: Refund payment'));
                return paymentProviderImplementation.paymentOperations(orderId).refundPayment(req, isCheckoutOrderConfirmation);
            },
        
            capturePayment(req){
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'capturePayment' }];
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Custom Payment Gateway Operation: Capture payment'));
                return paymentProviderImplementation.paymentOperations(orderId).capturePayment(req);
            },

            getPaymentTransactionStatus(req, transactionId){
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'getTransactionStatus' }];
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Custom Payment Gateway Operation: Get transaction status '));
                return paymentProviderImplementation.paymentOperations(orderId).getPaymentTransactionStatus(req, transactionId);
            },
        }
    }

    //Payment webhook operation namespace
    paymentWebHookOperations(){
        let paymentProviderImplementation = this.getPaymentProviderImplementation;
        let messagePrefix = [
            { key:'PaymentProvider', value: this.getPaymentProviderName},
            { key:'Operation', value: 'notificationRequestHandler' }
        ];

        return {
            notificationRequestHandler(req, res){
                logger.log('info',loggerHandler.formatMessage(messagePrefix,'Enext Custom Payment Gateway Operation: Receive notification by payment provider'));
                return paymentProviderImplementation.paymentWebHookOperations().notificationRequestHandler(req, res);
            },

            decisionManager(req, res){
                logger.log('info',loggerHandler.formatMessage(messagePrefix,'Enext Custom Payment Gateway Operation: Payment decision manager will be process transaction'));
                return paymentProviderImplementation.paymentWebHookOperations().decisionManager(req, res);
            }
        };
    };
}