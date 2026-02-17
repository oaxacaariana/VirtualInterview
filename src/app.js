const express = require('express');
const app = express();

app.use(express.json());

// Routes

app.get("/", (req, res) => {
  res.send("Server is running");
});

module.exports = app;