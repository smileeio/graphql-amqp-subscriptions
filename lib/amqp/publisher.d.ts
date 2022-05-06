import type { Options } from 'amqp-connection-manager';
import Debug from 'debug';
import { PubSubAMQPConfig } from './interfaces';
export declare class AMQPPublisher {
    private logger;
    private connection;
    private exchange;
    private channel;
    constructor(config: PubSubAMQPConfig, logger: Debug.IDebugger);
    publish(routingKey: string, data: any, options?: Options.Publish): Promise<void>;
    /**
     * @smileeio only for tests
     */
    waitForConnect(): Promise<void>;
    private getOrCreateChannel;
}
