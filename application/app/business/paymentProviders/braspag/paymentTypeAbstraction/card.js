const OracleCommerceCloud = require('../../../../helpers/occ');
const Utils = require('../../../../helpers/utils');
const loggerHandler = require('../../../../helpers/logger');
const logger = loggerHandler.LoggerBuilder();

module.exports = class CardAbstraction {
    
    constructor(){
        this.UTILS = new Utils();
        this.Braspag = require('../braspag');
    }

    /**
     * Credit Card Brands
     * @constant
     * @enum {string}
     */
    static get CARD_BRANDS(){
        return {
            elo: 'Elo',
            visa: 'Visa',
            mastercard: 'Master',
            amex: 'Amex'
        }
    };

    //Authorize operation namespace
    authorizeOperations(){
        let self = this;
        return {
            
            async authorizePayment(options, isFullIntegration=false){
                let messagePrefix = [
                    { key:'Order', value: options.body.MerchantOrderId },
                    { key:'PaymentProvider', value: 'braspag' },
                    { key:'Operation', value: 'authorizePayment' },
                ];
                logger.log('info', loggerHandler.formatMessage(messagePrefix,'Braspag Payment Provider Card Abstraction: Card abstraction authorizing payment'));
                
                try{
                    let authorizePaymentResponse = await self.UTILS.requestUtils().doRequest(options, 0, self.Braspag);
                    logger.log('info', loggerHandler.formatMessage(messagePrefix,'Braspag Payment Provider Card Abstraction: Authorization response %j'), authorizePaymentResponse);

                    if (!authorizePaymentResponse.error){
                        let payload = authorizePaymentResponse;

                        /** Check payment Type and Braspag response. Code: 1 Status: Payment Authorized, Code: 2 Status: Captured, Code: 13 Status: Aborted
                         * Description: When Braspag payment API return Status = 2, the client is using automatic capture, if Status = 1
                         * the client only authorized payment.
                         */                                                                                            
                        if (payload.Payment.Type === 'CreditCard'){
                            if (isFullIntegration){
                                //Authorize if anti fraude response  is Accept or Review |  Code:1 Status: Anti Fraud Accept, Code: 3 Status: Anti Fraud Review
                                if(payload.Payment.FraudAnalysis.Status === 1 || payload.Payment.FraudAnalysis.Status === 3){
                                    // Enext Custom Payment Gateway only accepts Authorized or PaymentConfirmed status to CreditCard payments
                                    if (payload.Payment.Status === 1 || payload.Payment.Status === 2){
                                        payload.ResponseCode = OracleCommerceCloud.APPROV_CODE;
                                        payload.ReasonMessage = (payload.Payment.Status === 2)? 'Success, payment with card captured':'Success, payment with card authorized';
                                    }
                                    else{
                                        payload.ResponseCode = OracleCommerceCloud.REPROV_CODE;
                                        payload.ReasonMessage = self.Braspag.TRANSACTION_STATUS[payload.Payment.Status].description.concat((payload.Payment.ProviderReturnMessage)?', '.concat(payload.Payment.ProviderReturnMessage.toLowerCase()):'');
                                        return payload;
                                    }
                                }
                                else{
                                    payload.ResponseCode = OracleCommerceCloud.REPROV_CODE;
                                    if (payload.Payment.FraudAnalysis.Status == 4 && payload.Payment.Status != 1 && payload.Payment.Status != 2)
                                        payload.ReasonMessage = self.Braspag.TRANSACTION_STATUS[payload.Payment.Status].description.concat((payload.Payment.ProviderReturnMessage)?', '.concat(payload.Payment.ProviderReturnMessage.toLowerCase(),'. The antifraud provider aborted fraud analysis.'):'');
                                    else
                                        payload.ReasonMessage = `Antifraud ${payload.Payment.FraudAnalysis.StatusDescription.toLowerCase()} transaction.`;
                                    return payload;
                                }
                                payload.Payment.FraudAnalysis.antifraudTransactionId = payload.Payment.FraudAnalysis.Id;
                                payload.Payment.FraudAnalysis.Status = payload.Payment.FraudAnalysis.StatusDescription;
                            }
                            //The client use other anti fraud or not use this service
                            else if (payload.Payment.Status === 1 || payload.Payment.Status === 2){
                                payload.ResponseCode = OracleCommerceCloud.APPROV_CODE;
                                payload.ReasonMessage = (payload.Payment.Status === 2)? 'Success, payment with card captured':'Success, payment with card authorized';
                            }
                            else{
                                payload.ResponseCode = OracleCommerceCloud.REPROV_CODE;
                                payload.ReasonMessage = self.Braspag.TRANSACTION_STATUS[payload.Payment.Status].description.concat((payload.Payment.ProviderReturnMessage)?', '.concat(payload.Payment.ProviderReturnMessage.toLowerCase()):'');
                            }
                        }
                        /*
                        Code: 0 Status: NotFinished | Description: DebitCard payment type needs to client authentication on card provider page,
                        after this authentication, the Braspag payment webhook sends an notification to Enext Custom Payment Gateway sayng
                        if payment was confirmed or void/refunded
                        */
                        else if (payload.Payment.Type === 'DebitCard' && payload.Payment.Status === 0){
                            payload.ResponseCode = OracleCommerceCloud.APPROV_CODE;
                            payload.ReasonMessage = 'Success, payment with card authorized';
                        }
                        else{
                            payload.ResponseCode = OracleCommerceCloud.REPROV_CODE;
                            payload.ReasonMessage = self.Braspag.TRANSACTION_STATUS[payload.Payment.Status].description.concat((payload.Payment.ProviderReturnMessage)?', '.concat(payload.Payment.ProviderReturnMessage.toLowerCase()):'');
                        }
                        return payload;
                    }
                    else{
                        authorizePaymentResponse.ResponseCode = OracleCommerceCloud.REPROV_CODE,
                        authorizePaymentResponse.ReasonMessage = authorizePaymentResponse.message
                        return authorizePaymentResponse;
                    }

                }
                catch(e){
                    logger.log('error',loggerHandler.formatMessage(messagePrefix,`Braspag Payment Provider Card Abstraction: An error has occurred when card payment authorization was processed. Message ${e.message}`));
                    logger.log('error',loggerHandler.formatMessage(messagePrefix,'%O'),e);                   
                        
                    return {
                       ResponseCode: OracleCommerceCloud.REPROV_CODE,
                       ReasonMessage: e.message
                    };
                }
            }
        }
    }
}
