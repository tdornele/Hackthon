let express      = require('express');
let fs           = require('fs');
let jsonfile     = require('jsonfile');
let file         = 'dump (1).json'
let app          = express();
let http         = require('http').Server(app);
let io           = require('socket.io')(http);
let n;
let cors         = require('cors');
let clients      = 0;
let counter      = 0;
let dataQueue    = [] // queue that stores the last 10 pieces of data
let anomalyQueue = [] // queue that stores the last 10 pieces of anomalous data
let queueLength  = 10; // length of both queue
let prevEMA; // the previous ema
let preEMS; // the previous ems
let emaValue; // the current ema value
let emsValue = 1; // current ems value
let hems; // higher ems range
let lems; // lower ems range
let emsRange; // json array of hems and lems
let info; // JSON object of the data
let values; // list of data

app.use(cors());

io.on('connection', function (socket) {
	console.log('client connected!')
	clients++;
	if (clients == 1) {
		dataRequired();
	}
});

function dataRequired() {
	let ema     = require('exponential-moving-average');
	let times;
	let content = [];

	jsonfile.readFile(file, (err, data) => {
		if (err) {
			throw err;
		}

		const original = data;
		data           = [...original];

		let i = 0;

		let interval = setInterval(() => {
			console.log(`clients: ${clients}`);
			if (data.length === 0) {
				clearInterval(interval);
				data = [...original];
			}

			// get the json object for the data
			let metric = data.pop();

			if (i < 100) {
				n = i;
			}
			else {
				n = 100;
			}

			content.push(metric);

			values = content.map((valuesData) => {
				return valuesData['aggr']['sum'] / valuesData['aggr']['count']['$numberLong']
			})

			console.log('\nNumber of values: ' + values.length);
			timesWrongFormat = content.map((TimeData) => {
				return TimeData['ts']['$date']
			})

			let times = timesWrongFormat.map((x, key) => {
				let t     = new Date(x);
				let hours = t.getHours();
				return hours + ':00:00';
			})

			let range = (num) => [...Array(num).keys()].map(() => null);

			// process the data
			if (i < 100 ) {
				io.emit('data', {
					data    : data,
					time    : times[i],
					ema     : emaValue,
					ems     : emsValue,
					allEMS  : emsRange,
					anomaly :false
				});
			}
			else {
				process(ema, io, values[i], times[i]);
			}

			i++;
		}, 100);
	})
}

// @ param data: the data value
// @ param time: the time of the data value
function process(ema, io, data, time) {
	/*
			GET THE REQUIRED DATA VALUES
	*/
	// calculate the ema
	emaValue = parseFloat(ema(values, n).pop());
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

	let anomaly = isAnomaly(emaValue, emsValue, data, time, lems, hems, 0.1);
	// create the json object of the data
	info        = {
		data    : data,
		time    : time,
		ema     : emaValue,
		ems     : emsValue,
		allEMS  : emsRange,
		anomaly : anomaly
	};
	/*
			ADD DATA TO THE STACKS
	*/
	// check the data value is not anomalous
	if (anomaly) { // if it is
		console.log("can you work please");
		// try add to anomaly queue
		if (anomalyQueue.length === queueLength) { // if the queue is full
			// no anomaly has occurred so
			// make the correct data become the anomaly queue data
			dataQueue = anomalyQueue;

			// send the first bit of data
			let ev = dataQueue.shift();
			console.log(137, ev);
			io.emit(ev);

			// add info to the dataQueue
			dataQueue.push(info);

			// clear the anomaly queue
			clear(anomalyQueue);
		}
		else { // if the queue is not full
			// add the anomaly to the queue
			anomalyQueue.push(info);

			// reuse the previous ema
			if (dataQueue.length !== 0) {
				let reuse = dataQueue.shift(); // get the ema
				prevEMA   = reuse['ema']; // set the previous ema
				preEMS    = reuse['ems']; // set previous ems
				dataQueue.push(reuse);
				dataQueue.push(reuse);
			}
			else {
				prevEMA = values[n]
				preEMS = prevEMA;
			}
			//dataQueue.push(reuse); // add it twice
			//dataQueue.push(reuse);
		}
	}
	else { // if it is not an anomaly
		// set the previous ems and ema
		preEMS  = emsValue;
		prevEMA = emaValue;

		// empty the stored anomalous data value
		clear(anomalyQueue);
		// check size of dataQueue to see it needs overriding
		if (dataQueue.length === queueLength) { // if max size is reached
			// send off the first element of the queue
			let shift = dataQueue.shift();
			console.log(shift)
			io.emit('data', shift);

			// add the data to the queue
			dataQueue.push(info);
		}
		else { // if the queue isn't full
			// add the data to the queue
			dataQueue.push(info);
		}
	}
}

function isAnomaly(ema, ems, value, time, range, tolerance) {

	lems *= tolerance;
	hems *= (1 + tolerance);

	if(value > hems || value < lems) {
		counter++;
		return true
	}
	else {
		return false
	}
}

function ems(emaValue, preEMS, value) {
	let w = 2 / (n + 1);

	console.log("preEms:   " + preEMS);
	if (emaValue === NaN) {
		preEMS = 1;
		emaValue = value;
		return preEMS
	}
	else if (preEMS === undefined) {
		preEMS = Math.sqrt(w * (Math.pow(emaValue, 2) + ((1 - w) * (Math.pow((value - emaValue), 2)))))
		return preEMS;
	}
	else {
		return Math.sqrt(w * (Math.pow(preEMS, 2) + ((1 - w) * (Math.pow((value - emaValue), 2)))));
	}
}

function clear(queue) {
	queue = [];
}

let port = 3001
http.listen(port, function () {
	console.log('listening on *:' + port)
});