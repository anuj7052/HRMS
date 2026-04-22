import 'dotenv/config';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { startCronJobs } from './services/cronService';
import { initBlobContainer } from './services/azureBlobService';
import { initQueue } from './services/azureQueueService';

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);

export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: true, // reflect request origin; fine for local dev
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  startCronJobs();
  // No-op if Azure env vars are not set
  initBlobContainer().catch(() => {});
  initQueue().catch(() => {});
});
