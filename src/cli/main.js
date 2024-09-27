
const {connectDB} = require("./db.js");
const pg = require('pg');

const config = {
    host: 'localhost',
    // Do not hard code your username and password.
    // Consider using Node environment variables.
    user: process.env.PG_USER,     
    password: process.env.PG_PASSWORD,
    database: 'cexplorer',
    port: 5432,
    //ssl: true
};

async function main() {

    const {Client} = pg
    const client = new Client(config)
    await client.connect()

    const query = "select pg_size_pretty (pg_database_size ('cexplorer'));";

    const res = await client.query(query)
    console.log(res.rows) // Hello world!
    await client.end()

}

async function dbSize() {

    const {Client} = pg
    const client = new Client(config)
    await client.connect()

    const query = "select pg_size_pretty (pg_database_size ('cexplorer'));";
    const res = await client.query(query)

    await client.end()
    return res.rows[0];
}

module.exports = {
    main: main,
    dbSize: dbSize
}