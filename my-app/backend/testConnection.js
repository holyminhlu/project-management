const pool = require('./src/config/db')

async function testConnection() {
  try {
    const [rows] = await pool.query('SELECT 1')
    console.log('✅ Database connected successfully')
    console.log(rows)
  } catch (error) {
    console.error('❌ Database connection failed:')
    console.error(error.message)
  }
}

testConnection()