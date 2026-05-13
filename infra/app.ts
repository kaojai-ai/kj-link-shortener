#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { KjLinkShortenerStack } from './kj-link-shortener-stack.js';

const app = new App();

new KjLinkShortenerStack(app, 'KjLinkShortenerStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-southeast-1',
  },
});
