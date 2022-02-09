/**
 * @fileoverview Payment Gateway Option Widget.
 * 
 * @author 
 */
define(

  //-------------------------------------------------------------------
  // DEPENDENCIES
  //-------------------------------------------------------------------
  [],

  //-------------------------------------------------------------------
  // MODULE DEFINITION
  //-------------------------------------------------------------------
  function () {

    "use strict";

    return {

      GTM_CONTAINER_ID: 'GTM-T643LK7',

      onLoad: function (widget) {
        if (localStorage.getItem('fingerprint_id') != undefined){
          var start_date = new Date(parseInt(localStorage.getItem('fingerprint_id')));
          var expire_date = new Date();

          var diff = parseInt((expire_date - start_date)/ (1000 * 60 * 60 * 24));

          if (diff >= 2){
            console.log('[Fingerprint] Message: Configuring a new device fingerprint id');
            localStorage.setItem('fingerprint_id', new Date().getTime());
          }
          else
            console.log('[Fingerprint] Message: Device fingerprint id is valid')
        }
        else{
          console.log('[Fingerprint] Message: Configuring a new device fingerprint id');
          localStorage.setItem('fingerprint_id', new Date().getTime());
        }
        
        window.dataLayer = [{
            fingerprint_id: localStorage.getItem('fingerprint_id'),
            //--- Teste para Brasif
            // fingerprint_session_id: 'braspag_brasif'.concat(localStorage.getItem('fingerprint_id'))
            //-- Teste para Cybersource
            // fingerprint_session_id: localStorage.getItem('fingerprint_id')
            //--- Teste para Braspag
            fingerprint_session_id: 'braspag'.concat(localStorage.getItem('fingerprint_id'))
        }];
        
        //Setup GTM
        (function(w,d,s,l,i){
          w[l]=w[l]||[];
          w[l].push({
            'gtm.start':new Date().getTime(),
            event:'gtm.js'
          });
          var f=d.getElementsByTagName(s)[0], j=d.createElement(s), dl= l!='dataLayer'?'&l='+l:'';
          j.async=true;
          j.src= 'https://www.googletagmanager.com/gtm.js?id='+i+dl;
          f.parentNode.insertBefore(j,f);
          
        })(window,document,'script','dataLayer',this.GTM_CONTAINER_ID);
      }
    };
  }
);