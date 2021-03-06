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
    var customProperties;

    return {

      selectedPaymentType: ko.observable(),

      saveCreditCard: ko.observable(false),

      tokenizedCard: ko.observable(),

      onLoad: function (widget) {

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

        $.Topic(PubSub.topicNames.USER_PROFILE_UPDATE_SUBMIT).subscribe(function (msg, data) {
          console.log('SUBMIT');
          console.log('Mensagem: ');
          console.log(msg);
          console.log('Data: ');
          console.log(data);
        });

        $.Topic(PubSub.topicNames.USER_PROFILE_UPDATE_FAILURE).subscribe(function (msg, data) {
          console.log('FALHOU');
          console.log('Mensagem: ');
          console.log(msg);
          console.log('Data: ');
          console.log(data);
        });

        $.Topic(PubSub.topicNames.USER_PROFILE_UPDATE_SUCCESSFUL).subscribe(function (msg, data) {
          console.log('SUCESSO');
          console.log('Mensagem: ');
          console.log(msg);
          console.log('Data: ');
          console.log(data);
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
          paymentType: paymentType, //Obrigat??rio
          amount: widget.cart().amount(), //Obrigat??rio
          identityType: "CPF", //Obrigat??rio
          /*
          Crie o elemento no html do widget "Login - Checkout" caso n??o exista
          Elemento: 
            - CC-checkoutRegistration-identity
          Obs: 
            - Esse atributo deve ser passado no json mesmo se o usu??rio finalizar o checkout como guest ou usu??rio logado
          */
          identity: $("#CC-checkoutRegistration-identity").val(), //Obrigat??rio
          /*
            Crie esses elementos no html do widget "Custom Address Book" caso n??o existam 
            Elementos: 
              - CC-checkoutAddressBook-addressNumber, 
              - CC-checkoutAddressBook-district , 
              - CC-checkoutAddressBook-addressComplement
          */
          shippingAddressNumber: $("#CC-checkoutAddressBook-addressNumber").val(), //Obrigat??rio
          shippingAddressDistrict: $("#CC-checkoutAddressBook-district").val(), //Obrigat??rio
          shippingAsBilling: true //Endere??o de entrega como endere??o de cobran??a | Obrigat??rio
        }

        if ($("#CC-checkoutAddressBook-addressComplement").val() !== "")
          customProperties.shippingAddressComplement = $("#CC-checkoutAddressBook-addressComplement").val(); //Opcional

        /*
        Verifica se o endere??o de entrega ?? o mesmo de cobran??a, caso n??o seja, ser??o adicionadas novas propriedades nas 
        custom properties
        */
        if ($('#CC-checkoutAddressBook-useAsBillAddress').prop('checked') === false) {
          if ($("#CC-checkoutAddressBook-baddressNumber").val() !== "" && $("#CC-checkoutAddressBook-bdistrict").val() !== "") {
            /*
              Crie esses elementos no html do widget "Custom Address Book" caso n??o existam 
              Elementos: 
                - CC-checkoutAddressBook-baddressNumber, 
                - CC-checkoutAddressBook-bdistrict , 
                - CC-checkoutAddressBook-baddressComplement
            */
            customProperties.shippingAsBilling = false;
            customProperties.billingAddressNumber = $("#CC-checkoutAddressBook-baddressNumber").val();//Obrigat??rio se o endere??o de cobran??a for diferente do endere??o de entrega
            customProperties.billingAddressDistrict = $("#CC-checkoutAddressBook-bdistrict").val(); //Obrigat??rio se o endere??o de cobran??a for diferente do endere??o de entrega
          }
          else
            return false;

          if ($("#CC-checkoutAddressBook-baddressComplement").val() !== "")
            customProperties.billingAddressComplement = $("#CC-checkoutAddressBook-baddressComplement").val(); //Opcional se o endere??o de cobran??a for diferente do endere??o de entrega e se houver complemento
        }

        if (widget.user().loggedIn()){
          if (this.saveCreditCard() && $('#save-credit-card-alias').val() !== "") {
            customProperties.saveCard = true;
            customProperties.cardAlias = $('#save-credit-card-alias').val();
            customProperties.haveCardToken = false;
          }
          else {
            if (this.tokenizedCard()) {
              customProperties.saveCard = false;
              customProperties.cardAlias = this.tokenizedCard().alias;
              customProperties.haveCardToken = true;
              customProperties.token = this.tokenizedCard().token;
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
          window.alert('Verifique se os campos de endere??o, CPF e os dados de pagamento est??o preenchidos !');
      },

      createCardOrder: function () {
        var widget = this;

        if ($("#debit_card_payment_type").attr("checked")) {
          console.log("Tipo de pagamento: Debit Card");
          widget.selectedPaymentType("debitCard");
          if (this.setCustomFields("debitCard"))
            widget.order().handlePlaceOrder();
          else
            window.alert('Verifique se os campos de endere??o, CPF e os dados de pagamento est??o preenchidos !');
        }
        else if ($("#credit_card_payment_type").attr("checked")) {
          console.log("Tipo de pagamento: Credit Card");
          widget.selectedPaymentType("creditCard");
          if (this.setCustomFields("creditCard"))
            widget.order().handlePlaceOrder();
          else
            window.alert('Verifique se os campos de endere??o, CPF e os dados de pagamento est??o preenchidos !');
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
        if (user.dynamicProperties().length !== 0) {
          var dynamicProperties = user.dynamicProperties();
          dynamicProperties.forEach(function (e) {
            if (e.id() == 'savedCreditCard_0' || e.id() == 'savedCreditCard_1' || e.id() == 'savedCreditCard_2' || e.id() == 'savedCreditCard_3')
              if (e.value())
                response = true;
          });
        }
        return response;
      },

      populateUserSavedCards: function () {
        return ['Nubank', 'Itau'];
      },

      showCardDetails: function () {
        var dynamicProperties = this.user().dynamicProperties();
        var selectedCreditCard = event.target;
        this.tokenizedCard({ alias: selectedCreditCard.value });

        dynamicProperties.forEach(function (e) {
          if (e.id.includes('savedCreditCard')) {
            var card = JSON.parse(e.value);
            if (card.alias === this.tokenizedCard().alias)
              this.tokenizedCard(JSON.parse(e.value));
          }
        });

        $('#saved_card_alias').text('Alias: ' + this.tokenizedCard().alias);
        $('#saved_card_token').text('Token: ' + this.tokenizedCard().token);
        $('#saved_card_brand').text('Bandeira: ' + this.tokenizedCard().brand);
        $('#saved_card_last_digits').text('??ltimos D??gitos: ' + this.tokenizedCard().lastDigits);
      }
    };
  }
);