import type { AmqpConnectionManager, Options } from 'amqp-connection-manager';
export interface Exchange {
    name: string;
    type: string;
    options?: Options.AssertExchange;
}
export interface Queue {
    name?: string;
    options?: Options.AssertQueue;
    unbindOnDispose?: boolean;
    deleteOnDispose?: boolean;
}
export interface PubSubAMQPConfig {
    connection: AmqpConnectionManager;
    exchange?: Exchange;
    queue?: Queue;
}
export interface SubscribeQueue extends Queue {
    name: string;
}
export interface SubscribeOptions {
    queue: SubscribeQueue;
    consume?: Options.Consume;
}
export declare abstract class AMQPPubSubEngine {
    abstract publish(triggerName: string, payload: any): Promise<void>;
    abstract subscribe(triggerName: string, onMessage: Function, options: SubscribeOptions): Promise<number>;
    abstract unsubscribe(subId: number, queueName: string): any;
    asyncIterator<T>(triggers: string | string[], options: SubscribeOptions): AsyncIterator<T>;
}
