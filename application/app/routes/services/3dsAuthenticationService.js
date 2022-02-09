const express = require('express');
const router = express.Router();

//Versions of 3DS authentication
router.use('/v2', require('./3dsAuthenticationService/v2/index'));

module.exports = router;