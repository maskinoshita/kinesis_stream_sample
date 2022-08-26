# ハンズオン手順

1. `git clone https://github.com/maskinoshita/kinesis_stream_sample.git`
2. `cd kinesis_stream_sample`
3. `npm install`
4. `severless.yml`の`custom.suffix`を変更
5. `sls deploy`
    - 表示される`endpoint:`のURLをコピー
    - コピー忘れたら、`sls info --verbose`を入力すれば表示される
6. `static/index.html`を開き、`WEBSOCKET_URL`を先程のURLに変更する
7. `sls s3sync`
8. `sls info --verbose`を実行して表示される、`StaticWebSiteUrl`にブラウザでアクセスする
9. ブラウザのデベロッパーツールを開き、`Connected.`が表示されることを確認する
    - API GatewayのWebSocketに接続する
    - アクセスすると、対象のLambda(subscriber.js:connect関数)が実行される
        - サーバー側でDynamoDBにセッションIDを保存する
10. [kinesis data stream](https://ap-northeast-1.console.aws.amazon.com/kinesis/home?region=ap-northeast-1#/streams/list)のworkstreamを開き、モニタリングを表示しておく
11. `sls invoke -f producer`でデータ生成をKinesis Streamに送信する
    - デフォルトでは`SCSKのツイートデータ`を`kinesis streams`に送信する
    - `kinesis streams`はLambda(subscriber.js:subscribe関数)のイベントソースになっている。ツイートが到着次第呼び出す。
        - ツイートに関して、Comprehendを呼び出し、ポジネガ判定する
        - 判定結果を、WebSocketで接続されているクライアントに送信する

Option:
    - `serverless.yml`内の`DATAFILE`を`abe_tweets_10000.json`に変更する
    - `sls deploy`を実行
    - `StaticWebSiteUrl`にブラウザでアクセスする
    - `sls inovke -f producer`でデータを投入する

# Clean

* `sls remove`