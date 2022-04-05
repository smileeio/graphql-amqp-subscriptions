`npm build` has to be run before committing a release.

### 1.2.0-smileeio-v1

Changes:
- allow providing queue options as a parameter to pubsub.asyncIterator to be able to create a queue based on GraphQL subscription context or parameters
- fixed bug in a subscriber's and publisher's getOrCreateChannel method
