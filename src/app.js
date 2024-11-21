import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import { Server } from 'socket.io';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const app = express();
const prisma = new PrismaClient();
const server = http.createServer(app);

let jumlahUser = 0;
let dataOwner = [];
let dataWeb = [];

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Middleware untuk session dan CORS
app.use(
  session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.use(express.static('./src/public')); // Serve static files (HTML, CSS, JS)

// Mendapatkan path direktori saat ini
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Middleware untuk parsing request body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware autentikasi
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
}

async function ambilDataOwner() {
  try {
    // Mengambil data dari database menggunakan Prisma
    const users = await prisma.user.findMany({
      where: {
          role: 'owner' // Filter untuk hanya mengambil data dengan role 'owner'
      },
      orderBy: {
          id: 'desc', // Mengurutkan berdasarkan ID secara menurun
      },
    });
    // Menggunakan await untuk menunggu hasilnya
    return users;  // Mengembalikan data yang didapat
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];  // Mengembalikan array kosong jika terjadi error
  }
}

async function ambilDataWeb() {
  try {
    // Mengambil data dari database menggunakan Prisma
    const web = await prisma.Website.findMany({
      orderBy: {
          id: 'desc', // Mengurutkan berdasarkan ID secara menurun
      },
    });
    // Menggunakan await untuk menunggu hasilnya
    return web;  // Mengembalikan data yang didapat
  } catch (error) {
    console.error('Error fetching web:', error);
    return [];  // Mengembalikan array kosong jika terjadi error
  }
}

// Routes
app.get('/', (req, res) => {
  if (req.session.userId) {
    // Jika sudah terautentikasi, redirect ke halaman dashboard
    res.redirect('/dashboard');
  } else {
    // Jika belum, tampilkan index.html
    res.sendFile(__dirname + '/public/index.html');
  }
});

app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(__dirname + '/public/dashboard.html');
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findFirst({ where: { email } });

    if (user && (await bcrypt.compare(password, user.password))) {
      req.session.userId = user.id;
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Routing untuk menghilangkan .html di URL dan mengirim file owner.html
app.get('/owner/:email_owner', (req, res) => {
  const { email_owner } = req.params;
  res.sendFile(__dirname + '/public/owner.html', { email_owner });
});

app.post('/api/register-owner', async (req, res) => {
  const { email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { email, password: hashedPassword, role: 'owner' } });

    dataOwner = await ambilDataOwner();
    io.emit('dataOwner', dataOwner);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'User already exists' });
  }
});

app.delete('/api/owners/:id/:email', async (req, res) => {
  const { id, email } = req.params;

  try {
      const owner = await prisma.User.delete({
          where: { id: parseInt(id) },
      });

      dataOwner = await ambilDataOwner();
      io.emit('dataOwner', dataOwner);

      io.emit('logout', email);
      console.log(email);

      res.json({ message: `Owner dengan ID ${id} berhasil dihapus.`, owner });
  } catch (error) {
      res.status(500).json({ error: 'Gagal menghapus owner. Pastikan ID valid.' });
  }
});

app.post('/api/register-domain', async (req, res) => {
  const { email, domain } = req.body;

  try {
    await prisma.Website.create({ data: { email, url_web: domain } });

    dataWeb = await ambilDataWeb();
    io.emit('dataWeb', dataWeb);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'gagal' });
  }
});

app.delete('/api/web/:id/:web', async (req, res) => {
  const { id, web } = req.params;

  try {
      const webs = await prisma.Website.delete({
          where: { id: parseInt(id) },
      });

      dataWeb = await ambilDataWeb();
      io.emit('dataWeb', dataWeb);
      io.emit('logout-web', web);

      res.json({ message: `Domain dengan ID ${id} berhasil dihapus.`, webs });
  } catch (error) {
      res.status(500).json({ error: 'Gagal menghapus web. Pastikan ID valid.' });
  }
});

app.post('/api/register-admin', async (req, res) => {
  const { email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { email, password: hashedPassword, role: 'admin' } });

    dataOwner = await ambilDataOwner();
    io.emit('dataOwner', dataOwner);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
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

app.get('/api/dashboard', isAuthenticated, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

dataOwner = await ambilDataOwner();
dataWeb = await ambilDataWeb();

// Socket.io logic
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('gabung', (roomName) => {
    socket.join(roomName);
    if (roomName == 'user') {
      jumlahUser += 1;
    }
  });

  socket.on('auth', async (data, cb) => {
    let domain = data.domain;
    let email = data.email;
    let pass = data.pass;

    const user = await prisma.user.findFirst({
      where: {
        AND: [
          { email: email },
          { role: 'owner' }
        ]
      }
    });

    const web = await prisma.Website.findFirst({
      where: {
        AND: [
          { email: email },
          { url_web: domain.toLowerCase() }
        ]
      }
    });

    if (user && (await bcrypt.compare(pass, user.password)) && web) {
      cb('ok');
    } else {
      cb('gagal');
    }
  });

  socket.on('auth', async (data, cb) => {
    let domain = data.domain;
    let email = data.email;
    let pass = data.pass;

    const user = await prisma.user.findFirst({ where: { email } });

    const web = await prisma.Website.findFirst({
      where: {
        AND: [
          { email: email },
          { url_web: domain.toLowerCase() }
        ]
      }
    });

    if (user && (await bcrypt.compare(pass, user.password)) && web) {
      cb('ok');
    } else {
      cb('gagal');
    }
  });

  socket.emit('dataOwner', dataOwner);
  socket.emit('dataWeb', dataWeb);

  socket.on('disconnect', () => {
    console.log('A user disconnected');
    jumlahUser -= 1;
  });
});

// Start server
server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
