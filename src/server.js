require('dotenv').config();
const app = require('./app');
const { startNotificationConsumer } = require('./services/notification.service');

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`wallet-service running on port ${PORT}`);
  console.log(`swagger docs available at http://localhost:${PORT}/api-docs`);

  // start kafka consumer in the background, don't block server startup on it
  // (if kafka isn't up yet during local dev, the app should still run)
  try {
    await startNotificationConsumer();
  } catch (err) {
    console.error('could not start notification consumer:', err.message);
    console.log('server will still run, but you wont get transaction notifications in the console');
  }
});
