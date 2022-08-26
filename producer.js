'use strict';

const AWS = require('aws-sdk');
const kinesis = new AWS.Kinesis();

const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.env.DATAFILE || "scsk_tweets.json"));
const streamName = process.env.WORKSTREAM_NAME;
console.log(streamName);

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const publish = async (data) => {
  const chunkSize = 20;
  for (let i = 0; i<data.length; i+=chunkSize) {
    console.log(`published ${i}: ${Math.floor(Date.now()/1000)}`);
    const chunk = data.slice(i, i+chunkSize);
    const params = {
      Records: chunk.map((v, i) => ({
        Data: v.text,
        PartitionKey: v.id
      })),
      StreamName: streamName
    };
    await Promise.all([
      kinesis.putRecords(params).promise(),
      sleep(1000)
    ]);
  }
}

module.exports.publish = async (event) => {
  try {
    await publish(data);
    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: 'Published Successfully',
          input: event,
        },
        null,
        2
      ),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify(
        {
          message: 'Published Failed',
          input: event,
          error: err
        },
        null,
        2
      ),
    };
  }
};
