require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require("express-session");
const passport = require("passport");
const User = require('./Models/googlesignupmodel');
const OAuth2Strategy = require("passport-google-oauth2").Strategy;
const multer = require('multer')
const Razorpay = require('razorpay')
const crypto = require('crypto')

const Payment = require('./Models/PaymentModel')
const RegisterModel = require('./Models/Register')
const { v4: uuidv4 } = require('uuid');


var storage = multer.diskStorage({
    destination: function (req, file, cd) {
        cd(null, 'uploads')
    },
    filename: function (req, file, cd) {
        cd(null, file.fieldname + "_" + file.originalname);
    }
})
var upload = multer({
    storage: storage,
}).single("image");

const clientid = process.env.Clientid;
const clientsecret = process.env.Clientsecret;

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET,
});

const app = express();
const corsOptions = {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'],
    credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

app.use(session({
    secret: process.env.Secret,
    resave: false,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());


app.post('/register', upload, async (req, res) => {
    try {
        const { name, email, password, mobileno, isAdmin } = req.body;
        const image = req.file.filename;

        // Check if user with the provided email already exists
        const existingUser = await RegisterModel.findOne({ email });
        if (existingUser) {
            // If user already exists, send a response indicating the conflict
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        // Generate a unique personId using uuid
        const personId = uuidv4();

        // Create a new user instance with the plain text password
        const newUser = new RegisterModel({
            name,
            email,
            password, // Save password as plain text (not recommended)
            imageq: image,
            mobileno,
            isAdmin,
            personId,
        });

        // Save the new user to the database
        await newUser.save();

        // Send success response
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        // Send error response
        console.error('Error during user registration:', error);
        res.status(400).json({ error: error.message });
    }
});


app.post('/api/payment/order', (req, res) => {
    const { amount } = req.body;

    try {
        const options = {
            amount: Number(amount * 100),
            currency: "INR",
            receipt: crypto.randomBytes(10).toString("hex"),
        }

        razorpayInstance.orders.create(options, (error, order) => {
            if (error) {
                console.log(error);
                return res.status(500).json({ message: "Something Went Wrong!" });
            }
            res.status(200).json({ data: order });
            console.log(order)
        });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error!" });
        console.log(error);
    }
})

app.post('/api/payment/verify', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, mobileNumber, productName, amount, fullName } = req.body;

    try {
        const sign = razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSign = crypto.createHmac("sha256", "3G0GxAUQIpQWmYJ2I8WaStq2")
            .update(sign.toString())
            .digest("hex");

        const isAuthentic = expectedSign === razorpay_signature;

        if (isAuthentic) {
            const payment = new Payment({
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
                fullName,
                amount,
                email,
                mobileNumber,
                productName

            });

            await payment.save();

            res.json({
                message: "Payment Successful"
            });
        } else {
            res.status(400).json({ message: "Invalid Signature" });
        }
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error!" });
        console.log(error);
    }
})





passport.use(new OAuth2Strategy({
    clientID: clientid,
    clientSecret: clientsecret,
    callbackURL: "/auth/google/callback",
    scope: ["profile", "email"]
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
            user = new User({
                googleId: profile.id,
                displayName: profile.displayName,
                email: profile.emails[0].value,
                image: profile.photos[0].value,
                mobile: profile._json.phone_number, // Handle optional mobile field
                isAdmin: false // Default value
            });

            await user.save();
        }

        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id); // Serialize user ID
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Routes
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get("/auth/google/callback", passport.authenticate("google", {
    successRedirect: "http://localhost:3000/",
    failureRedirect: "http://localhost:3000/login"
}));

app.get("/login/success", async (req, res) => {
    if (req.user) {
        res.status(200).json({ message: "User logged in", user: req.user });
    } else {
        res.status(400).json({ message: "Not Authorized" });
    }
});




app.get("/logout", (req, res, next) => {
    req.logout(function (err) {
        if (err) { return next(err); }
        res.redirect("http://localhost:3000");
    });
});

// Connect to MongoDB
mongoose.connect('mongodb+srv://techiesarjun1978:123@supermarketdatashow.fan0ttc.mongodb.net/?retryWrites=true&w=majority&appName=supermarketdatashow')
    .then(() => console.log('MongoDB Atlas Connected'))
    .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
