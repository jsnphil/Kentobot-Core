import * as cdk from 'aws-cdk-lib';

import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import * as webSocketGateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';

import { Construct } from 'constructs';
import { createSongRequestParameters } from '../constructs/song-request-parameters';
import { ARCHITECTURE, lambdaEnvironment, NODE_RUNTIME } from '../CDKConstants';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import path = require('path');

import { EventBus } from '../constructs/event-bus';
import { Api } from '../constructs/api';

export interface ApiStackProps extends cdk.StackProps {
  environmentName: string;
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // ***********************
    // Import shared resources
    // ***********************
    const streamDataTableArn = cdk.Fn.importValue(
      `stream-data-table-arn-${props.environmentName}`
    );

    const streamDataTableStreamArn = cdk.Fn.importValue(
      `stream-data-table-stream-arn-${props.environmentName}`
    );

    const streamDataTable = ddb.Table.fromTableAttributes(
      this,
      `stream-data-table-${props.environmentName}`,
      {
        tableArn: streamDataTableArn,
        tableStreamArn: streamDataTableStreamArn
      }
    );

    const eventsOutboxTableArn = cdk.Fn.importValue(
      `events-outbox-table-arn-${props.environmentName}`
    );

    const eventsOutboxTable = ddb.Table.fromTableArn(
      this,
      `events-outbox-table-${props.environmentName}`,
      eventsOutboxTableArn
    );

    const webSocketApiId = cdk.Fn.importValue(
      `websocket-api-id-${props.environmentName}`
    );

    const webSocketApiStage = cdk.Fn.importValue(
      `websocket-stage-name-${props.environmentName}`
    );

    const webSocketApi =
      webSocketGateway.WebSocketApi.fromWebSocketApiAttributes(
        this,
        'web-socket-api',
        {
          webSocketId: webSocketApiId
        }
      );

    // ***********************
    // Setup main resources
    // ***********************
    const eventBus = new EventBus(this, 'Kentobot-Event-Bus', {
      environmentName: props.environmentName
    });

    const api = new Api(this, 'Kentobot-API', props);
    api.createApiKey('kentobot');
    api.createApiKey('kentobeans-live');

    // ***********************
    // Setup song request resources
    // ***********************
    const songRequestEndpointResource =
      api.apiGateway.root.addResource('songs');

