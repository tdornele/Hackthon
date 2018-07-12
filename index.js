var express  = require('express');
var fs       = require('fs');
var jsonfile = require('jsonfile');
var file     = 'dump (1).json'
var app      = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var n;
var cors     = require('cors');
let clients = 0;

var dataQueue    = [] // queue that stores the last 10 pieces of data
var anomalyQueue = [] // queue that stores the last 10 pieces of anomalous data
var queueLength  = 10; // length of both queue
var prevEMA; // the previous ema
var preEMS; // the previous ems
var emaValue; // the current ema value
var emsValue; // current ems value
var hems; // higher ems range
var lems; // lower ems range
var emsRange; // json array of hems and lems
var info; // JSON object of the data
var values; // list of data

app.use(cors());

io.on('connection', function (socket) {
	console.log('client connected!')
	clients++;
	dataRequired();
});

function dataRequired() {
	var ema = require('exponential-moving-average');
	var times;
	let content = [];

	jsonfile.readFile(file, (err, data) => {
		if (err) {
			throw err;
		}

		const original = data;
		data = [...original];

		let i = 0;

		let interval = setInterval(() => {
			console.log(`clients: ${clients}`);
			if (data.length === 0) {
				clearInterval(interval);
				data = [...original];
			}

			// get the data value
			let metric = data.pop();

			if (i++ < 100) { n = i; }
			else{ n = 100; }

			content.push(metric);

			values = content.map((valuesData) => {
				return valuesData['aggr']['sum'] / valuesData['aggr']['count']['$numberLong']
			})

			console.log('\nNumber of values: ' + values.length);
			timesWrongFormat = content.map((TimeData) => {
				return TimeData['ts']['$date']
			})

			console.log('TimeTS: ' + timesWrongFormat[5]);

			let times = timesWrongFormat.map((x, key) => {
				let t = new Date(x);
				let hours = t.getHours();
				return hours + ':00:00';
			})

			console.log('Time: ' + times[5]);

			let range = (num) => [...Array(num).keys()].map(() => null);

			process(io, values[i],times[i]);

		}, 100);
	})
}

// @ param data: the data value
// @ param time: the time of the data value
function process(io, data, time) {
	/*
			GET THE REQUIRED DATA VALUES
	*/
	// calculate the ema
	emaValue = ema(values, n);
	// calculate the ems
	emsValue = ems(emaValue, preEMS, data);
	// calculate the higher ems range
	hems     = parseFloat(emaValue) + emsValue;
	// calculate the lower ems range
	lems     = parseFloat(emaValue) - emsValue;
	// create the json array of hems and lems
	emsRange = [
		hems,
		lems
	];

	var anomaly = isAnomaly(emaValue, emsValue, data, time, lems, hems);
	// create the json object of the data
	info = {
		data    : data,
		time    : time,
		ema     : emaValue,
		allEMS  : emsRange,
		anomaly : anomaly
	};
	/*
			ADD DATA TO THE STACKS
	*/
	// check the data value is not anomalous
	if (anomaly) { // if it is
		// try add to anomaly queue
		if (anomalyQueue.length === queueLength) { // if the queue is full
			// no anomaly has occurred so
			// make the correct data become the anomaly queue data
			dataQueue = anomalyQueue;

			// send the first bit of data
			io.emit(dataQueue.shift());

			// add info to the dataQueue
			dataQueue.push(info);

			// clear the anomaly queue
			clear(anomalyQueue);
		}
		else { // if the queue is not full
			// add the anomaly to the queue
			anomalyQueue.push(info);

			// reuse the previous ema
			var reuse = dataQueue.shift(); // get the ema
			dataQueue.push(reuse); // add it twice
			dataQueue.push(reuse);
		}
	}
	else { // if it is not an anomaly
		// empty the stored anomalous data value
		clear(anomalyQueue);
		// check size of dataQueue to see it needs overriding
		if (dataQueue.length === queueLength) { // if max size is reached
			// send off the first element of the queue
			io.emit(dataQueue.shift());

			// add the data to the queue
			dataQueue.push(info);
		}
		else { // if the queue isn't full
			// add the data to the queue
			dataQueue.push(info);
		}
	}
}

function isAnomaly(ema, ems, value, time, range) {
	if (Math.abs(value - ema) > (value * ems)) { // if an anomaly has occurred
		return true;
	}
	else { // otherwise, return a null
		return false;
	}
}

function ems(emaValue, preEMS, value) {
	var w = 2 / (n + 1);

	if (preEMS === undefined) {
		return Math.sqrt(w * (Math.pow(emaValue, 2) + ((1 - w) * (Math.pow((value - emaValue), 2)))));
	}
	else {
		return Math.sqrt(w * (Math.pow(preEMS[preEMS.length - 1], 2) + ((1 - w) * (Math.pow((value - emaValue), 2)))));
	}
}

function clear(queue) {
	queue = [];
}

var port = 3001
http.listen(port, function (){
	console.log('listening on *:' + port)
});