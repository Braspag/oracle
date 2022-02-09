const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, splat } = format;
require('winston-loggly-bulk');

/** 
 * This module configures the properties to log the application into remote server log loggly
 * @module logger
 * @requires winston
 * 
 */

const buildCustomLoggerObject = () => {

    return createLogger({
        format: combine(
            timestamp(),
            splat(),
            printf(({level, message, timestamp}) => String().concat(`[${level}][${timestamp}]`, message))
        ),
        transports: [
            new transports.Console(),
            new transports.Loggly({
                token: "2b114fa4-f1c3-48f8-b964-b8c77afbf476",
                subdomain: "enextcpg",
                tags: ["braspag"],
                json:true,
                timestamp: true,
                networkErrorsOnConsole: true,
                bufferOptions: { size: 1000, retriesInMilliSeconds: 60*1000 }
            })
        ]
    });
}
 
const formatMessage = (prefix=undefined, message) =>{
    let message_prefix = '';
    if (prefix)
        prefix.forEach(({key, value}) => {
            if (key)
                message_prefix = message_prefix.concat(`[${key}:${value}]`);
            else
                message_prefix = message_prefix.concat(`[${value}]`);
        });

    return String().concat(message_prefix,' ', message);
};

module.exports = {
    LoggerBuilder: buildCustomLoggerObject,
    formatMessage
};
