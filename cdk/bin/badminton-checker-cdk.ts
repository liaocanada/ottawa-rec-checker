#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BadmintonCheckerStack } from '../lib/badminton-checker-stack';
import { DashboardStack } from '../lib/dashboard-stack';

const app = new cdk.App();
const badmintonCheckerStack = new BadmintonCheckerStack(app, 'BadmintonCheckerStack', {});

new DashboardStack(app, 'DashboardStack', {
  env: { account: '095371326078', region: 'us-east-1' },
  ddb: badmintonCheckerStack.ddb,
});
