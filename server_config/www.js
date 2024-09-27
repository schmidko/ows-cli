const http = require('http');
const app = require('../src/server/app');

const port = process.env.PORT || 1111;
app.set('port', port);
const server = http.createServer(app);
server.listen(port);