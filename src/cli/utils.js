
// percentual diff of two values --> absolute Value
function calcDiffAbs(a, b) {
    let diff = Math.abs(a - b);
    let percent = (diff / Math.min(a, b)) * 100;
    return Math.round(percent * 10000) / 10000;
}

// percentual diff of two values - from a to b
// a -> buy b -> sell for positive result
function calcDiff(a, b) {
    let diff = b - a;
    let percent = (diff / Math.min(a, b)) * 100;
    return Math.round(percent * 10000) / 10000;
}

function addPercent(value, percent) {
    let calculatedPercent = (value / 100) * percent;
    return value + calculatedPercent;
}

function subPercent(value, percent) {
    let calculatedPercent = (value / 100) * percent;
    return value - calculatedPercent;
}

function roundByDigits(value, digits) {
    const multiplier = Math.pow(10, digits);
    return Math.round(value * multiplier) / multiplier;
}

function weightedAverage(book) {
    let wAverage = 0;
    let wSum = 0;
    for (let row of book) {
        let price = parseFloat(row.p);
        let volume = parseFloat(row.v);
        wAverage += price * volume;
        wSum += volume;
    }

    wAverage = wAverage / wSum;
    return wAverage;
}

function calculateAmount(usd, price, digitsRound = null) {
    if (digitsRound === 2) {
        return Math.round((usd / price) * 100) / 100;
    } else if (digitsRound === 1) {
        return Math.round((usd / price) * 10) / 10;
    } else {
        return Math.round(usd / price);
    }
}

function calculateUsdt(amount, price) {
    return Math.round((amount * price) * 100) / 100;
}

function getDateTimeObject() {
    let date = new Date();
    let ts = date.getTime();
    let iso = date.toISOString();
    return {"ts": ts, "iso": iso};
}

function getTimeObject() {
    let date = new Date();
    let ts = date.getTime();
    let iso = date.toISOString().substring(11, 23);
    return {"ts": ts, "time": iso};
}

function smallUid() {
    const min = 3000000;
    const max = 6000000;
    const ts = Math.floor((Math.random() * (max - min) + min));
    return (ts).toString(36);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function debounceOutput(ticker, name, delay, output) {
    if ((DEBOUNCE[name][ticker] + delay) < Date.now()) {
        DEBOUNCE[name][ticker] = Date.now();
        console.log(output);
    }
}

function saveHistory(uuid, ticker, allBids, allAsks, dateTime) {
    const allLatestValuesAsksObject = allAsks.reduce((obj, cur) => ({...obj, [cur.e]: cur}), {});
    const allLatestValuesBidsObject = allBids.reduce((obj, cur) => ({...obj, [cur.e]: cur}), {});

    let tradeInfosRaw = {"id": uuid, "buy": allLatestValuesAsksObject, "sell": allLatestValuesBidsObject, "dateTime": dateTime};
    if (HISTORY.tradeInfosRaw[ticker]) {
        HISTORY.tradeInfosRaw[ticker].push(tradeInfosRaw);
    } else {
        HISTORY.tradeInfosRaw[ticker] = [tradeInfosRaw];
    }
    if (HISTORY.tradeInfosRaw[ticker].length > 20) {
        HISTORY.tradeInfosRaw[ticker] = HISTORY.tradeInfosRaw[ticker].slice(-20);
    }
    HISTORY.tradeInfosRaw[ticker] = HISTORY.tradeInfosRaw[ticker].sort((a, b) => a.dateTime.ts - b.dateTime.ts);
}

// Encrypting text
function encrypt(text) {
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString('hex');
 }
 
 // Decrypting text
 function decrypt(text) {
    let encryptedText = Buffer.from(text, 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
 }

module.exports = {
    calcDiff: calcDiff,
    calcDiffAbs: calcDiffAbs,
    addPercent: addPercent,
    subPercent: subPercent,
    weightedAverage: weightedAverage,
    calculateAmount: calculateAmount,
    calculateUsdt: calculateUsdt,
    getDateTimeObject: getDateTimeObject,
    getTimeObject: getTimeObject,
    smallUid: smallUid,
    sleep: sleep,
    debounceOutput: debounceOutput,
    saveHistory: saveHistory,
    roundByDigits: roundByDigits
}
