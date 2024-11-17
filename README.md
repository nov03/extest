# 使い方


## 手順1
git cloneした後以下のコマンドを実行

```bash 

npm ci

```


## 手順2

以下の要素を検証用AWSアカウントで作成

* 使用可能なドメインをRoute53に作成
* ap-northeast-1で*付きの証明書発行
* us-east-1で*付きの証明書発行


## 手順3

bin/env.tsを編集

以下のサンプルを正しい形式で入力し保存。
export const config = {
    hostedZoneId: 'ZZZZZZZZZZ',
    zoneName: 'ZZZZ.hoge.co.jp',
    acmARN: 'arn:aws:acm:ap-northeast-1:ZZZZZZZZZZZZZZ:certificate/ZZZZZZZZZZZZZZZZZZ',
    acmUsARN: 'arn:aws:acm:us-east-1:ZZZZZZZZZZZZZZ:certificate/ZZZZZZZZZZZZZZ',
};
