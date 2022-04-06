"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PubSubAsyncIterator = void 0;
const iterall_1 = require("iterall");
/**
 * A class for digesting PubSubEngine events via the new AsyncIterator interface.
 * This implementation is a generic version of the one located at
 * https://github.com/apollographql/graphql-subscriptions/blob/master/src/event-emitter-to-async-iterator.ts
 * @class
 *
 * @constructor
 *
 * @property pullQueue @type {Function[]}
 * A queue of resolve functions waiting for an incoming event which has not yet arrived.
 * This queue expands as next() calls are made without PubSubEngine events occurring in between.
 *
 * @property pushQueue @type {any[]}
 * A queue of PubSubEngine events waiting for next() calls to be made.
 * This queue expands as PubSubEngine events arrice without next() calls occurring in between.
 *
 * @property eventsArray @type {string[]}
 * An array of PubSubEngine event names which this PubSubAsyncIterator should watch.
 *
 * @property allSubscribed @type {Promise<number[]>}
 * A promise of a list of all subscription ids to the passed PubSubEngine.
 *
 * @property listening @type {boolean}
 * Whether or not the PubSubAsynIterator is in listening mode (responding to incoming PubSubEngine events and next() calls).
 * Listening begins as true and turns to false once the return method is called.
 *
 * @property pubsub @type {PubSubEngine}
 * The PubSubEngine whose events will be observed.
 */
class PubSubAsyncIterator {
    constructor(pubsub, eventNames, options) {
        this.options = options;
        this.pubsub = pubsub;
        this.pullQueue = [];
        this.pushQueue = [];
        this.listening = true;
        this.eventsArray = typeof eventNames === 'string' ? [eventNames] : eventNames;
        this.allSubscribed = this.subscribeAll();
    }
    async next() {
        await this.allSubscribed;
        return this.listening ? this.pullValue() : this.return();
    }
    async return() {
        this.emptyQueue(await this.allSubscribed);
        return { value: undefined, done: true };
    }
    async throw(err) {
        this.emptyQueue(await this.allSubscribed);
        return Promise.reject(err);
    }
    [iterall_1.$$asyncIterator]() {
        return this;
    }
    async pushValue(event) {
        await this.allSubscribed;
        if (this.pullQueue.length !== 0) {
            let element = this.pullQueue.shift();
            if (element) {
                element({ value: event, done: false });
            }
        }
        else {
            this.pushQueue.push(event);
        }
    }
    pullValue() {
        return new Promise(resolve => {
            if (this.pushQueue.length !== 0) {
                resolve({ value: this.pushQueue.shift(), done: false });
            }
            else {
                this.pullQueue.push(resolve);
            }
        });
    }
    emptyQueue(subscriptionIds) {
        if (this.listening) {
            this.listening = false;
            this.unsubscribeAll(subscriptionIds);
            this.pullQueue.forEach(resolve => resolve({ value: undefined, done: true }));
            this.pullQueue.length = 0;
            this.pushQueue.length = 0;
        }
    }
    subscribeAll() {
        return Promise.all(this.eventsArray.map(eventName => this.pubsub.subscribe(eventName, this.pushValue.bind(this), this.options)));
    }
    unsubscribeAll(subscriptionIds) {
        for (const subscriptionId of subscriptionIds) {
            this.pubsub.unsubscribe(subscriptionId, this.options.queue.name);
        }
    }
}
exports.PubSubAsyncIterator = PubSubAsyncIterator;
