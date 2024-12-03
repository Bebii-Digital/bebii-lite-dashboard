import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import http from 'https';
import { Server } from 'socket.io';
const path = require('path');

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const app = express();
const prisma = new PrismaClient();
const server = http.createServer(app);

let jumlahUser = 0;
let dataOwner = [];
let dataAdmin = [];
let dataWeb = [];

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: '*',
    transports: ['websocket'],
    methods: ["GET", "POST"]
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
    res.redirect('/');
  }
} 

async function ambilDataOwner() {
  try {
    // Mengambil data dari database menggunakan Prisma
    const users = await prisma.$queryRaw`SELECT * FROM User WHERE role = 'owner' ORDER BY id`;
    // Menggunakan await untuk menunggu hasilnya
    return users;  // Mengembalikan data yang didapat
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];  // Mengembalikan array kosong jika terjadi error
  }
}

async function ambilDataAdmin() {
  try {
    // Mengambil data dari database menggunakan Prisma
    const users = await prisma.$queryRaw`SELECT id,email,createdAt FROM User WHERE role = 'admin' ORDER BY id`;
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

let versi = '1.1.6'; 
// Endpoint untuk mengembalikan informasi plugin
app.get('/update-check', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
      new_version: versi,
      download_url: `https://${req.headers.host}/download/bebii-lite-digital-pro.zip`,
      requires: '5.0', // Minimum WordPress version
      tested: '6.0'    // Maximum WordPress version tested
  });
});

app.get('/plugin-info', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
      name: 'bebii lite digital pro',
      slug: 'bebii-lite-digital-pro',
      version: versi,
      author: 'Your Name',
      author_profile: 'https://example.com',
      homepage: 'https://example.com',
      download_url: `https://${req.headers.host}/download/bebii-lite-digital-pro.zip`,
      requires: '5.0',
      tested: '6.0',
      description: 'Plugin Bebii Lebih ngegass.',
      changelog: 'update organik mode, fix bug custom html, update Experimental AFS',
  });
});

// Endpoint untuk mengunduh file plugin
app.get('/download/:filename', (req, res) => {
  const fileName = req.params.filename; // Nama file dari parameter URL
  const filePath = path.join(__dirname, 'downloads', fileName); // Lokasi file di server

  res.download(filePath, fileName, (err) => {
      if (err) {
          console.error('Error downloading file:', err.message);
          res.status(404).json({ error: 'File not found' });
      }
  });
});
 
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(__dirname + '/public/dashboard.html');
});

app.get('/dashboard-admin', isAuthenticated, (req, res) => {
  res.sendFile(__dirname + '/public/dashboard-admin.html');
});
 
app.get('/ganti_kode', isAuthenticated, (req, res) => {
  res.sendFile(__dirname + '/public/ganti_kode.html');
});

app.get('/ganti_password', isAuthenticated, (req, res) => {
  res.sendFile(__dirname + '/public/ganti_password.html');
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
 
    const user = await prisma.$queryRaw`SELECT * FROM User WHERE email = ${email}`;
    let dat_user = user[0];

    if (dat_user) {
      if(dat_user.role == 'admin'){
        if(await bcrypt.compare(password, dat_user.password)){
          req.session.userId = dat_user.id;
          res.json({ success: true, role: 'admin' });
        }else{
          res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
      }else{
        if(dat_user.kode == password){
          req.session.userId = dat_user.id;
          res.json({ success: true, role: 'user' });
        }else{
          res.status(401).json({ success: false, message: 'Invalid email or password' });
        } 
      } 
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
    const role = 'owner';
    const result = await prisma.$queryRaw`
      INSERT INTO \`User\` (\`email\`, \`kode\`, \`role\`) 
      VALUES (${email}, ${password}, ${role})
    `;
    //await prisma.User.create({ data: { email: email, password: hashedPassword, role: 'owner' } });

    dataOwner = await ambilDataOwner();
    io.emit('dataOwner', dataOwner)
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'User already exists' });
  }
});

