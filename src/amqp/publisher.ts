import type {
  AmqpConnectionManager,
  ChannelWrapper,
  Options
} from 'amqp-connection-manager';
import type { Channel } from 'amqplib';
import Debug from 'debug';

import { PubSubAMQPConfig, Exchange } from './interfaces';

export class AMQPPublisher {
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

  public async publish(
    routingKey: string,
    data: any,
    options?: Options.Publish
  ): Promise<void> {
    const channel = await this.getOrCreateChannel();

    function setup(this: AMQPPublisher, ch: Channel) {
      return ch.assertExchange(
        this.exchange.name,
        this.exchange.type,
        this.exchange.options
      );
    }

    await channel.addSetup(setup.bind(this));

    await channel.publish(
      this.exchange.name,
      routingKey,
      Buffer.from(JSON.stringify(data)),
      options
    );

    this.logger(
      'Message sent to Exchange "%s" with Routing Key "%s" (%j)',
      this.exchange.name,
      routingKey,
      data
    );
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
      this.channel.on('error', (err) =>
        this.logger('Publisher channel error: "%j"', err)
      );
    }
    return this.channel;
  }
}
