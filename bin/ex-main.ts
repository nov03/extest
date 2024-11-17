import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ExStack } from '../lib/ex1-stack';
import { config } from './env';

const app = new cdk.App();

new ExStack(app, 'ExStack', {
  hostedZoneId: config.hostedZoneId,
  zoneName: config.zoneName,
  acmARN: config.acmARN,
  acmUsARN: config.acmUsARN,
});
