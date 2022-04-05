"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AMQPPublisher = void 0;
class AMQPPublisher {
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
    async publish(routingKey, data, options) {
        const channel = await this.getOrCreateChannel();
        await channel.assertExchange(this.exchange.name, this.exchange.type, this.exchange.options);
        channel.publish(this.exchange.name, routingKey, Buffer.from(JSON.stringify(data)), options);
        this.logger('Message sent to Exchange "%s" with Routing Key "%s" (%j)', this.exchange.name, routingKey, data);
    }
    async getOrCreateChannel() {
        if (!this.channel) {
            this.channel = this.connection.createChannel();
            this.channel.then(ch => {
                ch.on('error', (err) => { this.logger('Publisher channel error: "%j"', err); });
                /* tslint:disable */
            }).catch(() => { });
        }
        return this.channel;
    }
}
exports.AMQPPublisher = AMQPPublisher;
