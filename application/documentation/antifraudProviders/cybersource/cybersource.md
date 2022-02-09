# Cybersource

## Fingerprint

Fingerprint é uma das tecnologias usadas pelo antifraude Cybersource que obtém os dados do dispositivo do cliente e envia para para Braspag auxiliando nas análises de fraude.

Ele deve ser implementado na página de chekout do seu site e quando o cliente finalizar uma compra, o **session_id** deve ser enviado ao gateway pelas custom properties do pedido.

Observações:

- O prefixo do session_id (ProviderMerchantId) não deve ser enviado concatenado com o identificador (BrowserFingerprint).
- BrowserFingerprint poderá ser qualquer valor ou o número do pedido, mas deverá ser único durante 48 horas.

```json
{
    "customProperties": {
        ...

        "browserFingerprint": "1565197719816",

        ...
    },
}
```

Para saber mais detalhes e implementar as tags que executam o script no device do cliente, acesse a documentação oficial: [Fingerprint](https://braspag.github.io//manual/antifraude#configura%C3%A7%C3%A3o-do-fingerprint)

---;

## Análise de fraude

Há duas formas de integrar o custom gateway com o provider Cybersource, a forma **¹Nativa**, aplicada somente quando o provider de pagamento for Braspag e a forma **²Standalone**, que pode ser utilizada com diferentes providers de pagamento, além da Braspag.

Se estiver utilizando os serviços da Braspag para pagamentos e também para análise de fraude, recomendamos que utilize a integração nativa. Caso esteja usando outro provedor de pagamento ou uma conexão direta com a adquirente e deseje utilizar o serviço antifraude API gateway da Braspag, utilize o modo de integração **Standalone**.

Nesta seção será descrito como realizar a integração standalone.

Para implementar a integração nativa, acesse a seção de pagamentos com análise de fraude no pdf de implementação do payment provider **Braspag**.

### **Custom Properties**

Pra conseguir utilizar corretamente a análise de fraude é necessário configurar o [fingerprint](#Fingerprint) no front-end da página de checkout.

**Obs: Se utilizado com o provedor de pagamentos Braspasg, todos os campos das configurações gerais devem ser enviados, inclusive os não obrigatórios**

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

----;

### **Gateway Settings**

```json
{
    "gatewaySettings": {
        ...

        "antifraudProviderName": "cybersource",
        "antifraudProviderMerchantId": "Braspag Merchant Id",
        "antifraudProviderId": "Antifraude client id",
        "antifraudProviderKey": "Antifraude client key",
        "antifraudProviderEndpoint": "https://risksandbox.braspag.com.br",
        "antifraudProviderAuthEndpoint": "https://authsandbox.braspag.com.br",
        "antifraudProviderFirstOperation": "analyze",
        "antifraudProviderSecondOperation": "authorize",
        "useAntiFraudAnalysis": true,

        ...
    },
}
```

| Chave   |      Descrição      | Obrigatório | Tipo | Observações |
|----------|:-------------------|:------------:|:------|:----------|
| antifraudProviderName |  Nome do provedor para análises de fraude | **Sim** | String | -
| antifraudProviderMerchantId | Credencial Merchant Id da loja vinculada ao antifraude informada pela Braspag | **Sim** | String | -
| antifraudProviderId | Credencial client_id informada pela Braspag   | **Sim** |   String | -
| antifraudProviderKey | Credencial client_secret informada pela Braspag | **Sim** |    String | -
| antifraudProviderEndpoint | URL da API do antifraude gateway para enviar as transações | **Sim** | String | -
| antifraudProviderAuthEndpoint | URL da API do antifraude gateway para realizar autenticação | **Sim** | String | -
| antifraudProviderFirstOperation | Primeira operação que o custom gateway deverá realizar | **Sim** | String | Somente os valores analyze ou authorize são permitidos
| antifraudProviderSecondOperation | Segunda operação que o custom gateway deverá realizar | **Sim** | String | Somente os valores analyze ou authorize são permitidos
| useAntiFraudAnalysis | Informa ao custom gateway se o lojista está utilizando pagamentos com análise de fraude | **Sim** | Boolean | -
----;

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
```

# Glossário

**1 - Nativa**: Modo de integração entre a API do gateway de pagamento Braspag e a API do antifraude gateway Braspag em que as operações são automatizadas e uma vez que a tansação for enviada a Braspag, será de responsabilidade dela realizar as duas operações (autorização e análise de fraude).

**2 - Standalone**: Modo de integração entre a API do gateway de pagamento Braspag e a API do antifraude gateway Braspag em que as operações são feitas de forma separada, o custom gateway irá processar cada operação de forma individual e sequêncial, ou seja, o processamento fica a cargo do custom gateway e não do provedor da Braspag.