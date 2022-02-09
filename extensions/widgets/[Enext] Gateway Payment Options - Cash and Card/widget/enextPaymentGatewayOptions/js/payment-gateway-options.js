/**
 * @fileoverview Payment Gateway Option Widget.
 * 
 * @author 
 */
define(

  //-------------------------------------------------------------------
  // DEPENDENCIES
  //-------------------------------------------------------------------
  ['jquery', 'pubsub', 'knockout'],

  //-------------------------------------------------------------------
  // MODULE DEFINITION
  //-------------------------------------------------------------------
  function ($, PubSub, ko) {

    "use strict";
    var customProperties, cartItems;

    return {

      selectedPaymentType: ko.observable(),

      saveCreditCard: ko.observable(false),

      tokenizedCard: ko.observable(),

      onLoad: function (widget) {
        var self = this;
        var authentication3dsResponse = {};

        console.log('Loading access token');
        fetch('https://occ-custom-payment-braspag.herokuapp.com/v1/payment/authentication/v2/token?ENV=PREVIEW', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ orderId: 'teste' })
        }).then(function (resp) {
          resp.json().then(function (body) { authentication3dsResponse = body; })
        });

        console.log('Loading cart products info ... ');
        cartItems = widget.cart().items();
        widget.cart().getProductDataForCart().then(function (response) {
          console.log('Processing cartItems')
          response.forEach(function (item, index) {
            console.log('Item Result:');
            console.log(item);
            cartItems[index].displayName = item.displayName;
            cartItems[index].originalPrice(item.salePrice);
          });
          console.log(cartItems);
        });

        // ------------- 3ds implementation ------------
        widget.createCardOrder3ds = function () {
          var node = document.getElementsByClassName("braspag-inputs")[0];
          if (node) {
            if (node.parentNode) {
              node.parentNode.removeChild(node);
            }
          }

          var obj3ds = {
            bpmpi_auth: "true",
            bpmpi_accesstoken: authentication3dsResponse.access_token,
            bpmpi_ordernumber: widget.user().orderId(),
            bpmpi_currency: "BRL",
            bpmpi_totalamount: widget.cart().total(),
            bpmpi_installments: "1",
            bpmpi_paymentmethod: "Credit",
            bpmpi_cardalias: document.getElementById('CC-checkoutPaymentDetails-nameOnCard').value,
            bpmpi_cardnumber: document.getElementById('CC-checkoutPaymentDetails-cardNumber').value,
            bpmpi_cardexpirationmonth: document.getElementById('CC-checkoutPaymentDetails-endMonth').value,
            bpmpi_cardexpirationyear: document.getElementById('CC-checkoutPaymentDetails-endYear').value,
            bpmpi_merchant_url: "http://www.enext.com.br",
            bpmpi_billto_contactname: "Destinatario de Teste",
            bpmpi_billTo_phonenumber: "552122326381",
            bpmpi_billTo_email: "destinatario@teste.com.br",
            bpmpi_billTo_street1: "Rua do Carmo 64",
            bpmpi_billTo_street2: "2º andar Centro",
            bpmpi_billTo_city: "Rio de Janeiro",
            bpmpi_billTo_state: "RJ",
            bpmpi_billto_country: "BR"
          };
          node = document.createElement("div");
          node.setAttribute("class", "braspag-inputs");
          node.hidden = true;
          Object.keys(obj3ds).forEach(function (key) {
            var input = document.createElement("input");
            input.setAttribute("type", "text");
            input.setAttribute("class", key);
            input.setAttribute("value", obj3ds[key]);
            node.appendChild(input);
          });
          document.body.appendChild(node);
          var scriptResponse = "var env = getQueryString(\"env\");\r\n    function bpmpi_config() {\r\n      return {\r\n        onReady: function() {\r\n          \/\/ Evento indicando quando a inicializa\u00E7\u00E3o do script terminou.\r\n          bpmpi_authenticate();\r\n        },\r\n        onSuccess: function(e) {\r\n          \/\/ Cart\u00E3o eleg\u00EDvel para autentica\u00E7\u00E3o, e portador autenticou com sucesso.\r\n          window.braspagInfo = {\r\n            cavv: e.Cavv,\r\n            xid: e.Xid,\r\n            eci: e.Eci,\r\n            version: e.Version,\r\n            referenceId: e.ReferenceId\r\n          };\r\n          $.Topic(\"enext.braspag.3dsAuthentication.success\").publish();\r\n          console.log(\"[Braspag3ds] => Success\");\r\n        },\r\n        onFailure: function(e) {\r\n          \/\/ Cart\u00E3o eleg\u00EDvel para autentica\u00E7\u00E3o, por\u00E9m o portador finalizou com falha.\r\n          window.braspagInfo = {\r\n            xid: e.Xid,\r\n            eci: e.Eci,\r\n            version: e.Version,\r\n            referenceId: e.ReferenceId\r\n          };\r\n          $.Topic(\"enext.braspag.3dsAuthentication.fail\").publish();\r\n          console.log(\"[Braspag3ds] => Failure. Message: \"+e.ReturnMessage);\r\n        },\r\n        onUnenrolled: function(e) {\r\n          \/\/ Cart\u00E3o n\u00E3o eleg\u00EDvel para autentica\u00E7\u00E3o (n\u00E3o autentic\u00E1vel).\r\n          window.braspagInfo = {\r\n            xid: e.Xid,\r\n            eci: e.Eci,\r\n            version: e.Version,\r\n            referenceId: e.ReferenceId\r\n          };\r\n          $.Topic(\"enext.braspag.3dsAuthentication.fail\").publish();\r\n          console.log(\"O cart\u00E3o n\u00E3o eleg\u00EDvel para autentica\u00E7\u00E3o (n\u00E3o autentic\u00E1vel).\");\r\n        },\r\n        onDisabled: function() {\r\n          \/\/ Loja n\u00E3o requer autentica\u00E7\u00E3o do portador (classe \"bpmpi_auth\" false -> autentica\u00E7\u00E3o desabilitada).\r\n          $.Topic(\"enext.braspag.3dsAuthentication.disabled\").publish();\r\n          console.log('[Braspag3ds] => The authentication is disabled');\r\n        },\r\n        onError: function(e) {\r\n          \/\/ Erro no processo de autentica\u00E7\u00E3o.\r\n          window.braspagInfo = {\r\n            xid: e.Xid,\r\n            eci: e.Eci,\r\n            returnCode: e.ReturnCode,\r\n            returnMessage: e.ReturnMessage,\r\n            referenceId: e.ReferenceId,\r\n          };\r\n          $.Topic(\"enext.braspag.3dsAuthentication.fail\").publish(e);\r\n          console.error(\"[Braspag3ds] => Error. Message: \"+e.ReturnMessage);\r\n        },\r\n        onUnsupportedBrand: function(e) {\r\n          \/\/ Bandeira n\u00E3o suportada para autentica\u00E7\u00E3o.\r\n          window.braspagInfo = {\r\n            returnCode: e.ReturnCode,\r\n            returnMessage: e.ReturnMessage,\r\n          };\r\n          $.Topic(\"enext.braspag.3dsAuthentication.fail\").publish(e);\r\n          console.log(\"[Braspag3ds] => Unsupported brand. Message: \"+e.ReturnMessage);\r\n        },\r\n        Environment: env ? env : \"SDB\",\r\n        Debug: true\r\n      };\r\n    }\r\n    function getQueryString(field) {\r\n      var href = window.location.href;\r\n      var reg = new RegExp(\"[?&]\" + field + \"=([^&#]*)\", \"i\");\r\n      var string = reg.exec(href);\r\n      return string ? string[1] : null;\r\n    }";
          var script3ds = document.createElement("script");
          var scriptValue = document.createTextNode(scriptResponse);
          script3ds.appendChild(scriptValue)
          document.body.appendChild(script3ds);
          var import3ds = document.createElement("script");
          import3ds.setAttribute('src', 'https://ccadmin-z9ta.oracleoutsourcing.com/braspag/BP.Mpi.3ds20.min.js');
          import3ds.setAttribute('type', 'text/javascript');
          document.body.appendChild(import3ds);
        }

        $.Topic("enext.braspag.3dsAuthentication.success").subscribe(function () { widget.createCardOrder(); });
        $.Topic("enext.braspag.3dsAuthentication.disabled").subscribe(function () { widget.createCardOrder(); });
        $.Topic("enext.braspag.3dsAuthentication.fail").subscribe(function () {
          // console.log(authentication3dsResponse);
          // console.log(widget);

          if (authentication3dsResponse.useAntifraudWith3dsAuthenticationFail)
            widget.createCardOrder();
        });

        console.log('Loading Custom Payment Gateway ... ');

        widget.order().addValidationCallback(function () {

          console.log("Callback Function Payment Validator !");

          if (widget.selectedPaymentType() == "cash") {
            widget.order().cashModel().customProperties = customProperties;
            console.log(widget.order().cashModel().customProperties);
            return true;
          }
          else if (widget.selectedPaymentType() == "creditCard") {
            widget.order().paymentDetails().customProperties = customProperties;
            console.log(widget.order().paymentDetails().customProperties);
            return true;
          }
          else {
            widget.order().paymentDetails().customProperties = customProperties;
            console.log(widget.order().paymentDetails().customProperties);
            return true;
          }
        });

        widget.handleUpdateProfile = function () {
          // Sends a PubSub message for the update
          console.log('Send user profile update event');
          $.Topic(PubSub.topicNames.USER_PROFILE_UPDATE_SUBMIT).publishWith(widget.user(), [{ message: "success" }]);
        }

        $.Topic('enext.shopper.savedcards.load').subscribe(function (msg, data) {
          console.log('Loading shopper saved cards');
          self.populateUserSavedCards(data);
        });

        $.Topic('enext.shopper.savedcards.remove').subscribe(function () {
          console.log('Removing shopper saved cards');
        });
      },

      disableCreditCardRadioButton: function () {
        $("#credit_card_payment_type").attr("checked", false);
        $("#debit_card_payment_type").attr("checked", true);
      },

      disableDebitCardRadioButton: function () {
        $("#debit_card_payment_type").attr("checked", false);
        $("#credit_card_payment_type").attr("checked", true);
      },

      setCustomFields: function (paymentType) {
        var widget = this;

        if ($("#CC-checkoutRegistration-identity").val() === "")
          $("#CC-checkoutRegistration-identity").val('02723702820');

        if ($("#CC-checkoutAddressBook-addressNumber").val() === "")
          $("#CC-checkoutAddressBook-addressNumber").val('78');

        if ($("#CC-checkoutAddressBook-district").val() === "")
          $("#CC-checkoutAddressBook-district").val('Pirajussara');

        customProperties = {
          properties3ds: JSON.stringify(window.braspagInfo),
          paymentType: paymentType, //Obrigatório
          identityType: "CPF", //Obrigatório
          identity: $("#CC-checkoutRegistration-identity").val(), //Obrigatório
          shippingAddressNumber: $("#CC-checkoutAddressBook-addressNumber").val(), //Obrigatório
          shippingAddressDistrict: $("#CC-checkoutAddressBook-district").val(), //Obrigatório
          shippingAsBilling: true, //Endereço de entrega como endereço de cobrança | Obrigatório
          cartItems: JSON.stringify(cartItems),
          merchantDefinedFields: JSON.stringify([
            {
              Id: 1,
              Value: $('#CC-checkoutRegistration-email').val() || widget.user().email()
            },
            {
              Id: 2,
              Value: 121
            },
            {
              Id: 3,
              Value: 1
            },
            {
              Id: 4,
              Value: 'Web'
            },
            {
              Id: 6,
              Value: 1
            },
            {
              Id: 7,
              Value: 'Oracle Staging Store'
            },
            {
              Id: 9,
              Value: 'SIM'
            },
            {
              Id: 20,
              Value: 'ACEITA'
            },
            {
              Id: 21,
              Value: 0
            },
            {
              Id: 22,
              Value: '01-Berrini'
            },
            {
              Id: 24,
              Value: 121
            },
            {
              Id: 52,
              Value: 'Eletrônicos/Roupas e Acessórios'
            },
            {
              Id: 83,
              Value: 'Varejo'
            },
            {
              Id: 84,
              Value: 'Oracle'
            }
          ])
        }

        if ($("#CC-checkoutAddressBook-addressComplement").val() !== "")
          customProperties.shippingAddressComplement = $("#CC-checkoutAddressBook-addressComplement").val(); //Opcional

        if ($('#CC-checkoutAddressBook-useAsBillAddress').prop('checked') === false) {
          if ($("#CC-checkoutAddressBook-baddressNumber").val() !== "" && $("#CC-checkoutAddressBook-bdistrict").val() !== "") {
            customProperties.shippingAsBilling = false;
            customProperties.billingAddressNumber = $("#CC-checkoutAddressBook-baddressNumber").val();//Obrigatório se o endereço de cobrança for diferente do endereço de entrega
            customProperties.billingAddressDistrict = $("#CC-checkoutAddressBook-bdistrict").val(); //Obrigatório se o endereço de cobrança for diferente do endereço de entrega
          }
          else
            return false;

          if ($("#CC-checkoutAddressBook-baddressComplement").val() !== "")
            customProperties.billingAddressComplement = $("#CC-checkoutAddressBook-baddressComplement").val(); //Opcional se o endereço de cobrança for diferente do endereço de entrega e se houver complemento
        }

        //Get fingerprint id from user
        if (window.dataLayer)
          if (window.dataLayer[0].fingerprint_id)
            customProperties.browserFingerprint = window.dataLayer[0].fingerprint_id;

        customProperties.browserCookiesAccepted = navigator.cookieEnabled; //Checks if browser accept cookies
        customProperties.hostName = location.hostname; //Checks if website host name
        customProperties.browserType = navigator.appCodeName; //Checks browser name

        customProperties.dateOfBirth = $('#CC-checkoutRegistration-dateOfBirth').val();

        var savedCards = widget.user().dynamicProperties().find(function (e) { return e.id() == '_savedCards' });
        savedCards = (savedCards) ? savedCards.value() || [] : [];
        customProperties.securityCardProperties = JSON.stringify({ saveCard: false, haveCardToken: false });

        if (widget.user().loggedIn()) {
          if (this.saveCreditCard()) {
            customProperties.securityCardProperties = JSON.stringify({
              saveCard: true,
              haveCardToken: false,
              alias: ($('#save-credit-card-alias').val() === '') ? null : $('#save-credit-card-alias').val(),
              savedCards: savedCards
            });
          }
          else {
            if (this.tokenizedCard()) {
              customProperties.securityCardProperties = JSON.stringify({
                saveCard: false,
                haveCardToken: true,
                token: this.tokenizedCard().token,
                brand: this.tokenizedCard().brand,
                alias: (this.tokenizedCard().alias) ? this.tokenizedCard().alias : null,
                cvv: $('#saved_card_cvv').val(),
                savedCards: savedCards
              });
            }
          }
        }

        return true;
      },

      createCashOrder: function () {
        var widget = this;
        console.log("Tipo de pagamento: Cash");
        widget.selectedPaymentType("cash");
        widget.order().isCashPayment(true);
        if (this.setCustomFields("cash"))
          widget.order().handlePlaceOrder();
        else
          window.alert('Verifique se os campos de endereço, CPF e os dados de pagamento estão preenchidos !');
      },

      createCardOrder: function () {
        var widget = this;

        if ($("#debit_card_payment_type").attr("checked")) {
          console.log("Tipo de pagamento: Debit Card");
          widget.selectedPaymentType("debitCard");
          console.log(widget);
          if (this.setCustomFields("debitCard"))
            widget.order().handlePlaceOrder();
          else
            window.alert('Verifique se os campos de endereço, CPF e os dados de pagamento estão preenchidos !');
        }
        else if ($("#credit_card_payment_type").attr("checked")) {
          console.log("Tipo de pagamento: Credit Card");
          widget.selectedPaymentType("creditCard");
          console.log(widget);
          if (this.setCustomFields("creditCard"))
            widget.order().handlePlaceOrder();
          else
            window.alert('Verifique se os campos de endereço, CPF e os dados de pagamento estão preenchidos !');
        }
        else
          alert("Escolha debito ou credito para pagamento !")
      },

      showCardAlias: function () {
        $('.save-credit-card-alias').toggle();
        this.saveCreditCard(!this.saveCreditCard());
      },

      checkSavedCards: function (user) {
        var response = false;
        if (user.dynamicProperties().length !== 0)
          response = user.dynamicProperties().find(function (e) { return (e.id() === '_savedCards' && e.value()) });
        return (response) ? true : false;
      },

      populateUserSavedCards: function (dynamicProperties) {
        var cardList = [];
        if (dynamicProperties.length !== 0 && Array.isArray(dynamicProperties)) {
          var cards = dynamicProperties.find(function (e) { return e.id() === '_savedCards' && e.value() });
          if (cards)
            JSON.parse(cards.value()).forEach(function (card) { cardList.push(String().concat(card.lastDigits.substr(-4), "_", card.brand)); });
        }
        return cardList;
      },

      showCardDetails: function () {
        var widget = this;
        var selectedCreditCard = event.target;

        if (selectedCreditCard.value !== '') {
          var savedCards = widget.user().dynamicProperties().find(function (e) { return e.id() === "_savedCards" });

          if (savedCards)
            widget.tokenizedCard(
              JSON.parse(savedCards.value()).find(function (card) { return (String().concat(card.lastDigits.substr(-4), "_", card.brand) === selectedCreditCard.value) }) || widget.tokenizedCard()
            );

          $('#saved_card_details').show();
          $('#saved_card_cvv').show();

          if (widget.tokenizedCard().alias)
            $('#saved_card_alias').text('Alias: ' + widget.tokenizedCard().alias);

          $('#saved_card_brand').text('Bandeira: ' + widget.tokenizedCard().brand);
          $('#saved_card_last_digits').text('Últimos Dígitos: ' + widget.tokenizedCard().lastDigits);

        }
        else {
          $('#saved_card_details').hide();
          $('#saved_card_cvv').hide();
          $('#saved_card_alias').text('');
          $('#saved_card_brand').text('');
          $('#saved_card_last_digits').text('');
          $('#saved_card_cvv').val('');
        }
      }
    };
  }
);