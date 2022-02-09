# Braspag

## Serviços suportados:

+ **Pagamentos**
    + Cartão de Crédito
    + Cartão Tokenizado
    + Boleto
+ **Pagamentos com análise de fraude**


# Configurações Gerais

As configurações mostradas abaixo são de uso comum para qualquer um dos serviços suportados pelo custom gateway para o provider Braspag. É importante que os conceitos de **Gateway Settings, Gateway Extension e Custom Properties** estejam claros para que possa prosseguir com a configuração. 

Caso não tenha visto os conceitos citados acima, veja no pdf **Oracle Commerce Cloud - Custom Gateway Integration Overview**.

## Custom Properties

Envie-os em toda request feita na página de checkout para custom gateway

**Obs: Todos os campos das configurações gerais devem ser enviados quando houver integração com análise de fraude, inclusive os não obrigatórios**

```json
{
    "customProperties": {
        ...
        
        "dateOfBirth":"1992-02-27",
        "identityType": "CPF",
        "identity": "35462432821",
        "paymentType": "payment Type",
        "shippingAsBilling": true,
        "shippingAddressNumber":"Address Number",
        "billingAddressNumber":"Address Number",
        "shippingAddressComplement":"Address Complement",
        "billingAddressComplement":"Address Complement",
        "shippingAddressDistrict":"Address District",
        "billingAddressDistrict":"Address District",

        ...
    },
}
```

| Chave   |      Descrição      | Obrigatório | Tipo | Observações |
|----------|:-------------------|:-----------:|:-----|:--------------|
| dateOfBirth | Data de nascimento do cliente (YYYY-mm-dd) | **Não*** | String | Obrigatório somente para pagamentos com análise de fraude
| identityType | Tipo de documento de identificação do comprador (CPF ou CNPJ) | **Não*** | String | Obrigatório somente para pagamentos com análise de fraude ou pagamentos por boleto
| identity | Número do RG, CPF ou CNPJ do Cliente | **Não*** | String | Obrigatório somente para pagamentos com análise de fraude ou pagamentos por boleto
| paymentType | Tipo de pagamento | **Sim** | String | Somente os valores **creditCard** e **cash** são aceitos até o momento
| shippingAsBilling |	Usar informações do endereço de entrega como o endereço de cobrança | **Sim** | Boolean | Se for marcado como **false**, os campos com o prefixo **billing** serão utilizados para enviar os dados ao gateway de pagamento
| shippingAddressNumber |	Numero do endereço de entrega | **Sim** | String | -
| billingAddressNumber | Numero do endereço de cobrança | **Não** | String | -
| shippingAddressComplement |	Complemento do endereço de entrega | **Não** | String | -
| billingAddressComplement |	Complemento do endereço de cobrança | **Não** | String | -
| shippingAddressDistrict |	Bairro do endereço de entrega | **Sim** | String | -
| billingAddressDistrict |	Bairro do endereço de cobrança | **Não** | String | -
----

## Gateway Settings:

```json
{
    "gatewaySettings": {
        ...

        "paymentMethodTypes": "card,cash",
        "paymentProviderId": "Merchant Id",
        "paymentProviderKey": "Merchant Key",        
        "paymentProviderEndpoint": "https://apisandbox.braspag.com.br",
        "paymentProviderQueryEndpoint": "https://apiquerysandbox.braspag.com.br",
        "paymentProviderName": "braspag",
        "useAntiFraudAnalysis": false,

        ...
    },
}
```

| Chave   |      Descrição      | Obrigatório | Tipo | Observações |
|----------|:-------------------|:------------:|:------|:----------|
| paymentMethodTypes | Métodos de pagamento aceitos pelo custom gateway | **Sim** |   String | -
| paymentProviderId | Identificador da loja na Braspag | **Sim** |    String | -
| paymentProviderKey |	Chave Publica para Autenticação Dupla na Braspag | **Sim** |    String | -
| paymentProviderEndpoint | URL da API do gateway de pagamento para enviar as transações | **Sim** |    String | -
| paymentProviderQueryEndpoint | URL da API do gateway de pagamento para consultar as transações  | **Sim** |    String | -
| paymentProviderName | Nome do provedor de pagamento que o custom gateway irá utilizar | **Sim** |    String | -
| useAntiFraudAnalysis | Informa ao custom gateway se o lojista utiliza análise de fraude | **Sim** |    Boolean | -
----

## Gateway Extension

Como explicado no **Oracle Commerce Cloud - Custom Gateway Integration Overview** o config.json serve para dizer a plataforma quais serão as configurações do seu gateway (**gatewaySettings**). Para iniciar a configurar seu gateway, adicione o json abaixo ao arquivo config.json e na medida que formos avançando os tópicos e serviços, serão adicionadas novas informações nesse mesmo json para suportar os serviços utilizados.

