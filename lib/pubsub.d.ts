import amqp from 'amqplib';
import { AMQPPubSubEngine, PubSubAMQPConfig, SubscribeOptions } from './amqp/interfaces';
export declare class AMQPPubSub implements AMQPPubSubEngine {
    private publisher;
    private subscriber;
    private exchange;
    private subscriptionMap;
    private subsRefsMap;
    private unsubscribeMap;
    private currentSubscriptionId;
    constructor(config: PubSubAMQPConfig);
    publish(routingKey: string, payload: any, options?: amqp.Options.Publish): Promise<void>;
    /**
     * @smileeio only for tests
     */
    waitForConnect(): Promise<[void, void]>;
    /**
     * Create a queue and bind it to the exchange with a routing key.
     * This allows you to set up the queue before subscribing to it.
     * @param routingKey The routing key to bind the queue to
     * @param options The subscription options including queue configuration
     * @returns The name of the created queue
     */
    bindQueue(routingKey: string, options: SubscribeOptions): Promise<string>;
    subscribe(routingKey: string | 'fanout', onMessage: (content: any, message?: amqp.ConsumeMessage | null) => void, options: SubscribeOptions): Promise<number>;
    unsubscribe(subId: number, queueName: string): Promise<void>;
    asyncIterator<T>(triggers: string | string[], options: SubscribeOptions): AsyncIterator<T>;
    private onMessage;
    private unsubscribeForKey;
}
