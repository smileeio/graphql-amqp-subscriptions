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
        let teardownChannel;
        // Create and bind queue
        const channel = await this.getOrCreateChannel();
        async function setupChannel(ch) {
            await ch.assertExchange(this.exchange.name, this.exchange.type, this.exchange.options);
            const queue = await ch.assertQueue(options.queue.name || '', options.queue.options);
            await ch.bindQueue(queue.queue, this.exchange.name, routingKey, options.queue.options ? options.queue.options.arguments : undefined);
            const opts = await ch.consume(queue.queue, async (msg) => {
                const content = common_1.Common.convertMessage(msg);
                this.logger('Message arrived from Queue "%s" (%j)', queue.queue, content);
                await action(routingKey, content, msg);
                /**
                 * TLDR: noAck=false means the message is processed again
                 *       when the message handler throws an error.
                 *
                 * https://amqp-node.github.io/amqplib/channel_api.html#:~:text=Defaults%20to%20false.-,noAck,-(boolean)%3A%20if%20true
                 */
                if (options?.consume?.noAck === false) {
                    ch.ack(msg);
                }
            }, { noAck: true, ...((options && options.consume) || {}) });
            this.logger('Subscribed to Queue "%s" (%s)', queue.queue, opts.consumerTag);
            teardownChannel = async (chan) => {
                this.logger('Disposing Subscriber to Queue "%s" (%s)', queue.queue, opts.consumerTag);
                await chan.cancel(opts.consumerTag);
                if (options.queue.unbindOnDispose) {
                    await chan.unbindQueue(queue.queue, this.exchange.name, routingKey);
                }
                if (options.queue.deleteOnDispose) {
                    await chan.deleteQueue(queue.queue);
                }
            };
        }
        const setup = setupChannel.bind(this);
        await channel.addSetup(setup);
        // Dispose callback
        return () => channel.removeSetup(setup, teardownChannel);
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
            this.channel.on('error', (err) => {
                this.logger('Subscriber channel error: "%j"', err);
            });
        }
        return this.channel;
    }
}
exports.AMQPSubscriber = AMQPSubscriber;
