import type { ConsumeMessage } from "amqplib";
import Debug from "debug";
import { PubSubAMQPConfig, SubscribeOptions } from "./interfaces";
export declare class AMQPSubscriber {
    private logger;
    private connection;
    private exchange;
    private channel;
    constructor(config: PubSubAMQPConfig, logger: Debug.IDebugger);
    subscribe(routingKey: string, action: (routingKey: string, content: any, message: ConsumeMessage | null) => void, options: SubscribeOptions): Promise<() => Promise<void>>;
    private getOrCreateChannel;
}
