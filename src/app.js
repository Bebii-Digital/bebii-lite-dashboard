import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import { Server } from 'socket.io'; // Gunakan `Server` untuk mengimpor Socket.io
import '../cg.builder.js'

const app = express();
const prisma = new PrismaClient();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files
app.use(express.static('./src/public'));

// Session middleware
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH, DELETE')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, content-type, Authorization, Content-Type'
  )
  session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
  })
  next();
})

// Middleware to check login
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/');
  }
}

// Routes
app.get('/api/dashboard', isAuthenticated, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
  });
  res.json({ email: user.email });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && (await bcrypt.compare(password, user.password))) {
    req.session.userId = user.id;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid email or password' });
  }
});

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await prisma.user.create({ data: { email, password: hashedPassword } });
    res.json({ success: true });
  } catch {
    res.status(400).json({ success: false, message: 'User already exists' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }
    res.json({ success: true });
  });
});

// Socket.io logic
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('auth', (msg) => {
    console.log(`Message received: ${msg}`);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Start server
server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
