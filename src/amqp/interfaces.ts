import {Options, Connection} from 'amqplib';

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
  connection: Connection;
  exchange?: Exchange;
  queue?: Queue;
}

export interface SubscribeOptions {
  queue: Queue;
  consume?: Options.Consume;
}

export declare abstract class AMQPPubSubEngine {
  public abstract publish(triggerName: string, payload: any): Promise<void>;
  public abstract subscribe(triggerName: string, onMessage: Function, options?: SubscribeOptions): Promise<number>;
  public abstract unsubscribe(subId: number): any;
  public asyncIterator<T>(triggers: string | string[], options?: SubscribeOptions): AsyncIterator<T>;
}
