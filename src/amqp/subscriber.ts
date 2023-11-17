import type { Channel, ConsumeMessage } from 'amqplib';
import type {
  AmqpConnectionManager,
  ChannelWrapper
} from 'amqp-connection-manager';
import Debug from 'debug';

import { Common } from './common';
import { PubSubAMQPConfig, Exchange, SubscribeOptions } from './interfaces';

export class AMQPSubscriber {
  private connection: AmqpConnectionManager;
  private exchange: Exchange;
  private channel: ChannelWrapper | null = null;

  constructor(config: PubSubAMQPConfig, private logger: Debug.IDebugger) {
    this.connection = config.connection;
    this.exchange = {
      name: 'graphql_subscriptions',
      type: 'topic',
      options: {
        durable: false,
        autoDelete: false
      },
      ...config.exchange
    };
  }

  public async subscribe(
    routingKey: string,
    action: (
      routingKey: string,
      content: any,
      message: ConsumeMessage | null
    ) => void | Promise<void>,
    options: SubscribeOptions
  ): Promise<() => Promise<void>> {
    let teardownChannel: undefined | ((ch: Channel) => Promise<void>);

    // Create and bind queue
    const channel = await this.getOrCreateChannel();

    async function setupChannel(this: AMQPSubscriber, ch: Channel) {
      await ch.assertExchange(
        this.exchange.name,
        this.exchange.type,
        this.exchange.options
      );
      const queue = await ch.assertQueue(
        options.queue.name || '',
        options.queue.options
      );
      await ch.bindQueue(
        queue.queue,
        this.exchange.name,
        routingKey,
        options.queue.options ? options.queue.options.arguments : undefined
      );

      const opts = await ch.consume(
        queue.queue,
        async (msg) => {
          const content = Common.convertMessage(msg);
          this.logger(
            'Message arrived from Queue "%s" (%j)',
            queue.queue,
            content
          );

            await action(routingKey, content, msg);
            /**
             * TLDR: noAck=false means the message is processed again
             *       when the message handler throws an error.
             *
             * https://amqp-node.github.io/amqplib/channel_api.html#:~:text=Defaults%20to%20false.-,noAck,-(boolean)%3A%20if%20true
             */
            if (options?.consume?.noAck === false) {
              ch.ack(msg!);
            }
        },
        { noAck: true, ...((options && options.consume) || {}) }
      );

      this.logger(
        'Subscribed to Queue "%s" (%s)',
        queue.queue,
        opts.consumerTag
      );

      teardownChannel = async (chan: Channel) => {
        this.logger(
          'Disposing Subscriber to Queue "%s" (%s)',
          queue.queue,
          opts.consumerTag
        );
        await chan.cancel(opts.consumerTag);
        if (options.queue.unbindOnDispose) {
          await chan.unbindQueue(queue.queue, this.exchange.name, routingKey);
        }
        if (options.queue.deleteOnDispose) {
          await chan.deleteQueue(queue.queue);
        }
      };
    }

    const setup = setupChannel.bind(this);
    await channel.addSetup(setup);

    // Dispose callback
    return () => channel.removeSetup(setup, teardownChannel);
  }

  /**
   * @smileeio only for tests
   */
  public async waitForConnect() {
    const channel = await this.getOrCreateChannel();
    return channel.waitForConnect();
  }

  private getOrCreateChannel(): ChannelWrapper {
    if (!this.channel) {
      this.channel = this.connection.createChannel();
      this.channel.on('error', (err) => {
        this.logger('Subscriber channel error: "%j"', err);
      });
    }
    return this.channel;
  }
}
