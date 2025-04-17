const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const flash = require("connect-flash");
const bodyParser = require("body-parser");
const User = require("./models/userModel");
const Item = require("./models/itemModel");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));
  
  

mongoose.connect("mongodb://127.0.0.1:27017/library", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log(" MongoDB Connected"))
.catch(err => console.log("MongoDB Connection Error:", err));


const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    req.flash("error_msg", "Please log in first!");
    res.redirect("/login");
};


app.use(flash());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.user = req.session.user || null;
  next();
});


app.get("/home", async (req, res) => {
    res.render("index", {
      results: [],
      query: "",
      user: req.session.user // this is also in res.locals already
    });
  });
  

app.get("/search", async (req, res) => {
    try {
        const query = req.query.q;
        let results = [];

        if (query) {
            results = await Item.find({
                $or: [
                    { name: { $regex: query, $options: "i" } },
                    { descriptions: { $regex: query, $options: "i" } }
                ]
            });
        }

        res.render("search", { results, query });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});

app.get("/item/:id",isAuthenticated, async (req, res) => {
  try {
      const item = await Item.findById(req.params.id);

      if (!item) {
          return res.status(404).send("Item not found");
      }

      res.render("itemDetails", { item });
  } catch (error) {
      console.error("Item Details Error:", error);
      res.status(500).send("Server Error");
  }
});

const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
      cb(null, Date.now() +"-" + (file.originalname));
      console.log(file);
      
  }
});

const upload = multer({ storage });
console.log(upload);


app.get("/upload", isAuthenticated, (req, res) => {
  res.render("upload");
});


app.post("/upload", isAuthenticated, upload.single("pdf"), async (req, res) => {
    try {
      const { name, descriptions } = req.body;
      const pdfPath = req.file ? `/uploads/${req.file.filename}` : null;
  
      if (!pdfPath) {
        req.flash("error_msg", "No file uploaded. Please try again.");
        return res.redirect("/upload");
      }
  
      const newItem = new Item({
        name,
        descriptions,
        pdf: pdfPath
      });
  
      await newItem.save();
  
      req.flash("success_msg", "✅ File uploaded successfully!");
      res.redirect("/upload");
    } catch (error) {
      console.error("Upload Error:", error);
      req.flash("error_msg", "❌ Error uploading file. Please try again.");
      res.redirect("/upload");
    }
  });
  
  

app.get("/signup", (req, res) => {  
    res.render("signup");
});
app.post("/signup", async (req, res) => {
    const { name, email, password } = req.body;
    let errors = [];

    if (!name || !email || !password) {
        errors.push({ msg: "Please fill in all fields" });
    }

    if (errors.length > 0) {
        console.log("Validation Errors:", errors);
        return res.render("signup", { errors, name, email, password });
    }

    try {
        let user = await User.findOne({ email });
        console.log("Checking if user exists:", user);

        if (user) {
            console.log("User already exists:", user);
            req.flash("error_msg", "Email is already registered");
            return res.redirect("/signup");
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ name, email, password: hashedPassword });

        console.log("Saving new user:", user);
        await user.save();

        console.log("User saved successfully:", user);
        req.flash("success_msg", "You are registered! Please log in.");
        res.redirect("/login");

    } catch (err) {
        console.error("Signup Error:", err);
        res.redirect("/signup");
    }
});

app.get("/login", (req, res) => {
    res.render("login", { user: req.session.user });
});


app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        console.log(user)
        if (!user) {
            req.flash("error_msg", "Invalid email or password");
            return res.redirect("/login");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            req.flash("error_msg", "Invalid email or password");
            return res.redirect("/login");
        }

        req.session.user = user;
        res.redirect("/home");
    } catch (err) {
        console.error("Login Error:", err);
        res.redirect("/login");
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/login");
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
