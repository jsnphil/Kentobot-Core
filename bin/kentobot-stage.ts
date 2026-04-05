import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DataStack } from '../lib/stacks/data-stack';
import { ApiStack } from '../lib/stacks/api-stack';
// import { DataMigrationStack } from '../lib/stacks/data-migration-stack';
import { WebSocketStack } from '../lib/stacks/web-socket-stack';
import { EventSubscriptionStack } from '../lib/stacks/event-subscription-stack';

export interface KentobotProps extends cdk.StageProps {
  readonly environmentName: string;
}

export class KentobotCoreStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: KentobotProps) {
    super(scope, id, props);

    // Add both stacks to the stage
    const dataStack = new DataStack(this, 'KentobotCoreDatabaseStack', props);
    const apiStack = new ApiStack(this, 'KentobotCoreApiStack', props);
    const eventSubscriptionStack = new EventSubscriptionStack(
      this,
      'KentobotCoreEventSubscriptionStack',
      props
    );
    // const dataMigrationStack = new DataMigrationStack(this, 'KentobotCoreDataMigrationStack', props);
    // const dataMigration = new DataMigrationStack(
    //   this,
    //   'KentobotCoreDataMigrationStack',
    //   props
    // );

    const webSocketStack = new WebSocketStack(
      this,
      'KentobotCoreWebSocketStack',
      props
    );

    webSocketStack.addDependency(dataStack);
    apiStack.addDependency(dataStack);
    apiStack.addDependency(webSocketStack);
    apiStack.addDependency(eventSubscriptionStack);

    cdk.Tags.of(this).add('environment', props.environmentName);
    cdk.Tags.of(apiStack).add('system', 'api');
    // cdk.Tags.of(dataMigration).add('system', 'data-migration');
  }
}
