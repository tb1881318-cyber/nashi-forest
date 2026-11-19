// Retain the game's compare-and-swap concurrency control on PostgreSQL.
const queries = new Map([
 ['SELECT data,version FROM rooms WHERE id=?','SELECT data,version FROM rooms WHERE id=$1'],
 ['SELECT data FROM rooms WHERE id=?','SELECT data FROM rooms WHERE id=$1'],
 ['INSERT OR IGNORE INTO rooms (id,data,version) VALUES (?,?,0)','INSERT INTO rooms (id,data,version) VALUES ($1,$2,0) ON CONFLICT (id) DO NOTHING'],
 ['UPDATE rooms SET data=?,version=version+1 WHERE id=? AND version=?','UPDATE rooms SET data=$1,version=version+1 WHERE id=$2 AND version=$3']
]);
export const schema = 'CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0)';
export function database(pool) {
 return {prepare(sql) {
  const statement=queries.get(sql);
  if(!statement)throw new Error('Unsupported database statement');
  return {bind(...values) {return {
   async first(){return (await pool.query(statement,values)).rows[0]??null;},
   async run(){return {meta:{changes:(await pool.query(statement,values)).rowCount}};}
  };}};
 }};
}
