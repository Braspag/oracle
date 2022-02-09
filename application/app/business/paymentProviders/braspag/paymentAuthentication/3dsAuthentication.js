const Utils = require('../../../../helpers/utils');
const loggerHandler = require('../../../../helpers/logger');
const logger = loggerHandler.LoggerBuilder();
const btoa = require('btoa');

module.exports = class Authentication3DS {
    
    constructor(){
        this.UTILS = new Utils();
        this.Braspag = require('../braspag');
    }

    //Authorize operation namespace
    authenticationOperations(){
        let self = this;
        let messagePrefix = [
            { key:'PaymentProvider', value: 'braspag' },
        ];
        let functionScopeMessagePrefix;
        
        let buildAuthenticationObject = (req) => {
            functionScopeMessagePrefix = [
                ...messagePrefix,
                { key:'Operation', value: 'getToken' },
            ];

            let body = {
                EstablishmentCode: req.body.gatewaySettings.paymentProvider3dsAuthenticationEstablishmentCode,
                MerchantName: req.body.gatewaySettings.paymentProvider3dsAuthenticationMerchantName,
                MCC: req.body.gatewaySettings.paymentProvider3dsAuthenticationMCC
            };

            logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider 3DS Authentication: Object sent to Braspag %j'), body);
            return body;
        };

        let buildAuthorizeOptionsRequest = (req)=> {
            let options = {
                method: 'POST',
                uri: `${req.body.gatewaySettings.paymentProvider3dsAuthenticationEndpoint}/v2/auth/token`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${btoa(`${req.body.gatewaySettings.paymentProvider3dsAuthenticationClientId}:${req.body.gatewaySettings.paymentProvider3dsAuthenticationClientSecret}`)}`
                },
                body: buildAuthenticationObject(req),
                json: true,
            };

            return options;
        };

        return {
            
            async getToken(req){
                functionScopeMessagePrefix = [
                    ...messagePrefix,
                    { key:'Operation', value: 'getToken' },
                ];
                
                try{
                    if (req.body.gatewaySettings.use3dsAuthentication){
                        let authentication3dsResponse = await self.UTILS.requestUtils().doRequest(buildAuthorizeOptionsRequest(req), 0, self.Braspag);
                        authentication3dsResponse.use3dsAuthentication = req.body.gatewaySettings.use3dsAuthentication;
                        authentication3dsResponse.useAntifraudWith3dsAuthenticationFail = req.body.gatewaySettings.useAntifraudWith3dsAuthenticationFail;
                        logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider 3DS: Authentication response %j'), authentication3dsResponse);
                        return authentication3dsResponse;
                    }
                    else{
                        logger.log('info', loggerHandler.formatMessage(functionScopeMessagePrefix,'Braspag Payment Provider 3DS: Feature not enabled, verify your gateway settings !'));
                        return { use3dsAuthentication: false, useAntifraudWith3dsAuthenticationFail:false, message: 'Enext Custom Payment Gateway: Feature not enabled, verify your gateway settings !' };
                    }
                        
                }
                catch(e){
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,`Braspag Payment Provider 3DS: An error has occurred when 3DS payment authentication was processed. Message ${e.message}`));
                    logger.log('error',loggerHandler.formatMessage(functionScopeMessagePrefix,'%O'),e);                   
                        
                    return {
                       error: true,
                       message: e.message
                    };
                }
            }
        }
    }
}
