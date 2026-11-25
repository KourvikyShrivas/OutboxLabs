
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Root API
app.get("/", (req, res) => {
    res.status(200).send("Welcome to ReachInbox Email Scheduler API");
});

// Health Check API
app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "ReachInbox Email Scheduler API is running"
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
