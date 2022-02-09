const express = require('express');
const so = require('os')
const router = express.Router();

router.use(express.json());

router.route('/status')
    .get(function(req, res){
        console.log('Get request !');
        console.log('Headers !');
        console.log(req.headers);
        console.log('Body !');
        console.log(req.body);
    
        return res
        .status(200)
        .json({msg: 'ok, received request !'})
        .end();
    })
    .post(function(req, res){
        console.log('Post request !');
        console.log('Headers !');
        console.log(req.headers);
        console.log('Body !');
        console.log(req.body);
        return res
        .status(200)
        .json({msg: 'ok, received request !'})
        .end();
    });

router.route('/version')
    .get(function(req, res){
        console.log('Get request !');
        console.log('Headers !');
        console.log(req.headers);
        console.log('Body !');
        console.log(req.body);

        return res
        .status(200)
        .json({ 
            host_node_version: process.version,
            host_system: so.type(),
            host_system_version: so.release(),
        })
        .end();
    })
    .post(function(req, res){
        console.log('Get request !');
        console.log('Headers !');
        console.log(req.headers);
        console.log('Body !');
        console.log(req.body);
    
        return res
        .status(200)
        .json({ 
            host_node_version: process.version,
            host_system: so.type(),
            host_system_version: so.release(),
        })
        .end();
    });

router.post('/version', );

module.exports = router;