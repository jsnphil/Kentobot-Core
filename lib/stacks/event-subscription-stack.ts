import * as cdk from 'aws-cdk-lib';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { ARCHITECTURE, lambdaEnvironment, NODE_RUNTIME } from '../CDKConstants';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import path = require('path');

export interface EventSubscriptionStackProps extends cdk.StackProps {
  environmentName: string;
}

export class EventSubscriptionStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: EventSubscriptionStackProps
  ) {
    super(scope, id, props);

    const streamDataTableArn = cdk.Fn.importValue(
      `stream-data-table-arn-${props.environmentName}`
    );

    const streamDataTable = ddb.Table.fromTableAttributes(
      this,
      `stream-data-table-${props.environmentName}`,
      {
        tableArn: streamDataTableArn
      }
    );

    const bus = new events.EventBus(this, 'kentobot-event-bus', {
      eventBusName: `Kentobot-EventBus-${props.environmentName}-primary`
    });

    bus.archive('kentobot-event-archive-primary', {
      archiveName: `KentobotEventArchive-${props.environmentName}-primary`,
      eventPattern: {
        account: [cdk.Stack.of(this).account]
      },
      retention: cdk.Duration.days(365) // TODO Shorten this
    });

    new events.Rule(this, `kentobot-event-logger-rule-primary`, {
      description: 'Log all events',
      eventPattern: {
        region: ['us-east-1']
      },
      eventBus: bus
    });

    const twitchWebHookApi = new apiGateway.RestApi(this, `TwitchWebHookApi`, {
      restApiName: `TwitchWebHookApi-${props.environmentName}`,
      description: `Twitch WebHook API for ${props.environmentName}`,
      deployOptions: {
        stageName: props.environmentName,
        loggingLevel: apiGateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true
      }
    });

    const twitchResource = twitchWebHookApi.root.addResource('twitch');

    const twitchWebHook = new nodeLambda.NodejsFunction(this, 'TwitchWebHook', {
      runtime: NODE_RUNTIME,
      entry: 'src/apps/twitch/twitch-webhook.ts',
      handler: 'handler',
      environment: {
        ...lambdaEnvironment,
        TWITCH_SECRET: 'secret-key',
        TWITCH_WEBHOOK_CALLBACK_URL:
          process.env.TWITCH_WEBHOOK_CALLBACK_URL || '',
        TWITCH_WEBHOOK_CALLBACK_PORT:
          process.env.TWITCH_WEBHOOK_CALLBACK_PORT || '3000',
        EVENT_BUS_NAME: bus.eventBusName
      },
      architecture: ARCHITECTURE
    });

    bus.grantPutEventsTo(twitchWebHook);

    twitchResource.addResource('events').addMethod(
      'POST',
      new apiGateway.LambdaIntegration(twitchWebHook, {
        proxy: true,
        allowTestInvoke: true
      })
    );

    // const twitchClientId =
    //   ssm.StringParameter.fromSecureStringParameterAttributes(
    //     this,
    //     'TwitchClientId',
    //     {
    //       parameterName: '/dev/twitch/client-id', // Replace with your parameter name
    //       version: 1
    //     }
    //   );

    // const twitchClientSecret =
    //   ssm.StringParameter.fromSecureStringParameterAttributes(
    //     this,
    //     'TwitchClientSecret',
    //     {
    //       parameterName: '/dev/twitch/client-secret', // Replace with your parameter name
    //       version: 1
    //     }
    //   );

    const appTokenLambda = new nodeLambda.NodejsFunction(
      this,
      'TwitchAppToken',
      {
        runtime: NODE_RUNTIME,
        entry: 'src/apps/twitch/get-app-token.ts',
        handler: 'handler',
        environment: {
          // TWITCH_CLIENT_ID: twitchClientId.stringValue,
          // TWITCH_CLIENT_SECRET: twitchClientSecret.stringValue,
          TABLE_NAME: streamDataTable.tableName
        },
        architecture: ARCHITECTURE
      }
    );

    streamDataTable.grantReadWriteData(appTokenLambda);

    // TODO Add API key
    twitchResource.addResource('app-token').addMethod(
      'GET',
      new apiGateway.LambdaIntegration(appTokenLambda, {
        proxy: true,
        allowTestInvoke: true
      })
    );

    const twitchSubscriptionEventHandler = new nodeLambda.NodejsFunction(
      this,
      'TwitchSubscriptionEventHandler',
      {
        runtime: NODE_RUNTIME,
        entry:
          'src/infrastructure/event-handlers/subscription-event-handler.ts',
        handler: 'handler',
        environment: {
          ...lambdaEnvironment,
          EVENT_BUS_NAME: bus.eventBusName
        },
        architecture: ARCHITECTURE
      }
    );

    const twitchSubscriptionEventRule = new events.Rule(
      this,
      'TwitchSubscriptionEventRule',
      {
        eventBus: bus,
        eventPattern: {
          source: ['twitch'],
          detailType: [
            'user-subscribed',
            'user-gifted-subscription',
            'user-resubscribed'
          ]
        }
      }
    );

    twitchSubscriptionEventRule.addTarget(
      new eventsTargets.LambdaFunction(twitchSubscriptionEventHandler)
    );

    const twitchChannelRaidedEventHandler = new nodeLambda.NodejsFunction(
      this,
      'TwitchChannelRaidedEventHandler',
      {
        runtime: NODE_RUNTIME,
        entry:
          'src/infrastructure/event-handlers/channel-raided-event-handler.ts',
        handler: 'handler',
        environment: {
          ...lambdaEnvironment,
          EVENT_BUS_NAME: bus.eventBusName
        },
        architecture: ARCHITECTURE
      }
    );

    const twitchChannelRaidedEventRule = new events.Rule(
      this,
      'TwitchChannelRaidedEventRule',
      {
        eventBus: bus,
        eventPattern: {
          source: ['twitch'],
          detailType: ['channel-raided']
        }
      }
    );

    twitchChannelRaidedEventRule.addTarget(
      new eventsTargets.LambdaFunction(twitchChannelRaidedEventHandler)
    );

    const twitchChannelPointRedemptionEventHandler =
      new nodeLambda.NodejsFunction(
        this,
        'TwitchChannelPointRedemptionEventHandler',
        {
          runtime: NODE_RUNTIME,
          entry:
            'src/infrastructure/event-handlers/channel-points-redeemed-event-handler.ts',
          handler: 'handler',
          environment: {
            ...lambdaEnvironment,
            EVENT_BUS_NAME: bus.eventBusName
          },
          architecture: ARCHITECTURE
        }
      );

    const twitchChannelPointRedemptionEventRule = new events.Rule(
      this,
      'TwitchChannelPointRedemptionEventRule',
      {
        eventBus: bus,
        eventPattern: {
          source: ['twitch'],
          detailType: ['channel-point-redemption']
        }
      }
    );

    twitchChannelPointRedemptionEventRule.addTarget(
      new eventsTargets.LambdaFunction(twitchChannelPointRedemptionEventHandler)
    );

    /* Event outbox */
    const eventTable = new ddb.Table(this, `event-outbox`, {
      tableName: `events-outbox-${props.environmentName}`,
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'pk',
        type: ddb.AttributeType.STRING
      },
      pointInTimeRecovery: true,
      sortKey: {
        name: 'sk',
        type: ddb.AttributeType.STRING
      },
      stream: ddb.StreamViewType.NEW_IMAGE,
      deletionProtection: props.environmentName === 'prod' || false,
      timeToLiveAttribute: 'ttl'
    });

    new cdk.CfnOutput(this, 'EventsOutboxTableArn', {
      value: eventTable.tableArn,
      exportName: `events-outbox-table-arn-${props.environmentName}`
    });

    new cdk.CfnOutput(this, 'EventsOutboxTableName', {
      value: eventTable.tableName,
      exportName: `events-outbox-table-name-${props.environmentName}`
    });

    const eventStream = eventTable.tableStreamArn;

    const apiEventBus = events.EventBus.fromEventBusName(
      this,
      'ApiEventBus',
      `Kentobot-EventBus-${props.environmentName}`
    );

    const eventPublisherLambda = new nodeLambda.NodejsFunction(
      this,
      'PublishEvents',
      {
        runtime: NODE_RUNTIME,
        handler: 'handler',
        entry: path.join(
          __dirname,
          '../../src/infrastructure/',
          'event-publisher.ts'
        ),
        bundling: {
          minify: false,
          externalModules: ['aws-sdk']
        },
        logRetention: logs.RetentionDays.ONE_WEEK,
        environment: {
          ...lambdaEnvironment,
          EVENT_BUS_NAME: apiEventBus.eventBusName
        },
        timeout: cdk.Duration.seconds(30),
        memorySize: 2048,
        architecture: ARCHITECTURE
      }
    );

    eventTable.grantStreamRead(eventPublisherLambda);
    apiEventBus.grantPutEventsTo(eventPublisherLambda);

    eventPublisherLambda.addEventSourceMapping('EventOutboxStreamMapping', {
      eventSourceArn: eventStream,
      startingPosition: lambda.StartingPosition.LATEST,
      batchSize: 100,
      enabled: true
    });
  }
}
