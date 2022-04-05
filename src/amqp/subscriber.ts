import amqp from 'amqplib';
import Debug from 'debug';
import * as BluebirdPromise from 'bluebird';

import { Common } from './common';
import { PubSubAMQPConfig, Exchange, Queue, SubscribeOptions } from './interfaces';

export class AMQPSubscriber {
  private connection: amqp.Connection;
  private exchange: Exchange;
  private queue?: Queue;
  private channel: BluebirdPromise<amqp.Channel> | null = null;

  constructor(
    config: PubSubAMQPConfig,
    private logger: Debug.IDebugger
  ) {
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

    if (config.queue) {
      this.queue = config.queue;
    }
  }

  public async subscribe(
    routingKey: string,
    action: (routingKey: string, content: any, message: amqp.ConsumeMessage | null) => void,
    options?: SubscribeOptions
  ): Promise<() => Promise<void>> {
    const queueOptions: Queue = {
        options: {
            exclusive: true,
            durable: false,
            autoDelete: true
        },
        ...(options && options.queue || this.queue || {})
    };
    // Create and bind queue
    const channel = await this.getOrCreateChannel();
    await channel.assertExchange(this.exchange.name, this.exchange.type, this.exchange.options);
    const queue = await channel.assertQueue(queueOptions.name || '', queueOptions.options);
    await channel.bindQueue(
      queue.queue,
      this.exchange.name,
      routingKey,
      queueOptions.options ? queueOptions.options.arguments : undefined
    );

    // Listen for messages
    const opts = await channel.consume(queue.queue, (msg) => {
      let content = Common.convertMessage(msg);
      this.logger('Message arrived from Queue "%s" (%j)', queue.queue, content);
      action(routingKey, content, msg);
    }, { noAck: true, ...(options && options.consume || {}) });
    this.logger('Subscribed to Queue "%s" (%s)', queue.queue, opts.consumerTag);

    // Dispose callback
    return async (): Promise<void> => {
      this.logger('Disposing Subscriber to Queue "%s" (%s)', queue.queue, opts.consumerTag);
      const ch = await this.getOrCreateChannel();
      await ch.cancel(opts.consumerTag);
      if (queueOptions.unbindOnDispose) {
        await ch.unbindQueue(queue.queue, this.exchange.name, routingKey);
      }
      if (queueOptions.deleteOnDispose) {
        await ch.deleteQueue(queue.queue);
      }
    };
  }

  private async getOrCreateChannel(): Promise<amqp.Channel> {
    if (!this.channel) {
      this.channel = this.connection.createChannel();
      this.channel.then(ch => {
        ch.on('error', (err) => { this.logger('Subscriber channel error: "%j"', err); });
        /* tslint:disable */
      }).catch(() => {});
    }
    return this.channel;
  }
}
