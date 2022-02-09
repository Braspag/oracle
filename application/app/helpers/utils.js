const request = require('request-promise');
const sleep = require('sleep');
const loggerHandler = require('./logger');
const logger = loggerHandler.LoggerBuilder();

module.exports = class Utils{

    //Namespace utils to request
    requestUtils(){
        let messagePrefix = [{ key:'Operation', value:'Utils' }];

        let normalizeErrorResponse = (error,parserErrorClass=undefined) => (parserErrorClass)? parserErrorClass.restApiErrorHandler(error): this.requestUtils().httpErrorHandler(error);

        return {
            
            httpErrorHandler(error){
                if (!error.hasOwnProperty("statusCode"))
                error = {
                    message: error.message,
                    continue: false
                };
                else{
                    if(error.statusCode == 400)
                        error = {
                            statusCode: error.statusCode,
                            message: "Bad Request, check your body request",
                            continue: false
                        };
                    else if(error.statusCode == 401)
                        error = {
                            statusCode: error.statusCode,
                            message: "Unauthorized, check your credentials they are ok",
                            continue: false
                        };
                    else if(error.statusCode == 403)
                        error = {
                            statusCode: error.statusCode,
                            message: "Forbidden, you don't have permission to access this resource on server",
                            continue: false
                        };
                    else if(error.statusCode == 404)
                        error = {
                            statusCode: error.statusCode,
                            message: `Resource not Found, check if endpoint application is correct. Endpoint: ${error.options.url}`,
                            continue: false
                        };
                    else if(error.statusCode == 405)
                        error = {
                            statusCode: error.statusCode,
                            message: "Method is not allowed to this endpoint",
                            continue: false
                        };
                    else if(error.statusCode == 500)
                        error = {
                            statusCode: error.statusCode,
                            message: "Internal server error, check if server is operational",
                            continue: true
                        };
                    else if(error.statusCode == 502)
                        error = {
                            statusCode: error.statusCode,
                            message: "Bad gateway, check request payload",
                            continue: true
                        };
                    else if(error.statusCode == 503)
                        error = {
                            statusCode: error.statusCode,
                            message: "Service unavailable, maybe that application server is overloaded or under maintenance",
                            continue: true
                        };
                    else if(error.statusCode == 504)
                        error = {
                            statusCode: error.statusCode,
                            message: "Gateway timout, the server has a high response time",
                            continue: true
                        };   
                    else
                        error = {
                            statusCode: error.statusCode || 500,
                            message: error.message,
                            continue: false
                        };
                }
                error.error = true;
                return error;
            },

            async doRequest(options, attempts=0,parserErrorClass=undefined){
                logger.log('info',loggerHandler.formatMessage(messagePrefix,'Enext Custom Payment Gateway: Making request !'));
                try {
                    options.timeout = 30000*attempts;
                    options.time = true;
                    options.resolveWithFullResponse = true;
                    const response = await request(options);
                    logger.log('info',loggerHandler.formatMessage(messagePrefix,`Enext Custom Payment Gateway: Successful request. Response time [${response.elapsedTime}ms] `));
                    return response.body;
                }
                catch(err) {
                    logger.log('info',loggerHandler.formatMessage(messagePrefix,`Enext Custom Payment Gateway: Failed request, message: ${err.message} | Attempt: ${(attempts+1)}`));
                    err = normalizeErrorResponse(err, parserErrorClass);

                    if (attempts + 1 < 5 && err.continue) {
                        logger.log('info',loggerHandler.formatMessage(messagePrefix,'Enext Custom Payment Gateway: Trying make request again after 3s!'));
                        sleep.sleep(3);
                        return await this.doRequest(options, attempts + 1, parserErrorClass); //Recursive retry
                    }
                    return err;
                }
            }
        }
    }
}