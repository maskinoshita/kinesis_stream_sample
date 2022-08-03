'use strict';

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB({maxRetries: 5, retryDelayOptions: {base: 100}});
const comprehend = new AWS.Comprehend({maxRetries: 5, retryDelayOptions: {base: 100}});

const SCORE_PATTERN = {
  'POSITIVE': 'Positive',
  'NEGATIVE': 'Negative',
  'NEUTRAL': 'Neutral',
  'MIXED': 'Mixed'
};

const WEBSOCKET_ENDPOINT = process.env.WEBSOCKET_ENDPOINT;
const MANAGEMENT_ENDPOINT = WEBSOCKET_ENDPOINT.replace('wss', 'https');
const CONNECTION_TABLE_NAME = process.env.CONNECTION_TABLE_NAME;

const analyze = async (records) => {
  let tweets = [];
  records.forEach(record => {
    tweets.push(Buffer.from(record.kinesis.data, 'base64').toString('utf8'));
  });

  const comprehendParams = {
    LanguageCode: 'ja',
    TextList: tweets
  };

  const results = await comprehend.batchDetectSentiment(comprehendParams).promise();
  let sentiments = [];
  if(results) {
    for (let result of results.ResultList) {
      let elem = {
        tweet: tweets[result.Index],
        sentiment: SCORE_PATTERN[result.Sentiment],
        scores: result.SentimentScore
      };
      sentiments.push(elem);
    }
  }
  return sentiments;
}

class ConnectionGoneError extends Error {
  constructor(err, connectionId) {
    super(err.message);
    this.name = "ConnectionGoneError";
    this.statusCode = err.statusCode;
    this.connectionId = connectionId;
  }
}

const sendMessageToClient = (url, connectionId, payload) => {
  return new Promise((resolve, reject) => {
    const apigatewayManagementApi = new AWS.ApiGatewayManagementApi({
      apiVersion: '2018-11-29',
      endpoint: url
    });
    apigatewayManagementApi.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(payload)
    }, (err, data) => {
      if (err) {
        reject((err.statusCode === 410)? new ConnectionGoneError(err, connectionId) : err);
      }
      resolve(data);
    });
  });
};

const subscribe = async (event) => {
  try {
    const payload = await analyze(event.Records);
    // push to client
    let connectionData = await dynamodb.scan({ TableName: CONNECTION_TABLE_NAME, ProjectionExpression: 'connectionId' }).promise();
    let promises = [];
    let deletePromises = [];
    connectionData.Items.map(async (item) => {
      promises.push(sendMessageToClient(MANAGEMENT_ENDPOINT, item.connectionId.S, payload));
    });
    try {
      await Promise.all(promises);
    } catch (err) {
      if (err instanceof ConnectionGoneError) {
        const deleteParams = {
          TableName: CONNECTION_TABLE_NAME,
          Key: {
            connectionId: { S: err.connectionId }
          }
        };
        deletePromises.push(dynamodb.deleteItem(deleteParams).promise());
      }
    }
    // wait remove invalid connections
    if (deletePromises.length != 0) {
      try {
        await Promise.all(deletePromises);
      } catch (err) {
        console.log(err);
      }
    }
    return {
        statusCode: 200
    };
  } catch (err) {
    console.log("Error:", err);
    return {
        statusCode: 500
    };
  }
};

const connect = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    const putParams = {
      TableName: CONNECTION_TABLE_NAME,
      Item: {
        connectionId: { S: connectionId },
        ttl: {N: (Math.floor(new Date().getTime() / 1000) + 2 * 60 * 60).toString() }
      }
    };
    await dynamodb.putItem(putParams).promise();
    return {
      statusCode: 200,
      body: 'Connected.'
    };
  } catch (err) {
    console.log('connect', err);
    return {
      statusCode: 500,
      body: JSON.stringify(err)
    };
  }
};

const disconnect = async(event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    const deleteParams = {
      TableName: CONNECTION_TABLE_NAME,
      Key: {
        connectionId: { S: connectionId }
      }
    };
    await dynamodb.deleteItem(deleteParams).promise();
    return {
      statusCode: 200,
      body: 'Disconnected.'
    };
  } catch (err) {
    console.log('disconnect', err);
    return {
      statusCode: 500,
      body: JSON.stringify(err)
    };
  }
};

module.exports = {subscribe, connect, disconnect};