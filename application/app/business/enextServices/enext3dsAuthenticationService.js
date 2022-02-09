const loggerHandler = require('../../helpers/logger');
const logger = loggerHandler.LoggerBuilder();

module.exports = class Enext3dsAuthenticationServices{

    constructor(paymentProviderName){
        this.paymentProviderName = paymentProviderName;
    }

    get getPaymentProviderName(){ return this.paymentProviderName }

    get getPaymentProviderImplementation(){ return this.paymentProviderImplementation }

    set setPaymentProviderImplementation(paymentProviderName){
        let paymentProviderClass = require(`../paymentProviders/${paymentProviderName}/${paymentProviderName}`);
        this.paymentProviderImplementation = new paymentProviderClass();
    }

    //Authenticate operation namespace
    authenticateOperations(){
        let paymentProviderImplementation = this.getPaymentProviderImplementation;
        let messagePrefix = [ { key:'PaymentProvider', value: this.getPaymentProviderName} ];
        let functionScopeMessagePrefix;

        return {
            //Used when the checkout page is loaded
            async getToken(req, res) {
                functionScopeMessagePrefix = [ ...messagePrefix, { key:'Operation', value: 'getToken' }];
                logger.log('info',loggerHandler.formatMessage(functionScopeMessagePrefix,'Enext Custom Payment Gateway Operation: Processing get token '));
                return await paymentProviderImplementation.paymentAuthentication().getToken(req, res);
            }
        }
    };
}