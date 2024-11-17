import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';




interface ExStackProps extends cdk.StackProps {
  hostedZoneId: string;
  zoneName: string;
  acmARN: string;
  acmUsARN?: string;
}

interface RestApiConstructProps extends ExStackProps{
  message: string;
  recordName: string;
}

export class ApiGatewayConstruct extends Construct {
  constructor(scope: Construct, id: string, props: RestApiConstructProps) {
    super(scope, id);

    const { hostedZoneId, zoneName, acmARN, message, recordName } = props;

    // ホストゾーンの取得
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId,
      zoneName,
    });

    // ACM証明書のインポート
    const certificate = certificatemanager.Certificate.fromCertificateArn(this, 'Certificate', acmARN);

    // Lambda関数の定義 (メッセージを返す)
    const stackIdLambda = new lambda.Function(this, 'StackIdLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async function(event) {
          return {
            statusCode: 200,
            body: JSON.stringify({ message: '${message}' })
          };
        };
      `),
    });

    // API Gateway REST APIの設定
    const api = new apigateway.LambdaRestApi(this, 'Api', {
      restApiName: `ex${props.recordName}API`,
      handler: stackIdLambda,
      proxy: false,
    });

    // カスタムドメインの設定
    const domainName = new apigateway.DomainName(this, 'DomainName', {
      domainName: `${recordName}.${zoneName}`,
      certificate,
    });
    domainName.addBasePathMapping(api);

    // Route 53 Aレコードを作成
    new route53.ARecord(this, 'Record', {
      zone: hostedZone,
      recordName,
      target: route53.RecordTarget.fromAlias(new route53targets.ApiGatewayDomain(domainName)),
    });

    // /messageエンドポイントの定義
    const stackIdResource = api.root.addResource('message');
    stackIdResource.addMethod('GET');
  }
}

export class ExStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ExStackProps) {
    super(scope, id, props);

    // 現行用API環境の作成
    new ApiGatewayConstruct(this, 'RestApiCurrent', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.zoneName,
      acmARN: props.acmARN,
      message: 'current', 
      recordName: 'current', 
    });


    // 移行用API環境の作成
    new ApiGatewayConstruct(this, 'RestApiPilot', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.zoneName,
      acmARN: props.acmARN,
      message: 'pilot', 
      recordName: 'pilot', 
    });

  }
}
