
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const db = new Database("recharged.sqlite");

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

if(!fs.existsSync("uploads")){
    fs.mkdirSync("uploads");
}

db.exec(`
CREATE TABLE IF NOT EXISTS dealers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    name TEXT,
    logo TEXT,
    primary_color TEXT,
    secondary_color TEXT,
    layout_name TEXT,
    package_text TEXT,
    highlights TEXT
);

CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dealer_id INTEGER,
    name TEXT,
    config_json TEXT
);

CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dealer_code TEXT,
    user_email TEXT,
    kenteken TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const storage = multer.diskStorage({
    destination: function(req,file,cb){
        cb(null,"uploads/");
    },
    filename: function(req,file,cb){
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage });

app.post("/api/dealers", (req,res)=>{
    const d = req.body;

    db.prepare(`
        INSERT INTO dealers
        (code,name,primary_color,secondary_color,layout_name,package_text,highlights)
        VALUES (?,?,?,?,?,?,?)
    `).run(
        d.code,
        d.name,
        d.primary_color || "#79b900",
        d.secondary_color || "#080c10",
        d.layout_name || "modern-ev",
        d.package_text || "",
        d.highlights || ""
    );

    res.json({ ok:true });
});

app.get("/api/dealers", (req,res)=>{
    const dealers = db.prepare("SELECT * FROM dealers").all();
    res.json(dealers);
});

app.post("/api/dealers/:code/logo", upload.single("logo"), (req,res)=>{
    const logoPath = "/uploads/" + req.file.filename;

    db.prepare(`
        UPDATE dealers
        SET logo=?
        WHERE code=?
    `).run(logoPath, req.params.code);

    res.json({
        ok:true,
        logo:logoPath
    });
});

app.post("/api/templates", (req,res)=>{
    const t = req.body;

    db.prepare(`
        INSERT INTO templates
        (dealer_id,name,config_json)
        VALUES (?,?,?)
    `).run(
        t.dealer_id,
        t.name,
        JSON.stringify(t.config)
    );

    res.json({ ok:true });
});

app.get("/api/templates/:dealerId", (req,res)=>{
    const rows = db.prepare(`
        SELECT * FROM templates
        WHERE dealer_id=?
    `).all(req.params.dealerId);

    rows.forEach(r=>{
        r.config_json = JSON.parse(r.config_json || "{}");
    });

    res.json(rows);
});

app.post("/api/log-card", (req,res)=>{
    const l = req.body;

    db.prepare(`
        INSERT INTO usage_logs
        (dealer_code,user_email,kenteken)
        VALUES (?,?,?)
    `).run(
        l.dealer_code,
        l.user_email,
        l.kenteken
    );

    res.json({ ok:true });
});

app.get("/api/logs", (req,res)=>{
    const logs = db.prepare(`
        SELECT dealer_code,
               COUNT(*) as total_cards
        FROM usage_logs
        GROUP BY dealer_code
    `).all();

    res.json(logs);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
    console.log(`Server draait op poort ${PORT}`);
});
