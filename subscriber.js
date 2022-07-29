'use strict';

const AWS = require('aws-sdk');
const kinesis = new AWS.Kinesis();
const comprehend = new AWS.Comprehend();

const streamName = process.env.WORKSTREAM_NAME;

module.exports.subscribe = async (event) => {
    try {
        let tweets = [];
        event.Records.forEach(record => {
          tweets.push(Buffer.from(record.kinesis.data, 'base64').toString('utf8'));
        });
        console.log(`process: ${event.Records.length}`);

        const comprehendParams = {
          LanguageCode: 'ja',
          TextList: tweets
        };

        const results = await comprehend.batchDetectSentiment(comprehendParams).promise();
        let sentiments = {
          POSITIVE: { cnt: 0, maxscore: 0.0, sample: '' },
          NEGATIVE: { cnt: 0, maxscore: 0.0, sample: '' },
          NEUTRAL : { cnt: 0, maxscore: 0.0, sample: '' },
          MIXED: { cnt: 0, maxscore: 0.0, sample: '' }
        };
        if(results) {
          console.log(results);
          for (let result of results.ResultList) {
            if(sentiments[result.Sentiment] == null) {
              continue;
            }
            sentiments[result.Sentiment].cnt += 1;
            if(sentiments[result.Sentiment].maxscore <= result.SentimentScore[result.Sentiment]) {
              sentiments[result.Sentiment].maxscore = result.SentimentScore[result.Sentiment];
              sentiments[result.Sentiment].sample = tweets[result.Index];
            }
            console.log(result);
          }
          console.log(sentiments);
          // console.log(results.ErrorList);
        }

        return {
            statusCode: 200,
            body: JSON.stringify(
              {
                message: 'Process success',
                input: event
              },
              null,
              2
            ),
        };
    } catch (err) {
        console.log(err);
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