"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AMQPSubscriber = void 0;
const common_1 = require("./common");
class AMQPSubscriber {
    constructor(config, logger) {
        this.logger = logger;
        this.channel = null;
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
    async subscribe(routingKey, action, options) {
        // Create and bind queue
        const channel = await this.getOrCreateChannel();
        await channel.assertExchange(this.exchange.name, this.exchange.type, this.exchange.options);
        const queue = await channel.assertQueue(options.queue.name || '', options.queue.options);
        await channel.bindQueue(queue.queue, this.exchange.name, routingKey, options.queue.options ? options.queue.options.arguments : undefined);
        // Listen for messages
        const opts = await channel.consume(queue.queue, (msg) => {
            let content = common_1.Common.convertMessage(msg);
            this.logger('Message arrived from Queue "%s" (%j)', queue.queue, content);
            action(routingKey, content, msg);
        }, { noAck: true, ...(options && options.consume || {}) });
        this.logger('Subscribed to Queue "%s" (%s)', queue.queue, opts.consumerTag);
        // Dispose callback
        return async () => {
            this.logger('Disposing Subscriber to Queue "%s" (%s)', queue.queue, opts.consumerTag);
            const ch = await this.getOrCreateChannel();
            await ch.cancel(opts.consumerTag);
            if (options.queue.unbindOnDispose) {
                await ch.unbindQueue(queue.queue, this.exchange.name, routingKey);
            }
            if (options.queue.deleteOnDispose) {
                await ch.deleteQueue(queue.queue);
            }
        };
    }
    async getOrCreateChannel() {
        if (!this.channel) {
            this.channel = this.connection.createChannel();
            this.channel.then(ch => {
                ch.on('error', (err) => { this.logger('Subscriber channel error: "%j"', err); });
                /* tslint:disable */
            }).catch(() => { });
        }
        return this.channel;
    }
}
exports.AMQPSubscriber = AMQPSubscriber;