    // ***********************
    // Save song data resource
    // ***********************
    const saveSongQueue = new sqs.Queue(this, 'save-song-data', {
      queueName: `${props.environmentName}-save-song-data`,
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.days(14),
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: new sqs.Queue(this, 'save-song-data-dlq', {
          queueName: `${props.environmentName}-save-song-data-dlq`
        })
      }
    });

    eventBus.addQueueTarget(this, 'save-song-data-target', {
      source: 'kentobot-api',
      eventPattern: {
        detailType: ['song-played']
      },
      queue: saveSongQueue
    });

    // Get all songs endpoint
    const getAllSongRequestsLambda = new lambda.NodejsFunction(
      this,
      'GetAllSongRequests',
      {
        runtime: NODE_RUNTIME,
        handler: 'handler',
        entry: path.join(
          __dirname,
          '../../src/lambdas/rest-api/',
          'song-request/get-all-song-requests.ts'
        ),
        bundling: {
          minify: false,
          externalModules: ['aws-sdk']
        },
        logRetention: logs.RetentionDays.ONE_WEEK,
        environment: {
          ...lambdaEnvironment,
          STREAM_DATA_TABLE: streamDataTable.tableName
        },
        timeout: cdk.Duration.seconds(30),
        memorySize: 2048,
        architecture: ARCHITECTURE
      }
    );

    streamDataTable.grantReadData(getAllSongRequestsLambda);

    getAllSongRequestsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:Query'],
        resources: [`${streamDataTable.tableArn}/index/gsi1`]
      })
    );

    songRequestEndpointResource.addMethod(
      'GET',
      new apiGateway.LambdaIntegration(getAllSongRequestsLambda)
    );

    // ***********************
    // Queue Management Resources
    // ***********************

    // ************************
    // New stream-based endpoints
    // ************************
    const streamEndpointResource = api.apiGateway.root.addResource('streams');

    // Start stream endpoints
    const startStreamLambda = new lambda.NodejsFunction(this, 'StartStream', {
      runtime: NODE_RUNTIME,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/api/', 'start-stream.ts'),
      bundling: {
        minify: false,
        externalModules: ['aws-sdk']
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        ...lambdaEnvironment,
        ENVIRONMENT: props.environmentName,
        STREAM_DATA_TABLE: streamDataTable.tableName
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      architecture: ARCHITECTURE
    });

    streamDataTable.grantReadWriteData(startStreamLambda);

    streamEndpointResource.addMethod(
      'POST',
      new apiGateway.LambdaIntegration(startStreamLambda),
      {
        apiKeyRequired: true
      }
    );

    // TODO Get active stream
    // TODO Get stream by date
    // TODO Delete/end stream

    // Queue management endpoints
    const queueEndpoint = streamEndpointResource
      .addResource('current')
      .addResource('queue');

    // ***********************
    // Request song resource
    // ***********************
    const {
      publicVideoToggle,
      requestDurationLimit,
      djRequestDurationLimit,
      licensedContentToggle,
      maxSongRequestsPerUser
    } = createSongRequestParameters(this, props.environmentName);

    const youtubeApiKeyParameter =
      ssm.StringParameter.fromSecureStringParameterAttributes(
        this,
        'ApiKeyParameter',
        {
          parameterName: 'youtube-api-key'
        }
      );

    const songRequestLambda = new lambda.NodejsFunction(this, 'RequestSong', {
      runtime: NODE_RUNTIME,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/api/request-song.ts'),
      bundling: {
        minify: false,
        externalModules: ['aws-sdk']
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        ...lambdaEnvironment,
        ENVIRONMENT: props.environmentName,
        PUBLIC_VIDEO_TOGGLE_NAME: publicVideoToggle.parameterName,
        REQUEST_DURATION_NAME: requestDurationLimit.parameterName,
        DJ_HOUR_REQUEST_DURATION_NAME: djRequestDurationLimit.parameterName,
        LICENSED_VIDEO_TOGGLE_NAME: licensedContentToggle.parameterName,
        MAX_SONGS_PER_USER: maxSongRequestsPerUser.parameterName,
        STREAM_DATA_TABLE: streamDataTable.tableName,
        WEBSOCKET_API_ID: webSocketApi.apiId,
        WEB_SOCKET_STAGE: webSocketApiStage,
        EVENT_BUS_NAME: eventBus.bus.eventBusName,
        EVENTS_OUTBOX_TABLE: eventsOutboxTable.tableName
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      architecture: ARCHITECTURE
    });

    publicVideoToggle.grantRead(songRequestLambda);
    requestDurationLimit.grantRead(songRequestLambda);
    djRequestDurationLimit.grantRead(songRequestLambda);
    licensedContentToggle.grantRead(songRequestLambda);
    youtubeApiKeyParameter.grantRead(songRequestLambda);
    maxSongRequestsPerUser.grantRead(songRequestLambda);
    streamDataTable.grantReadWriteData(songRequestLambda);
    eventBus.bus.grantPutEventsTo(songRequestLambda);
    eventsOutboxTable.grantWriteData(songRequestLambda);

    const requestSongEndpoint = queueEndpoint.addResource('request-song');
    requestSongEndpoint.addMethod(
      'POST',
      new apiGateway.LambdaIntegration(songRequestLambda),
      {
        apiKeyRequired: true
      }
    );

    /* Remove song from queue endpoint */
    const removeRequestLambda = new lambda.NodejsFunction(
      this,
      'RemoveRequest',
      {
        runtime: NODE_RUNTIME,
        handler: 'handler',
        entry: path.join(__dirname, '../../src/api', 'remove-song.ts'),
        bundling: {
          minify: false,
          externalModules: ['aws-sdk']
        },
        logRetention: logs.RetentionDays.ONE_WEEK,
        environment: {
          ...lambdaEnvironment,
          ENVIRONMENT: props.environmentName,
          STREAM_DATA_TABLE: streamDataTable.tableName,
          WEBSOCKET_API_ID: webSocketApi.apiId,
          WEB_SOCKET_STAGE: webSocketApiStage,
          EVENT_BUS_NAME: eventBus.bus.eventBusName
        },
        timeout: cdk.Duration.minutes(1),
        memorySize: 512,
        architecture: ARCHITECTURE
      }
    );

    streamDataTable.grantReadWriteData(removeRequestLambda);
    eventBus.bus.grantPutEventsTo(removeRequestLambda);

    const removeRequestResource = queueEndpoint
      .addResource('remove-request')
      .addResource('{songId}');

    removeRequestResource.addMethod(
      'DELETE',
      new apiGateway.LambdaIntegration(removeRequestLambda),
      {
        apiKeyRequired: true
      }
    );

    // ***********************
    // Move Request Endpoint
    // ***********************

    const moveSongResource = queueEndpoint
      .addResource('move-request')
      .addResource('{songId}');

    const moveRequestLambda = new lambda.NodejsFunction(this, 'MoveRequest', {
      runtime: NODE_RUNTIME,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/api/move-request.ts'),
      bundling: {
        minify: false,
        externalModules: ['aws-sdk']
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        ...lambdaEnvironment,
        ENVIRONMENT: props.environmentName,
        STREAM_DATA_TABLE: streamDataTable.tableName,
        EVENT_BUS_NAME: eventBus.bus.eventBusName
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      architecture: ARCHITECTURE
    });

    streamDataTable.grantReadWriteData(moveRequestLambda);

    moveSongResource.addMethod(
      'PATCH',
      new apiGateway.LambdaIntegration(moveRequestLambda),
      {
        apiKeyRequired: true
      }
    );

    // ***********************
    // Bump song resource
    // ***********************

    const getQueueLambda = new lambda.NodejsFunction(this, 'GetQueue', {
      runtime: NODE_RUNTIME,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/api/get-queue.ts'),
      bundling: {
        minify: false,
        externalModules: ['aws-sdk']
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        ...lambdaEnvironment,
        ENVIRONMENT: props.environmentName,
        STREAM_DATA_TABLE: streamDataTable.tableName
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      architecture: ARCHITECTURE
    });

    streamDataTable.grantReadData(getQueueLambda);

    queueEndpoint.addMethod(
      'GET',
      new apiGateway.LambdaIntegration(getQueueLambda)
    );

    // ***********************
    // Shuffle endpoints
    // ***********************

    const shuffleResource = queueEndpoint.addResource('shuffle');

    const shuffleLambda = new lambda.NodejsFunction(this, 'Shuffle', {
      runtime: NODE_RUNTIME,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/api/shuffle.ts'),
      bundling: {
        minify: false,
        externalModules: ['aws-sdk']
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        ...lambdaEnvironment,
        ENVIRONMENT: props.environmentName,
        STREAM_DATA_TABLE: streamDataTable.tableName,
        EVENT_BUS_NAME: eventBus.bus.eventBusName
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      architecture: ARCHITECTURE
    });

    streamDataTable.grantReadWriteData(shuffleLambda);

    const toggleShuffleResource = shuffleResource.addResource('toggle');

    toggleShuffleResource.addMethod(
      'POST',
      new apiGateway.LambdaIntegration(shuffleLambda),
      {
        apiKeyRequired: true
      }
    );

    const enterShuffleResource = shuffleResource.addResource('enter');

    enterShuffleResource.addMethod(
      'POST',
      new apiGateway.LambdaIntegration(shuffleLambda),
      {
        apiKeyRequired: true
      }
    );

    const selectShuffleWinnerResource =
      shuffleResource.addResource('select-winner');

    selectShuffleWinnerResource.addMethod(
      'POST',
      new apiGateway.LambdaIntegration(shuffleLambda),
      {
        apiKeyRequired: true
      }
    );

    eventBus.bus.grantPutEventsTo(shuffleLambda);

    /*  End of stream-based endpoints*/

    const streamEventHandler = new lambda.NodejsFunction(
      this,
      'streamEventHandler',
      {
        runtime: NODE_RUNTIME,
        handler: 'handler',
        entry: path.join(
          __dirname,
          '../../src/domains/stream/event-handlers/stream-event-handler.ts'
        ),
        bundling: {
          minify: false,
          externalModules: ['aws-sdk']
        },
        logRetention: logs.RetentionDays.ONE_WEEK,
        environment: {
          ...lambdaEnvironment,
          ENVIRONMENT: props.environmentName,
          STREAM_DATA_TABLE: streamDataTable.tableName,
          WEBSOCKET_API_ID: webSocketApi.apiId,
          WEB_SOCKET_STAGE: webSocketApiStage
        }
      }
    );

    eventBus.addLambdaTarget(this, 'stream-event-event-rule', {
      source: 'kentobot.streaming.system',
      eventPattern: {
        detailType: [
          'song-added-to-queue',
          'song-removed-from-queue',
          'song-moved-in-queue',
          'song-bumped-in-queue'
        ]
      },
      lambda: streamEventHandler
    });

    streamDataTable.grantReadData(streamEventHandler);

    streamEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:ManageConnections'],
        resources: [
          `arn:aws:execute-api:${props.env?.region}:${props.env?.account}:${webSocketApi.apiId}/*/*/@connections/*`
        ]
      })
    );
  }
}
