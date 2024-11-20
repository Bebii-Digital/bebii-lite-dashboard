import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import { Server } from 'socket.io'; // Gunakan `Server` untuk mengimpor Socket.io

const app = express();
const prisma = new PrismaClient();

// Create an HTTP server to support both Express and Socket.io
const server = http.createServer(app);
const io = new Server(server); // Inisialisasi Socket.io dengan menggunakan `new Server()`

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');

// Session middleware
app.use(
  session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
  })
);

// Middleware to check login
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Routes
app.get('/', isAuthenticated, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
  });
  res.render('dashboard', { email: user.email });
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (user && (await bcrypt.compare(password, user.password))) {
    req.session.userId = user.id;
    res.redirect('/');
  } else {
    res.send('Invalid email or password');
  }
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });
    res.redirect('/login');
  } catch (err) {
    res.send('User already exists');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.send('Error logging out');
    }
    res.redirect('/login');
  });
});

// Socket.io logic
io.on('connection', (socket) => {
  console.log('A user connected');
  
  // Send a welcome message to the client
  socket.emit('message', 'Welcome to the chat!');

  // Listen for a 'chat message' event and broadcast it
  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);  // Broadcast message to all clients
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Start server on port 3000
server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
