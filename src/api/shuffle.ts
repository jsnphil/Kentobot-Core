import { APIGatewayEvent } from 'aws-lambda';
import { apiLambdaWrapper } from '../infrastructure/lambda/api-lambda-wrapper';
import { Code } from 'better-status-codes';

import { ToggleShuffleCommand } from '@commands/toggle-shuffle-command';
import { ShuffleCommandHandler } from '@command-handlers/shuffle-command-handler';
import { Command } from '@commands/command';
import { EnterShuffleCommand } from '@commands/enter-shuffle-command';
import { SelectWinnerCommand } from '@commands/shuffle/select-winner-command';
import { DynamoDBStreamRepository } from '@repositories/stream-repository';
import { StreamFactory } from '@domains/stream/factories/stream-factory';

const streamRepository = new DynamoDBStreamRepository();
const streamFactory = new StreamFactory(streamRepository);

export const handler = async (event: APIGatewayEvent) => {
  const body = JSON.parse(event.body || '{}');

  const commandHandler = new ShuffleCommandHandler(streamFactory, streamRepository);
  let command: Command;

  if (event.path.endsWith('/toggle')) {
    // TODO Type check this with zod
    const { status } = body;

    if (status !== 'open' && status !== 'close') {
      return {
        statusCode: Code.BAD_REQUEST,
        body: JSON.stringify({ message: 'Invalid status' })
      };
    }

    command = new ToggleShuffleCommand(status);
  }

  if (event.path.endsWith('/enter')) {
    // TODO Type check this with zod
    const { user } = body;
    if (!user) {
      return {
        statusCode: Code.BAD_REQUEST,
        body: JSON.stringify({ message: 'Missing user' })
      };
    }

    command = new EnterShuffleCommand(user);
  }

  if (event.path.endsWith('/select-winner')) {
    command = new SelectWinnerCommand();
    const winner = await commandHandler.execute(command!);

    return {
      statusCode: Code.OK,
      body: JSON.stringify({ winner })
    };
  }

  // TODO Ensure this is defined when the others commands are implemented
  await commandHandler.execute(command!);

  return {
    statusCode: Code.OK,
    body: JSON.stringify({})
  };
};
