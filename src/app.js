const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const routes = require('./routes');
const errorMiddleware = require('./middleware/error.middleware');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// simple health check, useful for docker/uptime checks later
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api', routes);

// 404 for anything that doesn't match a route above
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'route not found' });
});

// keep this last, it's the centralized error handler
app.use(errorMiddleware);

module.exports = app;