```json
{
    "configType": "payment",
    "titleResourceId": "title",
    "descriptionResourceId": "description",
    "instances": [
        {
            "id": "agent",
            "instanceName": "agent",
            "labelResourceId": "agentInstanceLabel"
        },
        {
            "id": "preview",
            "instanceName": "preview",
            "labelResourceId": "previewInstanceLabel"
        },
        {
            "id": "storefront",
            "instanceName": "storefront",
            "labelResourceId": "storefrontInstanceLabel"
        }
    ],
    "properties": [
        {
          ...
        },
        {
            "id": "paymentMethodTypes",
            "type": "multiSelectOptionType",
            "name": "paymentMethodTypes",
            "helpTextResourceId": "paymentMethodsHelpText",
            "labelResourceId": "paymentMethodsLabel",
            "displayAsCheckboxes": true,
            "defaultValue": "card",
            "options": [
                {
                    "id": "card",
                    "value": "card",
                    "labelResourceId": "cardLabel"
                },
                {
                    "id": "cash",
                    "value": "cash",
                    "labelResourceId": "cashLabel"
                }
            ],
            "required": true
        },     
        {
            "id": "paymentProviderId",
            "type": "stringType",
            "name": "paymentProviderId",
            "helpTextResourceId": "paymentProviderIdHelpText",
            "labelResourceId": "paymentProviderIdLabel",
            "defaultValue": "",
            "required": true
        },
        {
            "id": "paymentProviderKey",
            "type": "stringType",
            "name": "paymentProviderKey",
            "helpTextResourceId": "paymentProviderKeyHelpText",
            "labelResourceId": "paymentProviderKeyLabel",
            "defaultValue": "",
            "required": true
        },
        {
            "id": "paymentProviderEndpoint",
            "type": "stringType",
            "name": "paymentProviderEndpoint",
            "helpTextResourceId": "paymentProviderEndpointHelpText",
            "labelResourceId": "paymentProviderEndpointLabel",
            "defaultValue": "",
            "required": true
        },
        {
            "id": "paymentProviderQueryEndpoint",
            "type": "stringType",
            "name": "paymentProviderQueryEndpoint",
            "helpTextResourceId": "paymentProviderQueryEndpointHelpText",
            "labelResourceId": "paymentProviderQueryEndpointLabel",
            "defaultValue": "",
            "required": true
        },        
        {
            "id": "paymentProviderName",
            "type": "optionType",
            "name": "paymentProviderName",
            "helpTextResourceId": "paymentProviderNameHelpText",
            "labelResourceId": "paymentProviderNameLabel",
            "defaultValue": "",
            "options": [
                {
                    "id": "braspag",
                    "value": "braspag",
                    "labelResourceId": "braspagLabel"
                }
            ],
            "required": true
        },
        {
            "id": "useAntiFraudAnalysis",
            "type": "booleanType",
            "name": "useAntiFraudAnalysis",
            "helpTextResourceId": "useAntiFraudAnalysisHelpText",
            "labelResourceId": "useAntiFraudAnalysisLabel",
            "defaultValue": false
        }
    ]
}
```

# Pagamentos

## Cartão de Crédito

Pagamentos por cartão de crédito podem ser feitos de duas formas: Sem análise de fraude ou com análise de fraude, sendo a última disponível em dois modos: **¹Nativa** e **²Standalone**.

Nesta seção será descrito como configurar seu gateway para suportar pagamentos sem análise de fraude.

