const {program} = require('commander');
program.helpOption(false);
require('dotenv').config({path: __dirname + '/.env'});
const {calculateAmount, calculateUsdt} = require('./src/cli/utils.js');
const crypto = require('crypto');

global.CONFIG = {};
global.STATE = {};
global.EXCHANGES = {};
global.COINS = {};
global.DATA = {};
global.HISTORY = {"tradeInfosRaw": {}};
global.DEBOUNCE = {"analyse": {}, "monitor": {}, "output": {}, "history": {}, "trade": {}};
global.PHEMEX = {};
global.LOG = {
    red: (str) => console.log('\x1b[31m', str, '\x1b[0m'),
    green: (str) => console.log('\x1b[32m', str, '\x1b[0m'),
    blue: (str) => console.log('\x1b[34m', str, '\x1b[0m'),
    magenta: (str) => console.log('\x1b[35m', str, '\x1b[0m'),
    cyan: (str) => console.log('\x1b[36m', str, '\x1b[0m'),
    white: (str) => console.log('\x1b[37m', str, '\x1b[0m')
};

const tradebot = program.command('ows');
tradebot
    .description('tradebot')
    .command('start')
    .description('Start the aggregation')
    .action(async (release, options, command) => {
        const {main} = require("./src/cli/main.js");
        const result = await main();
        console.log('Aggregation started!!!');
        //process.exit();
    });

tradebot
    .command('size')
    .description('DB size')
    .action(async (release, options, command) => {
        const {dbSize} = require("./src/cli/main.js");
        const result = await dbSize();
        console.log(result);
        
        process.exit();
    });

tradebot
    .command('fetch-addresses')
    .description('fetch addresses')
    .action(async (release, options, command) => {
        const {fetchStakeAddresses} = require("./src/cli/main.js");
        const result = await fetchStakeAddresses();
        console.log(result);
        
        process.exit();
    });

tradebot
    .command('fetch-data')
    .description('fetch data')
    .action(async (release, options, command) => {
        const {fetchData} = require("./src/cli/main.js");
        const result = await fetchData();
        console.log(result);
        
        process.exit();
    });

program
    .command('help')
    .description('Display helpful information')
    .action(function () {
        console.log("help");
        program.help();
    });

program.parseAsync(process.argv);


