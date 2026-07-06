// kafka setup. we only use ONE topic in this whole project -> transaction-completed
// the idea is that once a transfer is done, we don't want the notification
// logic (sending an email etc) to slow down or fail the actual money transfer
// so we just publish an event and let a separate consumer deal with it

const { Kafka } = require('kafkajs');
require('dotenv').config();

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'wallet-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    initialRetryTime: 300,
    retries: 5
  }
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'wallet-service-notification-group' });

let producerConnected = false;

// async function getProducer() {
//   if (!producerConnected) {
//     await producer.connect();
//     producerConnected = true;
//   }
//   return producer;
// }
async function getProducer() {
  if (producerConnected) return producer;

  try {
    await producer.connect();
    producerConnected = true;
  } catch (err) {
    console.error("Kafka unavailable:", err.message);

    return {
      send: async () => {}
    };
  }

  return producer;
}

module.exports = {
  kafka,
  producer,
  consumer,
  getProducer
};
