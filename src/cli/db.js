
const { MongoClient, ObjectID } = require('mongodb');
let client;

exports.connectDB = async function connectDB() {
	const user = encodeURIComponent(process.env.MONGO_USER);
	const password = encodeURIComponent(process.env.MONGO_PASSWORD);
	const port = process.env.MONGO_PORT;
	const authMechanism = 'DEFAULT';
	const url = `mongodb://${user}:${password}@localhost:${port}/?authMechanism=${authMechanism}`;

	if (!client) {
		client = await MongoClient.connect(url, {useUnifiedTopology: true});
	}
	return {
		db: client.db('ows'),
		client,
	};
};


exports.getObjectId = (id) => new ObjectID(id);

exports.getSortParam = (arr = []) => {
	let sortQuery = {};

	arr.forEach((param) => {
		const isDesc = param.indexOf('-') === 0;
		const key = isDesc ? param.substr(1) : param;
		sortQuery = {
			...sortQuery,
			[key]: isDesc ? -1 : 1,
		};
	});

	return sortQuery;
};
