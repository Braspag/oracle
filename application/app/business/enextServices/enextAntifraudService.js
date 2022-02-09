const loggerHandler = require('../../helpers/logger');
const logger = loggerHandler.LoggerBuilder();

module.exports = class EnextAntifraudServices{

    constructor(antifraudProviderName){
        this.antifraudProviderName = antifraudProviderName;
    }

    get getAntifraudProviderName() { return this.antifraudProviderName }
    
    get getAntifraudProviderImplementation() { return this.antifraudProviderImplementation }

    set setAntifraudProviderImplementation(antifraudProviderName){
        let antifraudProviderClass = require(`../antifraudProviders/${antifraudProviderName}/${antifraudProviderName}`);
        this.antifraudProviderImplementation = new antifraudProviderClass();
    }
    
    //Checkout operation namespace
    analysisOperations(orderId){
        let antifraudProviderImplementation = this.getAntifraudProviderImplementation;
        let messagePrefix = [
            { key:'AntifraudProvider', value: this.getAntifraudProviderName}
        ];
        if(orderId)
            messagePrefix.push({ key:'Order', value: orderId });

        let functionScopeMessagePrefix;

        return {
            sendToAnalysis(req){
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'sendToAnalysis' }];
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Custom Payment Gateway Operation: Antifraud send transaction to analysis'));
                return antifraudProviderImplementation.analysisOperations(orderId).sendToAnalysis(req);
            },
            getAntifraudTransactionStatus(req, transactionId){
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'getAntifraudTransactionStatus' }];
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Custom Payment Gateway Operation: Antifraud send transaction to analysis'));
                return antifraudProviderImplementation.analysisOperations(orderId).getAntifraudTransactionStatus(req, transactionId);
            }
        }
    };

    //Normalize operation namespace
    normalizeOperations(orderId){
        let antifraudProviderImplementation = this.getAntifraudProviderImplementation;
        let messagePrefix = [
            { key:'Order', value: orderId },
            { key:'AntifraudProvider', value: this.getAntifraudProviderName},
            { key:'Operation', value: 'normalizeResponseByNotificationModel' }
        ];

        return {
            normalizeResponseByNotificationModel(antifraudResult) {
                logger.log('info',loggerHandler.formatMessage(messagePrefix,'Enext Custom Payment Gateway Operation: Processing response normalization by notification model'));
                return antifraudProviderImplementation.normalizeOperations().normalizeResponseByNotificationModel(antifraudResult);
            }
        }
    }

    //Antifraud webhook operation namespace
    antifraudWebHookOperations(){
        let antifraudProviderImplementation = this.getAntifraudProviderImplementation;
        let messagePrefix = [
            { key:'AntifraudProvider', value: this.getAntifraudProviderName},
            { key:'Operation', value: 'notificationRequestHandler' }
        ];

        return {   
            notificationRequestHandler(req, res){
                logger.log('info',loggerHandler.formatMessage(messagePrefix,'Enext Custom Payment Gateway Operation: Receive notification by anti fraud provider'));
                return antifraudProviderImplementation.antifraudWebHookOperations().notificationRequestHandler(req, res);
            },

            getStatusAllowedToCaptureOrder(){
                return antifraudProviderImplementation.antifraudWebHookOperations().getStatusAllowedToCaptureOrder();
            },

            getStatusUnallowedToCaptureOrder(){
                return antifraudProviderImplementation.antifraudWebHookOperations().getStatusUnallowedToCaptureOrder();
            }
        }
    };
}