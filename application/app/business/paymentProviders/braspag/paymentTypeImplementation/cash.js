const CashAbstraction = require('../paymentTypeAbstraction/cash');

/** 
 * This module treats the integration with Braspag API when the order checkout calls generic card payment.
 * @module paymentProvidesr/braspag/cash
 * @requires cashAbstractionClass
 * @requires logger
 */

/**
 * @fileoverview This route treats all the calls from OCC using the generic card payment webhook;
 */

module.exports = class Cash extends CashAbstraction{

    constructor(){
        super();
    }
}