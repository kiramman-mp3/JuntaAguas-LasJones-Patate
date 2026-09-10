const db = require('./backend/src/config/db');
async function test() {
  try {
    const [rows] = await db.query("SELECT COUNT(*) as total FROM personas WHERE estado = 'ACTIVO'");
    console.log(rows);
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
test();
