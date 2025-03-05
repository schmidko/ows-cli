
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
const collectionNamePolices = "assets";

async function main() {

    const {Client} = pg
    const client = new Client(config)
    await client.connect()

    //const stakeAddress = "stake1uxm97mqnylyssfsmqnvnx5mc0cnuk2t2h5cmd9uhlsj2n3cvz7qm2"; // my
    const stakeAddress = "stake1u9zjr6e37w53a474puhx606ayr3rz2l6jljrmzvlzkk3cmg0m2zw0"; // biggest
    //const stakeAddress = "stake1u8jygj9zv32x7zl5hxxl3kpgsyx8qnxx3sp88f8jn4mlcqcd9v5vm"; // last tx > 1 month

    // const lol = `SELECT * from delegation
    //         inner join stake_address on delegation.addr_id = stake_address.id
    //         inner join pool_hash on delegation.pool_hash_id = pool_hash.id
    //         inner join off_chain_pool_data ON off_chain_pool_data.pool_id = pool_hash.id
    //         where stake_address.view = '${stakeAddress}'
    //         order by active_epoch_no asc;`;
    // const res = await client.query(lol);

    const lol5 = `SELECT 
            encode(ma.policy::bytea, 'hex') AS policyId, 
            SUM(matxo.quantity) AS quantity,
            ARRAY_AGG(DISTINCT ma.fingerprint) AS fingerprints
        FROM tx_out AS txo
        LEFT JOIN tx_in AS txi 
            ON txo.tx_id = txi.tx_out_id 
            AND txo.index::smallint = txi.tx_out_index::smallint 
        LEFT JOIN tx ON tx.id = txo.tx_id
        LEFT JOIN block ON tx.block_id = block.id 
        LEFT JOIN stake_address AS sa ON txo.stake_address_id = sa.id 
        LEFT JOIN ma_tx_out AS matxo ON matxo.tx_out_id = txo.id 
        LEFT JOIN multi_asset AS ma ON ma.id = matxo.ident 
        WHERE sa.view = '${stakeAddress}' 
        AND txi.tx_in_id IS NULL 
        AND block.epoch_no IS NOT NULL 
        AND ma.policy IS NOT NULL 
        GROUP BY ma.policy
        ORDER BY policy_id;`;


    const res = await client.query(lol5);
    console.log('res2', res.rows);

    //console.log(res2.rows[1].jsonb_agg);

    // const queryFirstTransaction = `SELECT * FROM tx_out 
    //     LEFT JOIN stake_address ON tx_out.stake_address_id = stake_address.id
    //     LEFT JOIN tx ON tx_out.tx_id = tx.id
    //     LEFT JOIN block ON tx.block_id = block.id
    //     WHERE stake_address.view='${stakeAddress}' ORDER BY time LIMIT 10;`;

    // const res = await client.query(queryFirstTransaction)
    //console.log(res.rows);

    // for (const ele of res.rows) {
    //     console.log(ele);

    // }
    //console.log(res.rows);
    await client.end();

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

    let resultPg = null;
    do {
        const query = `SELECT view FROM stake_address ORDER BY id LIMIT 100 OFFSET ${offset};`;
        const res = await client.query(query);
        resultPg = res.rows

        for (const row of resultPg) {
            const filter = {stakeAddress: row.view};
            const data = {
                $set: {
                    stakeAddress: row.view
                }
            };
            const result = await collection.updateOne(filter, data, {upsert: true});

        }
        offset += 100;
        let percent = (100 / rowCount) * offset;
        percent = Math.round(percent * 1000) / 1000;
        if (offset % 1000 === 0) {
            console.log(percent + '% stake addresses inserted!!');
        }
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
    let queryFind = {
        $or:
            [
                {"date": {$exists: false}},
                {"date": {$lt: new Date("2025-03-01T00:00:00Z")}},
            ]
    };

    let itemsLeft = 0;
    do {
        itemsLeft = await collection.countDocuments(queryFind);
        console.log('items left: ', itemsLeft);
        if (itemsLeft == 0) {
            return "Finished!!"
        }

        const items = await collection.find(queryFind).limit(1000).toArray();
        const currentEpochQuery = "SELECT epoch_no from block where block_no is not null order by block_no desc limit 1;";
        const res11 = await client.query(currentEpochQuery);
        const currentEpoch = res11.rows[0].epoch_no;

        for (const row of items) {
            itemsLeft--;
            const stakeAddress = row.stakeAddress;

            const queryHowOld = `SELECT 
            MAX(block.time) AS last_tx_time,
                CASE 
                    WHEN MAX(block.time) < NOW() - INTERVAL '1 month' THEN true 
                    ELSE false 
                END AS is_older_than_one_month
            FROM tx_out AS txo
            JOIN tx ON tx.id = txo.tx_id
            JOIN block ON tx.block_id = block.id
            JOIN stake_address AS sa ON txo.stake_address_id = sa.id
            WHERE sa.view = '${stakeAddress}';`;

            // skip if too old and data are fetched before
            const resultHowOld = await client.query(queryHowOld);
            
            if (resultHowOld.rows[0].is_older_than_one_month && row.ada) {
                const query = {stakeAddress: stakeAddress};
                await collection.updateOne(query, {$set: {date: new Date()}});
                console.log('left: ' + (itemsLeft) + ' ' + stakeAddress + ' - too old!');
                continue;
            }

            console.log('left: ' + (itemsLeft) + ' ' + stakeAddress);

            // ada balance
            const queryAda = `SELECT sum(tx_out.value)
                FROM stake_address
                inner join tx_out on tx_out.stake_address_id = stake_address.id
                left join tx_in on tx_in.tx_out_id = tx_out.tx_id and tx_in.tx_out_index = tx_out.index
                where stake_address.view = '${stakeAddress}'
                AND tx_in.id is null;`;
            const res1 = await client.query(queryAda);
            let ada = 0;
            if (res1.rows[0].sum) {
                ada = res1.rows[0].sum;
            }

            // token count
            const queryCoins = `SELECT 
                    encode(ma.policy::bytea, 'hex') AS policy_id, 
                    SUM(matxo.quantity) AS quantity,
                    ARRAY_AGG(DISTINCT ma.fingerprint) AS fingerprints
                FROM tx_out AS txo
                LEFT JOIN tx_in AS txi 
                    ON txo.tx_id = txi.tx_out_id 
                    AND txo.index::smallint = txi.tx_out_index::smallint 
                LEFT JOIN tx ON tx.id = txo.tx_id
                LEFT JOIN block ON tx.block_id = block.id 
                LEFT JOIN stake_address AS sa ON txo.stake_address_id = sa.id 
                LEFT JOIN ma_tx_out AS matxo ON matxo.tx_out_id = txo.id 
                LEFT JOIN multi_asset AS ma ON ma.id = matxo.ident 
                WHERE sa.view = '${stakeAddress}' 
                AND txi.tx_in_id IS NULL 
                AND block.epoch_no IS NOT NULL 
                AND ma.policy IS NOT NULL 
                GROUP BY ma.policy
                ORDER BY policy_id;`;
            const resultAssets = await client.query(queryCoins);
            const tokenCount = resultAssets.rows.length;
            const assets = resultAssets.rows;

            // first delegation
            const queryDelegation = `SELECT delegation.active_epoch_no, pool_hash.view from delegation
            inner join stake_address on delegation.addr_id = stake_address.id
            inner join pool_hash on delegation.pool_hash_id = pool_hash.id
            where stake_address.view = '${stakeAddress}'
            order by active_epoch_no asc;`;
            const res3 = await client.query(queryDelegation);
            let firstDelegationEpoch = 0;
            if (res3?.rows[0]?.active_epoch_no) {
                firstDelegationEpoch = parseInt(res3.rows[0].active_epoch_no);
            }

            // pool name
            const queryPoolName = `SELECT * from delegation
            inner join stake_address on delegation.addr_id = stake_address.id
            inner join pool_hash on delegation.pool_hash_id = pool_hash.id
            inner join off_chain_pool_data ON off_chain_pool_data.pool_id = pool_hash.id
            where stake_address.view = '${stakeAddress}'
            order by active_epoch_no asc;`;
            const res33 = await client.query(queryPoolName);
            let poolInfo = {"delegated": false, ticker: "", name: ""};
            if (res33.rows.at(-1)?.json) {
                poolInfo.ticker = res33.rows.at(-1).json.ticker;
                poolInfo.name = res33.rows.at(-1).json.name;
                poolInfo.delegated = true;
            }

            // first transaction
            const queryFirstTransaction = `SELECT * FROM tx_out 
                LEFT JOIN stake_address ON tx_out.stake_address_id = stake_address.id
                LEFT JOIN tx ON tx_out.tx_id = tx.id
                LEFT JOIN block ON tx.block_id = block.id
                WHERE stake_address.view='${stakeAddress}' ORDER BY time LIMIT 10;`;

            const res4 = await client.query(queryFirstTransaction);
            let firstTransaction = null;
            if (res4.rows[0]?.time) {
                firstTransaction = res4.rows[0].time;
            }
            const transactionCount = res4.rows.length;

            const query = {stakeAddress: stakeAddress};
            const output = calculateScores(ada, transactionCount, firstTransaction, tokenCount, firstDelegationEpoch, currentEpoch, poolInfo);

            //console.log(output);

            const resultUpdatedAddresses = await collection.updateOne(query, {$set: output}, {upsert: true});

            if (assets.length > 0) {
                const collectionAssets = db.collection(collectionNamePolices);
                const resultUpdatedAssets = await collectionAssets.updateOne(query, {$set: {"assets": assets}}, {upsert: true});
            }
        }
    } while (itemsLeft > 0);

    await client.end();
    return "Data fetching done!!";
}

function calculateScores(lovelace, transactionCount, firstTransaction, tokenCount, firstDelegationEpoch, currentEpoch, poolInfo) {

    let ows = 0;
    const ada = lovelace / 1000000;
    const delegationAgeDays = (currentEpoch - firstDelegationEpoch) * 5;

    let tsFirstTx = 0;
    let walletAgeDays = 0;
    if (firstTransaction) {
        tsFirstTx = new Date(firstTransaction).getTime();
        walletAgeDays = Math.round(((Date.now() - tsFirstTx) / 1000) / 86400);
    }

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
        date: new Date(),
        poolInfo: poolInfo,
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