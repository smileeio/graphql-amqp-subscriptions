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
        function setup(ch) {
            return ch.assertExchange(this.exchange.name, this.exchange.type, this.exchange.options);
        }
        await channel.addSetup(setup.bind(this));
        await channel.publish(this.exchange.name, routingKey, Buffer.from(JSON.stringify(data)), options);
        this.logger('Message sent to Exchange "%s" with Routing Key "%s" (%j)', this.exchange.name, routingKey, data);
    }
    /**
     * @smileeio only for tests
     */
    async waitForConnect() {
        const channel = await this.getOrCreateChannel();
        return channel.waitForConnect();
    }
    getOrCreateChannel() {
        if (!this.channel) {
            this.channel = this.connection.createChannel();
            this.channel.on('error', (err) => this.logger('Publisher channel error: "%j"', err));
        }
        return this.channel;
    }
}
exports.AMQPPublisher = AMQPPublisher;
