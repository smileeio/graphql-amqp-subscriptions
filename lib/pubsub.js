"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AMQPPubSub = void 0;
const debug_1 = __importDefault(require("debug"));
const uuid_1 = require("uuid");
const publisher_1 = require("./amqp/publisher");
const subscriber_1 = require("./amqp/subscriber");
const pubsub_async_iterator_1 = require("./pubsub-async-iterator");
const logger = debug_1.default('AMQPPubSub');
class AMQPPubSub {
    constructor(config) {
        this.onMessage = (routingKey, content, message) => {
            const subscribers = this.subsRefsMap[routingKey];
            // Don't work for nothing...
            if (!subscribers || !subscribers.length) {
                this.unsubscribeForKey(routingKey)
                    .catch((err) => {
                    logger('onMessage unsubscribeForKey error "%j", Routing Key "%s"', err, routingKey);
                });
                return;
            }
            for (const subId of subscribers) {
                this.subscriptionMap[subId].listener(content, message);
            }
        };
        this.subscriptionMap = {};
        this.subsRefsMap = {};
        this.unsubscribeMap = {};
        this.currentSubscriptionId = 0;
        // Initialize AMQP Helper
        this.publisher = new publisher_1.AMQPPublisher(config, logger);
        this.subscriber = new subscriber_1.AMQPSubscriber(config, logger);
        this.exchange = {
            name: 'graphql_subscriptions',
            type: 'topic',
            options: {
                durable: false,
                autoDelete: false
            },
            ...config.exchange
        };
        logger('Finished initializing');
    }
    async publish(routingKey, payload, options) {
        logger('Publishing message to exchange "%s" for key "%s" (%j)', this.exchange.name, routingKey, payload);
        return this.publisher.publish(routingKey, payload, options);
    }
    async subscribe(routingKey, onMessage, options) {
        const id = this.currentSubscriptionId++;
        if (routingKey === 'fanout') {
            routingKey = uuid_1.v4();
        }
        logger('Subscribing to "%s" with id: "%s"', routingKey, id);
        this.subscriptionMap[id] = {
            routingKey: routingKey,
            listener: onMessage
        };
        const refs = this.subsRefsMap[routingKey];
        if (refs && refs.length > 0) {
            const newRefs = [...refs, id];
            this.subsRefsMap[routingKey] = newRefs;
            return id;
        }
        this.subsRefsMap[routingKey] = [
            ...(this.subsRefsMap[routingKey] || []),
            id
        ];
        const existingDispose = this.unsubscribeMap[routingKey];
        // Get rid of exisiting subscription while we get a new one.
        const [newDispose] = await Promise.all([
            this.subscriber.subscribe(routingKey, this.onMessage, options),
            existingDispose ? existingDispose() : Promise.resolve()
        ]);
        this.unsubscribeMap[routingKey] = newDispose;
        return id;
    }
    async unsubscribe(subId) {
        const sub = this.subscriptionMap[subId];
        if (!sub) {
            throw new Error(`There is no subscription for id "${subId}"`);
        }
        const { routingKey } = sub;
        const refs = this.subsRefsMap[routingKey];
        if (!refs) {
            throw new Error(`There is no subscription ref for routing key "${routingKey}", id "${subId}"`);
        }
        logger('Unsubscribing from "%s" with id: "%s"', routingKey, subId);
        if (refs.length === 1) {
            delete this.subscriptionMap[subId];
            return this.unsubscribeForKey(routingKey);
        }
        const index = refs.indexOf(subId);
        const newRefs = index === -1
            ? refs
            : [...refs.slice(0, index), ...refs.slice(index + 1)];
        this.subsRefsMap[routingKey] = newRefs;
        delete this.subscriptionMap[subId];
    }
    asyncIterator(triggers, options) {
        return new pubsub_async_iterator_1.PubSubAsyncIterator(this, triggers, options);
    }
    async unsubscribeForKey(routingKey) {
        const dispose = this.unsubscribeMap[routingKey];
        delete this.unsubscribeMap[routingKey];
        delete this.subsRefsMap[routingKey];
        await dispose();
    }
}
exports.AMQPPubSub = AMQPPubSub;
