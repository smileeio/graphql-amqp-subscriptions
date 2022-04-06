import amqp from 'amqplib';
import Debug from 'debug';
import { v4 as uuidv4 } from 'uuid';

import { AMQPPublisher } from './amqp/publisher';
import { AMQPSubscriber } from './amqp/subscriber';
import { AMQPPubSubEngine, Exchange, PubSubAMQPConfig, SubscribeOptions } from './amqp/interfaces';
import { PubSubAsyncIterator } from './pubsub-async-iterator';

const logger = Debug('AMQPPubSub');

export class AMQPPubSub implements AMQPPubSubEngine {
  private publisher: AMQPPublisher;
  private subscriber: AMQPSubscriber;
  private exchange: Exchange;

  private subscriptionMap: { [subId: number]: { routingKey: string, listener: Function } };
  private subsRefsMap: { [queueName: string]: { [trigger: string]: Array<number> } };
  private unsubscribeMap: { [queueName: string]: { [trigger: string]: () => PromiseLike<any> } };
  private currentSubscriptionId: number;

  constructor(
    config: PubSubAMQPConfig
  ) {
    this.subscriptionMap = {};
    this.subsRefsMap = {};
    this.unsubscribeMap = {};
    this.currentSubscriptionId = 0;

    // Initialize AMQP Helper
    this.publisher = new AMQPPublisher(config, logger);
    this.subscriber = new AMQPSubscriber(config, logger);

    this.exchange = {
      name: 'graphql_subscriptions',
      type: 'topic',
      options: {
        durable: false,
        autoDelete: false
      },
      ...config.exchange
    };

    logger('Finished initializing');
  }

  public async publish(routingKey: string, payload: any, options?: amqp.Options.Publish): Promise<void> {
    logger('Publishing message to exchange "%s" for key "%s" (%j)', this.exchange.name, routingKey, payload);
    return this.publisher.publish(routingKey, payload, options);
  }

  public async subscribe(
    routingKey: string | 'fanout',
    onMessage: (content: any, message?: amqp.ConsumeMessage | null) => void,
    options: SubscribeOptions
  ): Promise<number> {
    const queueName = options.queue.name;
    const id = this.currentSubscriptionId++;

    if (routingKey === 'fanout') {
      routingKey = uuidv4();
    }
    logger('Subscribing to "%s" with id: "%s"', routingKey, id);

    this.subscriptionMap[id] = {
      routingKey: routingKey,
      listener: onMessage
    };

    const refs = this.subsRefsMap[queueName]?.[routingKey];
    if (refs && refs.length > 0) {
      const newRefs = [...refs, id];
      if (!this.subsRefsMap[queueName]) { this.subsRefsMap[queueName] = {}; }
      this.subsRefsMap[queueName][routingKey] = newRefs;
      return id;
    }

    if (!this.subsRefsMap[queueName]) { this.subsRefsMap[queueName] = {}; }
    this.subsRefsMap[queueName][routingKey] = [
      ...(this.subsRefsMap[queueName][routingKey] || []),
      id
    ];

    const existingDispose = this.unsubscribeMap[queueName]?.[routingKey];
    // Get rid of exisiting subscription while we get a new one.
    const [newDispose] = await Promise.all([
      this.subscriber.subscribe(routingKey, this.onMessage.bind(this, queueName), options),
      existingDispose ? existingDispose() : Promise.resolve()
    ]);

    if (!this.unsubscribeMap[queueName]) { this.unsubscribeMap[queueName] = {}; }
    this.unsubscribeMap[queueName][routingKey] = newDispose;
    return id;
  }

  public async unsubscribe(subId: number, queueName: string): Promise<void> {
    const sub = this.subscriptionMap[subId];
    if (!sub) {
      throw new Error(`There is no subscription for id "${subId}"`);
    }
    const { routingKey } = sub;

    const refs = this.subsRefsMap[queueName]?.[routingKey];
    if (!refs) {
      throw new Error(`There is no subscription ref for routing key "${routingKey}", id "${subId}"`);
    }
    logger('Unsubscribing from "%s" with id: "%s"', routingKey, subId);

    if (refs.length === 1) {
      delete this.subscriptionMap[subId];
      return this.unsubscribeForKey(queueName, routingKey);
    }

    const index = refs.indexOf(subId);
    const newRefs =
      index === -1
        ? refs
        : [...refs.slice(0, index), ...refs.slice(index + 1)];
    this.subsRefsMap[queueName][routingKey] = newRefs;
    delete this.subscriptionMap[subId];
  }

  public asyncIterator<T>(triggers: string | string[], options: SubscribeOptions): AsyncIterator<T> {
    return new PubSubAsyncIterator<T>(this, triggers, options);
  }

  private onMessage = (queueName: string, routingKey: string, content: any, message: amqp.ConsumeMessage | null): void => {
    const subscribers = this.subsRefsMap[queueName]?.[routingKey];

    // Don't work for nothing...
    if (!subscribers || !subscribers.length) {
      this.unsubscribeForKey(queueName, routingKey)
      .catch((err) => {
        logger('onMessage unsubscribeForKey error "%j", Routing Key "%s"', err, routingKey);
      });
      return;
    }

    for (const subId of subscribers) {
      this.subscriptionMap[subId].listener(content, message);
    }
  }

  private async unsubscribeForKey(queueName: string, routingKey: string): Promise<void> {
    if (!this.unsubscribeMap[queueName]) { return; }
    if (!this.unsubscribeMap[queueName][routingKey]) { return; }

    const dispose = this.unsubscribeMap[queueName][routingKey];
    delete this.unsubscribeMap[queueName][routingKey];
    delete this.subsRefsMap[queueName][routingKey];
    await dispose();
  }

}
