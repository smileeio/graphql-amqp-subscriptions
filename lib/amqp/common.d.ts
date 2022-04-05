import amqp from 'amqplib';
export declare class Common {
    static convertMessage(msg: amqp.ConsumeMessage | null): any;
}
