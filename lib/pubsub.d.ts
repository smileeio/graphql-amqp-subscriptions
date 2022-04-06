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
    subscribe(routingKey: string | 'fanout', onMessage: (content: any, message?: amqp.ConsumeMessage | null) => void, options: SubscribeOptions): Promise<number>;
    unsubscribe(subId: number, queueName: string): Promise<void>;
    asyncIterator<T>(triggers: string | string[], options: SubscribeOptions): AsyncIterator<T>;
    private onMessage;
    private unsubscribeForKey;
}
