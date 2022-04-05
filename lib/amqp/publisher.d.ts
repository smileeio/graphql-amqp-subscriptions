import amqp from 'amqplib';
import Debug from 'debug';
import { PubSubAMQPConfig } from './interfaces';
export declare class AMQPPublisher {
    private logger;
    private connection;
    private exchange;
    private channel;
    constructor(config: PubSubAMQPConfig, logger: Debug.IDebugger);
    publish(routingKey: string, data: any, options?: amqp.Options.Publish): Promise<void>;
    private getOrCreateChannel;
}
