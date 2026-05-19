app.get("/app.js", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app.js"));
});

app.get("/style.css", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "style.css"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const db = new Database(path.join(__dirname, "data", "app.sqlite"));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || "recharged-studio-dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

// BELANGRIJK
app.use(express.static(path.join(__dirname, "public")));

function initDb(){

  db.exec(`
    CREATE TABLE IF NOT EXISTS dealers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      logo_text TEXT DEFAULT 'RECHARGED',
      default_location TEXT DEFAULT '',
      primary_color TEXT DEFAULT '#79b900',
      dark_color TEXT DEFAULT '#080c10',
      package_price TEXT DEFAULT '€ 895,-',
      package_text TEXT DEFAULT '',
      highlights TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dealer_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      name TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dealer_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      kenteken TEXT DEFAULT '',
      model TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const dealerCount = db.prepare(
    "SELECT COUNT(*) as total FROM dealers"
  ).get();

  if(dealerCount.total === 0){

    const dealerAdmin = db.prepare(`
      INSERT INTO dealers
      (code,name,logo_text,default_location)
      VALUES (?,?,?,?)
    `).run(
      "ADMIN",
      "Recharged Studio Admin",
      "RECHARGED",
      "Hoofdkantoor"
    );

    const dealerDemo = db.prepare(`
      INSERT INTO dealers
      (code,name,logo_text,default_location)
      VALUES (?,?,?,?)
    `).run(
      "XPENGROT",
      "XPENG Center Rotterdam",
      "XPENG",
      "Center Rotterdam"
    );

    db.prepare(`
      INSERT INTO users
      (dealer_id,email,name,password_hash,role)
      VALUES (?,?,?,?,?)
    `).run(
      dealerAdmin.lastInsertRowid,
      "admin@recharged.local",
      "Admin",
      bcrypt.hashSync("admin123",10),
      "admin"
    );

    db.prepare(`
      INSERT INTO users
      (dealer_id,email,name,password_hash,role)
      VALUES (?,?,?,?,?)
    `).run(
      dealerDemo.lastInsertRowid,
      "dealer@demo.nl",
      "Demo gebruiker",
      bcrypt.hashSync("demo123",10),
      "dealer_admin"
    );
  }
}

initDb();

app.post("/api/login",(req,res)=>{

  const { dealerCode,email,password } = req.body;

  const dealer = db.prepare(`
    SELECT *
    FROM dealers
    WHERE UPPER(code)=UPPER(?)
    AND active=1
  `).get(dealerCode || "");

  if(!dealer){
    return res.status(401).json({
      error:"Dealercode niet gevonden"
    });
  }

  const user = db.prepare(`
    SELECT *
    FROM users
    WHERE dealer_id=?
    AND LOWER(email)=LOWER(?)
    AND active=1
  `).get(
    dealer.id,
    email || ""
  );

  if(!user){
    return res.status(401).json({
      error:"Gebruiker niet gevonden"
    });
  }

  const valid = bcrypt.compareSync(
    password || "",
    user.password_hash
  );

  if(!valid){
    return res.status(401).json({
      error:"Ongeldig wachtwoord"
    });
  }

  req.session.user = {
    id:user.id,
    dealer_id:user.dealer_id,
    email:user.email,
    role:user.role
  };

  res.json({
    ok:true,
    user:req.session.user,
    dealer
  });
});

// HOMEPAGE
app.get("/",(req,res)=>{
  res.sendFile(
    path.join(__dirname,"public","index.html")
  );
});

// FRONTEND BESTANDEN
app.get("*",(req,res)=>{
  res.sendFile(
    path.join(__dirname,"public","index.html")
  );
});

app.listen(PORT,()=>{
  console.log(`Server draait op poort ${PORT}`);
});