Para utilizar a integração **Nativa**, veja a seção: [Pagamentos com análise de fraude](#Pagamentos-com-an%C3%A1lise-de-fraude).

Para utilizar a integração **Standalone**, veja no pdf de implementação do antifraude provider **Cybersource** como configurar o antifraude corretamente.

### **Custom Properties**

```json
{
    "customProperties": {
        ...
        "paymentInstallments": "1",
        "saveCard":false,
        ...
    },
}
```

| Chave   |      Descrição      | Obrigatório | Tipo | Observações |
|----------|:-------------------|:-----------:|:-----|:--------------|
| paymentInstallments | Informa ao gateway o numero de parcelas | **Não** | String | Se não for enviado, por padrão o valor será 1
| saveCard | Informa ao gateway se o cartão será tokenizado | **Sim** | Boolean | Por padrão o valor é **false**
----

### **Gateway Settings**

```json
{
    "gatewaySettings": {
        ...

        "creditCardProvider": "Provider name",    
        "automaticCapture": false,

        ...
    },
}
```

| Chave   |      Descrição      | Obrigatório | Tipo | Observações |
|----------|:-------------------|:------------:|:------|:----------|
| creditCardProvider |  Nome do provedor do meio de pagamento | **Sim** | String | -
| automaticCapture | Opção fornecida ao lojista para ativar a captura automática das transações autorizadas com sucesso | **Sim** |    Boolean | Esse campo somente será usado quando o gateway não utilizar análise de fraude (useAntiFraudAnalysis = false). Se o lojista desejar a captura automática com análise de fraude, verificar na seção de [pagamentos com análise de fraude](#Pagamentos-com-an%C3%A1lise-de-fraude) para configurá-la.
----

### **Gateway Extension**
Adicione o json abaixo dentro do nó **properties** no config.json do gateway extension

```json

{
    "id": "creditCardProvider",
    "type": "optionType",
    "name": "creditCardProvider",
    "helpTextResourceId": "creditCardProviderHelpText",
    "labelResourceId": "creditCardProviderLabel",
    "defaultValue": "Simulado",
    "options": [
        {
            "id": "Simulado",
            "value": "Simulado",
            "labelResourceId": "SimuladoLabel"
        },
        {
            "id": "Cielo30",
            "value": "Cielo30",
            "labelResourceId": "Cielo30Label"
        },
        {
            "id": "Redecard",
            "value": "Redecard",
            "labelResourceId": "RedecardLabel"
        },
        {
            "id": "Rede2",
            "value": "Rede2",
            "labelResourceId": "RedeLabel"
        },
        {
            "id": "Getnet",
            "value": "Getnet",
            "labelResourceId": "GetnetLabel"
        }
    ],
    "required": true
},
{
    "id": "automaticCapture",
    "type": "booleanType",
    "name": "automaticCapture",
    "helpTextResourceId": "automaticCaptureHelpText",
    "labelResourceId": "automaticCaptureLabel",
    "defaultValue": false
}
```
----

## Cartão de Crédito tokenizado

Por padrão, a Oracle Commerce Cloud possui um shopper profile type que fornece um template informando cada propriedade que um shopper terá ao se cadastrar em sua loja, como data de aniversário, nome, telefone e etc. Para utilizar o serviço de pagamento com cartões salvos pelo provider Braspag é necessário criar algumas propriedades adicionais no shopper profile type utilizando a REST API da plataforma Oracle Commerce Cloud. 

As propriedades adicionais inseridas no shopper profile type serão responsáveis por armazenar os dados do cartão tokenizado posteriormente serializados no shopper profile pelo custom gateway.

Recomendamos utilizar essas configurações para os campos que armazenarão o cartão tokenizado serializado:

Observações:
- A quantidade de propriedades poderá variar, o lojista decidirá quantos cartões cada shopper poderá salvar

```json
{
    "properties": {
        "savedCreditCardProperty_0": {
            "label": "Cartão tokenizado 1",
            "type": "richText",
            "uiEditorType": "richText",
            "internalOnly": false,
            "audienceVisibility": "all"
        },
        "savedCreditCardProperty_1": {
            "label": "Cartão tokenizado 2",
            "type": "richText",
            "uiEditorType": "richText",
            "internalOnly": false,
            "audienceVisibility": "all"
        },
      ...
    }
}
```
Para mais informações sobre shopper profile type, acesse: [Oracle Commerce Cloud - Shopper Profile Type](https://docs.oracle.com/cd/E89191_01/Cloud.17-4/ExtendingCC/html/s0405settableattributesofshoppertypep01.html)

Para informações mais detalhadas sobre o serviço, visite: [Braspag API - Salvando e Reutilizando cartões](https://braspag.github.io//manual/braspag-pagador?json#salvando-e-reutilizando-cart%C3%B5es)

----

### **Custom Properties**

Observações:
- Quando um o shopper desejar atualizar ou trocar um cartão já tokenizado por outro, o nome da propriedade que contém o cartão salvo a ser atualizado deve ser enviado no campo **savedCardPropertyIndex** nas customProperties do pedido.


#### Salvar ou atualizar cartão
```json
{
    ....

    "customProperties": {
        ...     
        "saveCard":true,
        "haveCardToken": false,
        "savedCardPropertyIndex":"savedCreditCardProperty_0",
        "cardAlias":"Apelido",

        ...
    },

    ....
}
```

#### Pagar com cartão salvo
```json
{
    ....

    "customProperties": {
        ...     
        "saveCard":false,
        "haveCardToken": true,
        "savedCardPropertyIndex":"savedCreditCardProperty_0",
        "cardCvv":"354",
        "cardBrand":"Master",
        "cardAlias":"Apelido",
        "cardToken":"250e7c7c-5501-4a7c-aa42-a33d7ad61167",

        ...
    },

    ....
}
```

| Chave   |      Descrição      | Obrigatório | Tipo | Observações |
|----------|:-------------------|:-----------:|:-----|:--------------|
| saveCard | Informa ao gateway se o cartão será tokenizado | **Sim** | Boolean | Por padrão o valor é **false**
| haveCardToken | Informa ao gateway que o pagamento será feito usando um cartão tokenizado | **Sim** | String | -
| savedCardPropertyIndex | Informa ao gateway em qual atributo do shopper profile será salva ou atualizada as informações do cartão tokenizado | **Sim** | String | -
| cardCvv | Informa ao gateway o código de verificação do cartão tokenizado | **Sim** | String | -
| cardBrand | Informa ao gateway a bandeira do cartão tokenizado | **Sim** | String | -
| cardAlias | Informa ao gateway se a transação será feita usando o alias ou o token do cartão tokenizado | **Não** | String | Pagar com cartão tokenizado: Enviar somente se o cartão tokenizado possuir alias. Salvar cartão: Enviar se desejar apelidar o cartão tokenizado
| cardToken | Informa ao gateway o token do cartão tokenizado | **Sim** | String | Se o cartão tokenizado possuir alias, o envio desse campo torna-se opcional
----

## Boleto

Documentação oficial: [Braspag API - Pagamentos por Boleto](https://braspag.github.io//manual/braspag-pagador?json#boletos)


Observações:
- O custom gateway não envia informações que podem sobrescrever os dados que foram registrados durante o cadastro da loja na Braspag, é de grande importância que a loja esteja totalmente configurada. Os únicos campos que o custom gateway enviará serão os campos customizados de cada provider.
- A captura ou cancelamento do boleto será feita pela Braspag, nesse caso o custom gateway somente será responsável por atualizar a Oracle Commerce Cloud com o status do pedido corretamente.

### **Custom Properties**

**Obs: Os campos "identity" e "identityType" das configurações gerais devem ser enviados obrigatoriamente para pagamentos por boleto**

```json
{
    "customProperties": {
        ...

        "paymentType": "cash",

        ...
    },
}
```

| Chave   |      Descrição      | Obrigatório | Tipo | Observações |
|----------|:-------------------|:-----------:|:-----|:--------------|
| paymentType | Tipo de pagamento | **Sim** | String | -
----

### **Gateway Settings**

Para pegamentos do tipo Boleto funcionem, verifique se os campos abaixo estão sendo enviados corretamente ao custom gateway.


```json
{
    "gatewaySettings": {
        ...

        "cashProvider": "Simulado",
        "cashProvidersCustomFields": "",
        "FineAmount": null,
        "NullifyDays": null,
        "InterestAmount": null,
        "FineRate": null,
        "DaysToInterest": null,
        "DaysToFine": null,
        "InterestRate": null,

        ...
    },
}
```

| Chave   |      Descrição      | Obrigatório | Tipo | Observações |
|----------|:-------------------|:------------:|:------|:----------|
| cashProvider |  Nome do provedor do meio de pagamento | **Sim** | String | -
| cashProvidersCustomFields | Lista dos campos customizados usados pelo lojista e que são aceitos pelo provedor de pagamentos por Boleto | **Sim** | String | Caso nenhum campo seja usado, deverá ser enviado em branco como segue no json acima de exemplo
| FineAmount | Valor da multa após o vencimento em valor absoluto em centavos. Não enviar se utilizar FineRate. Ex: 1000 = R$ 10,00 | **Sim** | String | Somente para o provider Bradesco2.
| NullifyDays |  Prazo para baixa automática do boleto. O cancelamento automático do boleto acontecerá após o número de dias estabelecido neste campo contado a partir da data do vencimento. Ex.: um boleto com vencimento para 15/12 que tenha em seu registro o prazo para baixa de 5 dias, poderá ser pago até 20/12, após esta data o título é cancelado | **Sim** | String | Recurso válido somente para boletos registrados do Banco Santander.
| InterestAmount | Valor absoluto de juros diário após o vencimento em centavos. Não enviar se utilizar InterestRate. Ex: 1000 = R$ 10,00 | **Sim** | String | Somente para o provider Bradesco2.
| FineRate | Somente para provider Bradesco2. Valor da multa após o vencimento em percentual, com base no valor do boleto (%). Permitido decimal com até 5 casas decimais. Não enviar se utilizar FineAmount. Ex: 10.12345 = 10.12345% | **Sim** | String | Somente para o provider Bradesco2.
| DaysToInterest | Quantidade de dias após o vencimento para iniciar a cobrança de juros por dia sobre o valor do boleto, em número inteiro. Ex: 3 | **Sim** | String | Somente para provider Bradesco2
| DaysToFine | Quantidade de dias após o vencimento para cobrar o valor da multa, em número inteiro. Ex: 3 | **Sim** | String | Somente para provider Bradesco2
| InterestRate | Valor de juros mensal após o vencimento em percentual, com base no valor do boleto (%). O valor de juros é cobrado proporcionalmente por dia (Mensal dividido por 30). Permitido decimal com até 5 casas decimais. Não enviar se utilizar InterestAmount. Ex: 10.12345 | **Sim** | String | Somente para provider Bradesco2
------

### **Gateway Extension**
Adicione o json abaixo dentro do nó **properties** no config.json do gateway extension

```json
{
    "id": "cashProvider",
    "type": "optionType",
    "name": "cashProvider",
    "helpTextResourceId": "cashProviderHelpText",
    "labelResourceId": "cashProviderLabel",
    "defaultValue": "Simulado",
    "options": [
        {
            "id": "cashSimulado",
            "value": "Simulado",
            "labelResourceId": "cashSimuladoLabel"
        },
        {
            "id": "bradesco",
            "value": "Bradesco2",
            "labelResourceId": "bradescoLabel"
        },
        {
            "id": "bancoDoBrasil",
            "value": "BancoDoBrasil2",
            "labelResourceId": "bancoDoBrasilLabel"
        },
        {
            "id": "santander",
            "value": "Santander2",
            "labelResourceId": "santanderLabel"
        },
        {
            "id": "caixa",
            "value": "Caixa2",
            "labelResourceId": "caixaLabel"
        }
    ],
    "required": true
},
{
    "id": "cashProvidersCustomFields",
    "type": "multiSelectOptionType",
    "name": "cashProvidersCustomFields",
    "helpTextResourceId": "cashProvidersCustomFieldsHelpText",
    "labelResourceId": "cashProvidersCustomFieldsLabel",
    "displayAsCheckboxes": true,
    "options": [
        {
            "id": "nullifyDaysOptions",
            "value": "NullifyDays",
            "helpTextResourceId": "santanderCustomFieldsHelpText",
            "labelResourceId": "nullifyDaysOptionsLabel"
        },
        {
            "id": "daysToFineOptions",
            "value": "DaysToFine",
            "helpTextResourceId": "bradescoCustomFieldsHelpText",
            "labelResourceId": "daysToFineOptionsLabel"
        },
        {
            "id": "fineRateOptions",
            "value": "FineRate",
            "helpTextResourceId": "bradescoCustomFieldsHelpText",
            "labelResourceId": "fineRateOptionsLabel"
        },
        {
            "id": "fineAmountOptions",
            "value": "FineAmount",
            "helpTextResourceId": "bradescoCustomFieldsHelpText",
            "labelResourceId": "fineAmountOptionsLabel"
        },
        {
            "id": "daysToInterestOptions",
            "value": "DaysToInterest",
            "helpTextResourceId": "bradescoCustomFieldsHelpText",
            "labelResourceId": "daysToInterestOptionsLabel"
        },
        {
            "id": "interestRateOptions",
            "value": "InterestRate",
            "helpTextResourceId": "bradescoCustomFieldsHelpText",
            "labelResourceId": "interestRateOptionsLabel"
        },
        {
            "id": "interestAmountOptions",
            "value": "InterestAmount",
            "helpTextResourceId": "bradescoCustomFieldsHelpText",
            "labelResourceId": "interestAmountOptionsLabel"
        }
    ],
    "required": false
},
{
    "id": "NullifyDays",
    "type": "stringType",
    "pattern": "^[1-9][0-9]?$|^99$",
    "name": "NullifyDays",
    "helpTextResourceId": "santanderCustomFieldsHelpText",
    "labelResourceId": "nullifyDaysLabel",
    "required": false
},
{
    "id": "DaysToFine",
    "type": "stringType",
    "name": "DaysToFine",
    "helpTextResourceId": "bradescoCustomFieldsHelpText",
    "labelResourceId": "daysToFineLabel",
    "required": false
},
{
    "id": "FineRate",
    "type": "stringType",
    "name": "FineRate",
    "helpTextResourceId": "bradescoCustomFieldsHelpText",
    "labelResourceId": "fineRateLabel",
    "required": false
},
{
    "id": "FineAmount",
    "type": "stringType",
    "name": "FineAmount",
    "helpTextResourceId": "bradescoCustomFieldsHelpText",
    "labelResourceId": "fineAmountLabel",
    "required": false
},
{
    "id": "DaysToInterest",
    "type": "stringType",
    "name": "DaysToInterest",
    "helpTextResourceId": "bradescoCustomFieldsHelpText",
    "labelResourceId": "daysToInterestLabel",
    "required": false
},
{
    "id": "InterestRate",
    "type": "stringType",
    "name": "InterestRate",
    "helpTextResourceId": "bradescoCustomFieldsHelpText",
    "labelResourceId": "interestRateLabel",
    "required": false
},
{
    "id": "InterestAmount",
    "type": "stringType",
    "name": "InterestAmount",
    "helpTextResourceId": "bradescoCustomFieldsHelpText",
    "labelResourceId": "interestAmountLabel",
    "required": false
}
```
-----

# Pagamentos com análise de fraude

Além de pagamentos convencionais, o provider Braspag fornece a possibilidade de realizar análises de fraude em pagamentos por cartão de crédito utilizando o antifraude API gateway, que até o momento é integrado com o sistema Cybersource. 

Há duas formas de integrar o custom gateway com o provider Cybersource, a forma **¹Nativa**, aplicada somente quando o provider de pagamento for Braspag e a forma **²Standalone**, que pode ser utilizada com diferentes providers de pagamento, além da Braspag.

Se estiver utilizando os serviços da Braspag para pagamentos e também para análise de fraude, recomendamos que utilize a integração nativa. Caso esteja usando outro provedor de pagamento ou uma conexão direta com a adquirente e deseje utilizar o serviço antifraude API gateway da Braspag, veja no pdf de implementação do antifraude provider **Cybersource** como configurar o antifraude corretamente em modo **²Standalone**.

Nesta seção será descrito como realizar a integração **nativa**.

### **Custom Properties**

Pra conseguir utilizar corretamente a análise de fraude é necessário configurar o fingerprint no front-end da página de checkout, para saber mais detalhes, veja a seção do fingerprint na documentação do provider Cybersource como configurá-lo detalhadamente.

**Obs: Todos os campos das configurações gerais devem ser enviados, inclusive os não obrigatórios**

```json
{
    "customProperties": {
        ...

        "browserCookiesAccepted": true,
        "browserFingerprint": "1565197719816",
        "browserType": "Mozilla",
        "hostName": "ccadmin-z9ta.oracleoutsourcing.com",
        "cartItems": "[{\"productId\":\"PB-001\",\"quantity\":2,\"repositoryId\":\"ci3001993\",\"availabilityDate\":null,\"catRefId\":\"PB-001-SKU-01\",\"expanded\":false,\"stockStatus\":true,\"stockState\":\"IN_STOCK\",\"orderableQuantityMessage\":\"\",\"commerceItemQuantity\":2,\"orderableQuantity\":10000,\"selectedOptions\":[],\"selectedSkuProperties\":[],\"discountInfo\":[],\"rawTotalPrice\":6400,\"detailedItemPriceInfo\":[{\"discounted\":false,\"secondaryCurrencyTaxAmount\":0,\"amount\":5000,\"quantity\":2,\"tax\":0,\"orderDiscountShare\":0,\"detailedUnitPrice\":2500,\"currencyCode\":\"BRL\"}],\"externalData\":[],\"addOnItem\":false,\"displayName\":\"Samsung Galaxy S9\",\"invalid\":false,\"commerceItemId\":\"ci3001981\",\"priceListGroupId\":\"default-BRL\",\"giftWithPurchaseCommerceItemMarkers\":[],\"price\":5000},{\"productId\":\"242342\",\"quantity\":2,\"repositoryId\":\"ci3001994\",\"availabilityDate\":null,\"catRefId\":\"sku42\",\"expanded\":false,\"stockStatus\":true,\"stockState\":\"IN_STOCK\",\"orderableQuantityMessage\":\"\",\"commerceItemQuantity\":2,\"orderableQuantity\":10,\"selectedOptions\":[{\"optionName\":\"color\",\"optionValue\":\"green\"},{\"optionName\":\"size\",\"optionValue\":\"M\"}],\"selectedSkuProperties\":[],\"discountInfo\":[],\"rawTotalPrice\":100,\"detailedItemPriceInfo\":[{\"discounted\":false,\"secondaryCurrencyTaxAmount\":0,\"amount\":60,\"quantity\":2,\"tax\":0,\"orderDiscountShare\":0,\"detailedUnitPrice\":30,\"currencyCode\":\"BRL\"}],\"externalData\":[],\"addOnItem\":false,\"displayName\":\"ProdTeste\",\"invalid\":false,\"commerceItemId\":\"ci3001984\",\"priceListGroupId\":\"default-BRL\",\"giftWithPurchaseCommerceItemMarkers\":[],\"price\":60}]",
        "merchantDefinedFields": [
            {
                "Id":1,
                "Value":"value"
            },
            {  
                "Id":2,
                "Value":121
            },
            ...
        ]
        ...
    },
}
```

| Chave   |      Descrição      | Obrigatório | Tipo | Observações |
|----------|:-------------------|:-----------:|:-----|:--------------|
| browserCookiesAccepted | Informa ao provedor se o device do cliente aceita cookies | **Sim** | Boolean | -
| browserFingerprint | Código utilizado para auxiliar na análise da transação | **Sim** | String | -
| browserType | Tipo de browser do cliente | **Sim** | String | -
| hostName | Domínio do site onde a compra foi efetuada | **Sim** | String | -
| cartItems | Itens do carrinho | **Sim** | String | -
| merchantDefinedFields | Array contendo campos definidos pelo comerciante | **Sim** | Array | Para saber com maiores detalhes quais campos devem ser enviados, acesse [Braspag API - MDDs](https://braspag.github.io/manual/braspag-pagador#tabela-de-mdds)

----

### **Gateway Settings**

```json
{
    "gatewaySettings": {
        ...

        "antifraudName": "cybersource",
        "antifraudId": "Antifraude client id",
        "antifraudKey": "Antifraude client key",
        "antifraudEndpoint": "https://risksandbox.braspag.com.br",
        "antifraudAuthEndpoint": "https://authsandbox.braspag.com.br",
        "antifraudMerchantId": "Braspag Merchant Id",
        "firstOperation": "analyze",
        "secondOperation": "authorize",
        "antifraudSequenceCriteria": "OnSuccess",
        "antifraudCaptureOnLowRisk": false,
        "antifraudVoidOnHighRisk": false,
        "useAntiFraudAnalysis": true,
        "useNativeIntegration": true,

        ...
    },
}
```

| Chave   |      Descrição      | Obrigatório | Tipo | Observações |
|----------|:-------------------|:------------:|:------|:----------|
| antifraudName |  Nome do provedor para análises de fraude | **Sim** | String | -
| antifraudId | Credencial client_id informada pela Braspag   | **Sim** |   String | -
| antifraudKey | Credencial client_secret informada pela Braspag | **Sim** |    String | -
| paymentProviderKey |	Chave Publica para Autenticação Dupla na Braspag | **Sim** |    String | -
| antifraudEndpoint | URL da API do antifraude gateway para enviar as transações | **Sim** | String | -
| antifraudAuthEndpoint | URL da API do antifraude gateway para realizar autenticação | **Sim** | String | -
| antifraudMerchantId | Credencial Merchant Id da loja vinculada ao antifraude informada pela Braspag | **Sim** | String | -
| firstOperation | Primeira operação que o custom gateway deverá realizar | **Sim** | String | Somente os valores analyze ou authorize são permitidos
| secondOperation | Segunda operação que o custom gateway deverá realizar | **Sim** | String | Somente os valores analyze ou authorize são permitidos
| antifraudSequenceCriteria | Opção fornecida ao lojista para escolher quando a segunda operação deverá ser feita | **Sim** | String | Somente os valores OnSuccess e Always são aceitos. Para mais informações, acesse [Braspag API - Pagamentos com análise de fraude](https://braspag.github.io//manual/braspag-pagador?json#pagamentos-com-an%C3%A1lise-de-fraude)
| antifraudCaptureOnLowRisk | Opção fornecida ao lojista para capturar a transação automaticamente quando o antifraude retornar uma análise de baixo risco | **Sim** | Boolean | Para mais informações, acesse [Braspag API - Pagamentos com análise de fraude](https://braspag.github.io//manual/braspag-pagador?json#pagamentos-com-an%C3%A1lise-de-fraude)
| antifraudVoidOnHighRisk | Opção fornecida ao lojista para cancelar/estornar a transação automaticamente quando o antifraude retornar uma análise de alto risco | **Sim** | Boolean | Para mais informações, acesse [Braspag API - Pagamentos com análise de fraude](https://braspag.github.io//manual/braspag-pagador?json#pagamentos-com-an%C3%A1lise-de-fraude)
| useAntiFraudAnalysis | Informa ao custom gateway se o lojista está utilizando pagamentos com análise de fraude | **Sim** | Boolean | -
| useNativeIntegration | Informa ao custom gateway que o lojista está usando a modo de integração **nativa** | **Sim** | Boolean | -
----

### **Gateway Extension**
Adicione o json abaixo dentro do nó **properties** no config.json do gateway extension

```json

{
    "id": "antifraudName",
    "type": "optionType",
    "name": "antifraudName",
    "helpTextResourceId": "antifraudNameHelpText",
    "labelResourceId": "antifraudNameLabel",
    "defaultValue": "",
    "options": [
        {
            "id": "cybersource",
            "value": "cybersource",
            "labelResourceId": "braspagAntifraudLabel"
        }
    ],
    "required": true
},
{
    "id": "antifraudId",
    "type": "stringType",
    "name": "antifraudId",
    "helpTextResourceId": "antifraudIdHelpText",
    "labelResourceId": "antifraudIdLabel",
    "defaultValue": "",
    "required": true
},
{
    "id": "antifraudKey",
    "type": "stringType",
    "name": "antifraudKey",
    "helpTextResourceId": "antifraudKeyHelpText",
    "labelResourceId": "antifraudKeyLabel",
    "defaultValue": "",
    "required": true
},
{
    "id": "antifraudEndpoint",
    "type": "stringType",
    "name": "antifraudEndpoint",
    "helpTextResourceId": "antifraudEndpointHelpText",
    "labelResourceId": "antifraudEndpointLabel",
    "defaultValue": "",
    "required": true
},
{
    "id": "antifraudAuthEndpoint",
    "type": "stringType",
    "name": "antifraudAuthEndpoint",
    "helpTextResourceId": "antifraudAuthEndpointHelpText",
    "labelResourceId": "antifraudAuthEndpointLabel",
    "defaultValue": "",
    "required": true
},
{
    "id": "antifraudMerchantId",
    "type": "stringType",
    "name": "antifraudMerchantId",
    "helpTextResourceId": "antifraudMerchantIdHelpText",
    "labelResourceId": "antifraudMerchantIdLabel",
    "defaultValue": "",
    "required": true
},
{
    "id": "firstOperation",
    "type": "optionType",
    "name": "firstOperation",
    "helpTextResourceId": "firstOperationHelpText",
    "labelResourceId": "firstOperationLabel",
    "defaultValue": "",
    "options": [
        {
            "id": "analyze",
            "value": "analyze",
            "labelResourceId": "analyzeLabel"
        },
        {
            "id": "authorize",
            "value": "authorize",
            "labelResourceId": "authorizeLabel"
        }
    ],
    "required": true
},
{
    "id": "secondOperation",
    "type": "optionType",
    "name": "secondOperation",
    "helpTextResourceId": "secondOperationHelpText",
    "labelResourceId": "secondOperationLabel",
    "defaultValue": "",
    "options": [
        {
            "id": "analyze",
            "value": "analyze",
            "labelResourceId": "analyzeLabel"
        },
        {
            "id": "authorize",
            "value": "authorize",
            "labelResourceId": "authorizeLabel"
        }
    ],
    "required": true
},
{
    "id": "antifraudSequenceCriteria",
    "type": "optionType",
    "name": "antifraudSequenceCriteria",
    "helpTextResourceId": "antifraudSequenceCriteriaHelpText",
    "labelResourceId": "antifraudSequenceCriteriaLabel",
    "options": [
        {
            "id": "always",
            "value": "Always",
            "labelResourceId": "AlwaysLabel"
        },
        {
            "id": "onSuccess",
            "value": "OnSuccess",
            "labelResourceId": "OnSuccessLabel"
        }
    ],
    "required": true
},
{
    "id": "antifraudCaptureOnLowRisk",
    "type": "booleanType",
    "name": "antifraudCaptureOnLowRisk",
    "helpTextResourceId": "antifraudCaptureOnLowRiskHelpText",
    "labelResourceId": "antifraudCaptureOnLowRiskLabel",
    "defaultValue": false
},
{
    "id": "antifraudVoidOnHighRisk",
    "type": "booleanType",
    "name": "antifraudVoidOnHighRisk",
    "helpTextResourceId": "antifraudVoidOnHighRiskHelpText",
    "labelResourceId": "antifraudVoidOnHighRiskLabel",
    "defaultValue": false
}
{
    "id": "useNativeIntegration",
    "type": "booleanType",
    "name": "useNativeIntegration",
    "helpTextResourceId": "useNativeIntegrationHelpText",
    "labelResourceId": "useNativeIntegrationLabel",
    "defaultValue": false
}
```

# Glossário
**1 - Nativa**: Modo de integração entre a API do gateway de pagamento Braspag e a API do antifraude gateway Braspag em que as operações são automatizadas e uma vez que a tansação for enviada a Braspag, será de responsabilidade dela realizar as duas operações (autorização e análise de fraude).

**2 - Standalone**: Modo de integração entre a API do gateway de pagamento Braspag e a API do antifraude gateway Braspag em que as operações são feitas de forma separada, o custom gateway irá processar cada operação de forma individual e sequêncial, ou seja, o processamento fica a cargo do custom gateway e não do provedor da Braspag.

-----