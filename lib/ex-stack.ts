import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

interface ExStackProps extends cdk.StackProps {
  hostedZoneId: string;
  zoneName: string;
  acmARN: string;
  acmUsARN: string;
}

interface ExConstructProps extends ExStackProps {
  message: string;
  recordName: string;
}

export class ApiGatewayConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ExConstructProps) {
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
    this.api = new apigateway.LambdaRestApi(this, 'Api', {
      restApiName: `ex${recordName}API`,
      handler: stackIdLambda,
      proxy: false,
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
    });

    // カスタムリソース /message の作成
    const stackIdResource = this.api.root.addResource('message');
    stackIdResource.addMethod('GET');

    // カスタムドメインの設定
    const domainName = new apigateway.DomainName(this, 'DomainName', {
      domainName: `${recordName}.${zoneName}`,
      certificate,
    });

    domainName.addBasePathMapping(this.api);

    // Route 53 Aレコードを作成
    new route53.ARecord(this, 'Record', {
      zone: hostedZone,
      recordName,
      target: route53.RecordTarget.fromAlias(new route53targets.ApiGatewayDomain(domainName)),
    });
  }
}


export class CloudFrontConstruct extends Construct {
  constructor(scope: Construct, id: string, props: ExStackProps & { recordName: string }, api: apigateway.RestApi) {
    super(scope, id);

    const { hostedZoneId, zoneName, acmUsARN, recordName } = props;

    // ホストゾーンの取得
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId,
      zoneName,
    });

    // ACM証明書のインポート
    const certificateUS = certificatemanager.Certificate.fromCertificateArn(this, 'CertificateUS', acmUsARN);

    // CloudFrontディストリビューション
    const distribution = new cloudfront.Distribution(this, 'CloudFront', {
      defaultBehavior: {
        origin: new origins.HttpOrigin(`${api.restApiId}.execute-api.${cdk.Stack.of(this).region}.amazonaws.com`, {
          originPath: '/prod', // API Gatewayのステージを指定
        }),
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      domainNames: [`${recordName}.${zoneName}`],
      certificate: certificateUS,
    });

    // Route 53 Aレコードを作成
    new route53.ARecord(this, 'CloudFrontRecord', {
      zone: hostedZone,
      recordName,
      target: route53.RecordTarget.fromAlias(new route53targets.CloudFrontTarget(distribution)),
    });
  }
}

export class ExStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ExStackProps) {
    super(scope, id, props);

    // 現行用API環境の作成
    const currentApi = new ApiGatewayConstruct(this, 'RestApiCurrent', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.zoneName,
      acmARN: props.acmARN,
      acmUsARN: props.acmUsARN,
      message: 'current',
      recordName: 'current',
    });

    // 移行用API環境の作成
    const pilotApi = new ApiGatewayConstruct(this, 'RestApiPilot', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.zoneName,
      acmARN: props.acmARN,
      acmUsARN: props.acmUsARN,
      message: 'pilot',
      recordName: 'pilot',
    });


    // // 現行用ApiGWの前段に作成するCloudFront
    // new CloudFrontConstruct(this, 'CloudFrontCurrent', {
    //   hostedZoneId: props.hostedZoneId,
    //   zoneName: props.zoneName,
    //   acmARN: props.acmARN,
    //   acmUsARN: props.acmUsARN,
    //   recordName: 'cloudfront-current',
    // }, currentApi.api);

    // // 移行用ApiGWの前段に作成するCloudFront
    // new CloudFrontConstruct(this, 'CloudFrontPilot', {
    //   hostedZoneId: props.hostedZoneId,
    //   zoneName: props.zoneName,
    //   acmARN: props.acmARN,
    //   acmUsARN: props.acmUsARN,
    //   recordName: 'cloudfront-pilot',
    // }, pilotApi.api);

  }
}
