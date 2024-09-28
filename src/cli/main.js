
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

    //const query = "select pg_size_pretty (pg_database_size ('cexplorer'));";
    query = "SELECT * FROM multi_asset LIMIT 100;";

    const res = await client.query(query)

    for (const ele of res.rows) {
        console.log(ele.name.toString());

    }
    //console.log(res.rows);
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

async function fetchStakeAddresses() {
    const {Client} = pg
    const client = new Client(config)
    await client.connect()

    const query = "SELECT view FROM stake_address LIMIT 1000;";
    const res = await client.query(query);

    const {db} = await connectDB();
    const collection = db.collection("addresses");

    for (const row of res.rows) {
        //console.log(row.view);

        const query = {stakeAddress: row.view};
        const data = {
            $set: {
                stakeAddress: row.view
            }
        };
        const result = await collection.updateOne(query, data, {upsert: true});

    }

    await client.end()
    return 1;
}


async function fetchData() {
    const {Client} = pg
    const client = new Client(config)
    await client.connect()

    //const query = "SELECT view FROM stake_address LIMIT 1000;";
    //const res = await client.query(query);

    const {db} = await connectDB();
    const collection = db.collection("addresses");
    const queryFind = {"ada": {$exists: false}};
    const result = await collection.find(queryFind).toArray();
    const items = result.length;

    //const stakeAddress = "stake1u855tsy086jh2xfuth3t7v4rqqy7gcvywnydh0ldtytsvmgk8pg3l";

    let count = 0;
    for (const row of result) {
        count++;
        const stakeAddress = row.stakeAddress;

        const queryAda = `SELECT sum(tx_out.value)
        from stake_address
        inner join tx_out on tx_out.stake_address_id = stake_address.id
        left join tx_in on tx_in.tx_out_id = tx_out.tx_id and tx_in.tx_out_index = tx_out.index
        where stake_address.view = '${stakeAddress}'
        AND tx_in.id is null;`;
        const res1 = await client.query(queryAda);
        let ada = 0;
        if (res1.rows[0].sum) {
            ada = res1.rows[0].sum;
        }
        
        const queryCoins = `SELECT encode(ma.policy::bytea, 'hex') as policy, ma.fingerprint, SUM(matxo.quantity) AS total_quantity
            FROM tx_out AS txo
            LEFT JOIN tx_in AS txi ON txo.tx_id = txi.tx_out_id AND txo.index::smallint = txi.tx_out_index::smallint 
            LEFT JOIN tx ON tx.id = txo.tx_id
            LEFT JOIN block ON tx.block_id = block.id 
            LEFT JOIN stake_address AS sa ON txo.stake_address_id = sa.id 
            LEFT JOIN ma_tx_out AS matxo ON matxo.tx_out_id = txo.id 
            LEFT JOIN multi_asset AS ma ON ma.id = matxo.ident 
            WHERE sa.view = '${stakeAddress}' 
            AND txi.tx_in_id IS NULL 
            AND block.epoch_no IS NOT NULL 
            AND ma.policy IS NOT NULL 
            group by ma.fingerprint, ma.policy 
            order by total_quantity desc;`;
        const res2 = await client.query(queryCoins);
        const tokenCount = res2.rows.length;

        const queryDelegation = `SELECT delegation.active_epoch_no, pool_hash.view from delegation
            inner join stake_address on delegation.addr_id = stake_address.id
            inner join pool_hash on delegation.pool_hash_id = pool_hash.id
            where stake_address.view = '${stakeAddress}'
            order by active_epoch_no asc;`;
        const res3 = await client.query(queryDelegation);
        let firstDelegation = 0;
        if (res3?.rows[0]?.active_epoch_no) {
            firstDelegation = res3.rows[0].active_epoch_no;
        }

        const query = {stakeAddress: stakeAddress};
        const data = {
            $set: {
                ada: ada,
                tokenCount: tokenCount,
                firstDelegation: firstDelegation
            }
        };
        console.log(data);
        
        const result = await collection.updateOne(query, data, {upsert: true});
        console.log('progress: ' + items + '/' + count);
        
    }

   

    await client.end()
    return 1;
}

module.exports = {
    main: main,
    dbSize: dbSize,
    fetchStakeAddresses: fetchStakeAddresses,
    fetchData: fetchData
}