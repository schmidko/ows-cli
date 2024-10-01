
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

const collectionName = "addresses";

async function main() {

    const {Client} = pg
    const client = new Client(config)
    await client.connect()

    //const query = "select pg_size_pretty (pg_database_size ('cexplorer'));";
    query = `select epoch_no from block where block_no is not null order by block_no desc limit 1;`;

    const res = await client.query(query)
console.log(res.rows);

    // for (const ele of res.rows) {
    //     console.log(ele);

    // }
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

async function fetchStakeAddresses(offset) {
    const {Client} = pg
    const client = new Client(config)
    await client.connect();

    const query = "SELECT count(id) FROM stake_address;";
    const res = await client.query(query);
    const rowCount = res.rows[0].count;

    const {db} = await connectDB();
    const collection = db.collection(collectionName);

    //offset = 4900000;
    let resultPg = null;
    do {
        const query = `SELECT * FROM stake_address ORDER BY id LIMIT 100 OFFSET ${offset};`;
        const res = await client.query(query);
        resultPg = res.rows

        for (const row of resultPg) {
            //console.log(row.view);
            
            const filter = {stakeAddress: row.view};
            const data = {
                $set: {
                    stakeAddress: row.view
                }
            };
            const result = await collection.updateOne(filter, data, {upsert: true});

        }
        offset += 100;
        let percent = (100/rowCount) * offset;
        percent = Math.round(percent * 1000) / 1000;
        console.log(percent + '% stake addresses inserted!!');
        
    } while (resultPg.length > 0);

    await client.end()
    return 1;
}


async function fetchData(limit) {
    const {Client} = pg
    const client = new Client(config)
    await client.connect()

    const {db} = await connectDB();
    const collection = db.collection(collectionName);
    const queryFind = {"ada": {$exists: false}};
    const result = await collection.find(queryFind).limit(limit).toArray();
    const items = result.length;

    //const stakeAddress = "stake1u855tsy086jh2xfuth3t7v4rqqy7gcvywnydh0ldtytsvmgk8pg3l";

    const currentEpochQuery = "select epoch_no from block where block_no is not null order by block_no desc limit 1";
    const res11 = await client.query(currentEpochQuery);
    const currentEpoch = res11.rows[0].epoch_no;

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

        const queryFirstTransaction = `SELECT * FROM tx_out 
        LEFT JOIN stake_address ON tx_out.stake_address_id = stake_address.id
        LEFT JOIN tx ON tx_out.tx_id = tx.id
        LEFT JOIN block ON tx.block_id = block.id
        WHERE stake_address.view='${stakeAddress}' ORDER BY time;`;

        const res4 = await client.query(queryFirstTransaction);
        const firstTransaction = res4.rows[0].time;
        const transactionCount = res4.rows.length;

        const query = {stakeAddress: stakeAddress};
        const output = calculateScores(ada, transactionCount, firstTransaction, tokenCount, firstDelegation, currentEpoch);
        console.log(output);

        const data = {
            $set: output
        };
        //const result = await collection.updateOne(query, data, {upsert: true});
        //console.log('progress: ' + items + '/' + count);
        return 0;
    }


    await client.end()
    return 1;
}

function calculateScores(lovelace, transactionCount, firstTransaction, tokenCount, firstDelegationEpoch, currentEpoch) {

    let ows = 0;
    const ada = lovelace / 1000000;
    const delegationAgeDays = (currentEpoch - firstDelegationEpoch) * 5;
    const tsFirstTx = new Date(firstTransaction).getTime()
    const walletAgeDays = Math.round(((Date.now() - tsFirstTx) / 1000) / 86400);

    // wallet age score
    let walletAgeScore = 5;
    if (walletAgeDays < 30) {
        walletAgeScore = 0;
    } 
    if (walletAgeDays > 90) {
        walletAgeScore = 15;
    }
    ows += walletAgeScore;

    // tx score
    let txScore = 10;
    if (transactionCount < 10) {
        txScore = 0;
    } else if (transactionCount > 30) {
        txScore = 20;
    } 
    ows += txScore;

    // balance score
    let balanceScore = 0;
    if (ada > 30) {
        balanceScore = 5;
    }
    ows += balanceScore;

    // policy count score
    let tokenCountScore = 5;
    if (tokenCount < 3) {
        tokenCountScore = 0;
    }
    if (tokenCount > 8) {
        tokenCountScore = 20;
    } 
    ows += tokenCountScore;

    // stake date score
    let delegationAgeScore = 5;
    if (delegationAgeDays < 10) {
        delegationAgeScore = 0;
    } else if (delegationAgeDays > 30) {
        delegationAgeScore = 20;
    } 
    ows += delegationAgeScore;

    let output = {
        balanceLovelace: lovelace,
        balanceAda: ada,
        tokenCount: tokenCount,
        transactionCount: transactionCount,
        firstTransaction: firstTransaction,
        firstDelegationEpoch: firstDelegationEpoch,
        walletAgeDays: walletAgeDays,
        delegationAgeDays: delegationAgeDays,
        scores: {
            walletAgeScore: walletAgeScore,
            txScore: txScore,
            balanceScore: balanceScore,
            policyCountScore: tokenCountScore,
            delegationAgeScore: delegationAgeScore,
            openWalletScore: ows
        }
    }

    return output;
}

module.exports = {
    main: main,
    dbSize: dbSize,
    fetchStakeAddresses: fetchStakeAddresses,
    fetchData: fetchData
}