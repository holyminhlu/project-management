const express = require('express')
const pool = require('./config/db')

const app = express()
app.use(express.json())

app.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users')
    res.json(rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.listen(5000, () => {
  console.log('Server running on port 5000')
})