import { requireAuth } from '../global.js';

requireAuth({
  onReady: ({role}) => {
    window.location.href = (role === 'admin') ? 'clients.html' : 'my.html';
  }
});