app.delete('/api/owners/:id/:email', async (req, res) => {
  const { id, email } = req.params;

  try {
    const result = await prisma.$queryRaw`
    DELETE FROM \`User\` 
    WHERE \`id\` = ${parseInt(id)}
    `;
    
    dataOwner = await ambilDataOwner();
    io.emit('dataOwner', dataOwner);

    io.emit('logout', email);
    console.log(email); 

    res.json({ message: `Owner dengan ID ${id} berhasil dihapus.`, owner });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'User already exists' });
  }
});

app.delete('/api/admins/:id/:email', async (req, res) => {
  const { id, email } = req.params;

  try {
      const admin = await prisma.User.delete({
          where: { id: parseInt(id) },
      });

      dataAdmin = await ambilDataAdmin();
      io.emit('dataAdmin', dataAdmin);

      io.emit('logout', email);
      console.log(email);

      res.json({ message: `Admin dengan ID ${id} berhasil dihapus.`, admin });
  } catch (error) {
      res.status(500).json({ error: 'Gagal menghapus admin. Pastikan ID valid.' });
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
    const role = 'admin';
    const result = await prisma.$queryRaw`
      INSERT INTO \`User\` (\`email\`, \`password\`, \`role\`) 
      VALUES (${email}, ${hashedPassword}, ${role})
    `;

    dataAdmin = await ambilDataAdmin();
    io.emit('dataAdmin', dataAdmin);

    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'User already exists' });
  }
});

app.post('/api/ganti-lisensi', async (req, res) => {
  const { email_input, kode } = req.body;

  try {
    const result = await prisma.$queryRaw`
    UPDATE \`User\`
    SET \`kode\` = ${kode}
    WHERE \`email\` = ${email_input}
    `;

    dataOwner = await ambilDataOwner();
    io.emit('dataOwner', dataOwner);

    res.redirect('/dashboard');
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
    const user = await prisma.$queryRaw`
      SELECT * FROM User WHERE id = ${req.session.userId}
    `;
    let data_user = user[0];

    if (!data_user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ email: data_user.email, role: data_user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

dataOwner = await ambilDataOwner();
dataAdmin = await ambilDataAdmin();
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

  socket.on('add-user-trafik', async (data) => {
    let domain = data.domain;
    let ua = data.user_agent;

    const result = await prisma.$queryRaw`
      INSERT INTO \`traffik_user\` (\`url_web\`, \`user_agent\`) 
      VALUES (${domain}, ${ua})
    `;
  })

  socket.on('auth', async (data, cb) => {
    let domain = data.domain;
    let email = data.email;
    let pass = data.pass;

    const user = await prisma.$queryRaw`
      SELECT * FROM User
      WHERE email = ${email} AND role = 'owner'
    `;
    let dat_user = user[0];

    const web = await prisma.Website.findFirst({
      where: {
        AND: [
          { email: email },
          { url_web: domain.toLowerCase() }
        ]
      }
    });

    if (dat_user && (pass == dat_user.kode) && web) {
      console.log(domain + " Diterima");
      cb('ok');
    } else {
      console.log(domain + " Ditolak");
      cb('gagal');
    }
  });

  socket.on('auth', async (data, cb) => {
    let domain = data.domain;
    let email = data.email;
    let pass = data.pass;

    const user = await prisma.$queryRaw`
      SELECT * FROM User WHERE email = ${email}
    `;
    let dat_user = user[0];

    const web = await prisma.Website.findFirst({
      where: {
        AND: [
          { email: email },
          { url_web: domain.toLowerCase() }
        ]
      }
    });

    if (dat_user && pass == dat_user.kode && web) {
      cb('ok');
    } else {
      cb('gagal');
    }
  });

  socket.emit('dataOwner', dataOwner);
  socket.emit('dataAdmin', dataAdmin);
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
