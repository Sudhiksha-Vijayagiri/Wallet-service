// consumes the "transaction-completed" events and pretends to send an email
// for this project we just log to console instead of actually integrating
// with something like sendgrid, that's out of scope

const { consumer } = require('../config/kafka');
require('dotenv').config();

async function startNotificationConsumer() {
  await consumer.connect();
  await consumer.subscribe({
    topic: process.env.KAFKA_TRANSACTION_TOPIC || 'transaction-completed',
    fromBeginning: false
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());
      // pretend this is calling an email api
      console.log(
        `[notification] Email Sent -> transaction ${event.transactionId} of amount ${event.amount} completed`
      );
    }
  });

  console.log('notification consumer is listening for events');
}

module.exports = { startNotificationConsumer };
