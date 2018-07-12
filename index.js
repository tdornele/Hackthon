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

var counter; // stores the number of data values sent
var valuesAnomalous = []; // stores the last 10 anomalous data values
valuesAnomalous.size = 10; // list of size 10
var preEMS; // the previous EMS value

app.use(cors());

io.on('connection', function (socket) {
	console.log('client connected!')
	clients++;
	dataRequired();
});

function dataRequired() {
	var ema = require('exponential-moving-average');
	let values;
	var times;
	let content = [];

	jsonfile.readFile(file, (err, data) => {
		if (err) {
			throw err;
		}

		const original = data;
		data = [...original];

		let i = 0;

		// set the number of data values to 0
		counter = 0;

		let interval = setInterval(() => {
			console.log(`clients: ${clients}`);
			if (data.length === 0) {
				clearInterval(interval);
				data = [...original];
			}

			// get the data value
			let metric = data.pop();
			// increment the counter
			counter ++;

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
			/*
					GET THE REQUIRED DATA VALUES
			*/
			// calculate the ema
			var emaValue = ema(values,n);
			// calculate the ems
			var emsValue = ems(emaValue,preEMS,metric);
			// calculate the higher ems range
			var hems = parseFloat(emaValue) + emsValue;
			// calculate the lower ems range
			var lems = parseFloat(emaValue) - emsValue;

			// check the data value is not anomalous
			if (isAnomaly(emaValue,emsValue,metric,time)) { // if it is

			}
			else { // if it is not
				// empty the stored anomalous data value
			}



			//var emaValue = range(n).concat(ema(values, n)); // cal
			// var emsValue = ema(x,emsList)

			var emsList = emaValue.map((x, key) => ems(x, emsList, values[key]));

			var highEMS = emaValue.map((x, key) => {
				if (x === null) {
					return null;
				}
				else {
					return parseFloat(x) + emsList[key];
				}
			});

			var lowEMS = emaValue.map((x, key) => {
				if (x === null) {
					return null;
				}
				else {
					return x - emsList[key];
				}
			});
			var allEMS = times.map((x, key) => {
				//console.log('x: ' + x, 'lems: ' + parseFloat(lowEMS[key], 'ems: ' + emsList[key]));
				return [x, parseFloat(highEMS[key]), parseFloat(lowEMS[key])]
			});

			var anomalies = [];
			for (var index in values) {
				var thing = getAnomalies(values[index], lowEMS[index], highEMS[index], 0.5, index)
				if (thing !== null) {
					anomalies.push(thing);
				}
			}
			console.log('number of anomalies: ' + anomalies.length);
			io.emit('data', {
				data      : values,
				ema       : emaValue,
				allEMS,
				anomalies
			})
		}, 100);
	})
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

function getAnomalies(value, lems, hems, tolerance, index) {
	lems *= tolerance;
	hems *= (1 + tolerance)
	if (value > hems || value < lems) { // if an anomaly

			var to_return = {x : index}
			// add to anomaly list
			emaAnomalous.push(value);

			// if the thresh hold has been reached
			if (emaAnomalous.length === 10) {
				// anomaly list becomes the normal list
				emaStore = emaAnomalous;
				// clear the list of anomalies
				emaAnomalous = []
				// return that no anomaly occurred
				return null;
			}
			else { // if thresh hold hasn't been reached
				// return the json object
				return to_return;
			}
	}
	else {
		// if the data isn't anomalous
		// clear the anomaly data
		emaAnomalous = [];
		return null;
	}
}

function isAnomaly(ema, ems, value, time) {

	if (Math.abs(value - ema) > (value * ems)) { // if an anomaly has occurred
		return {
			x: time,
			data: value
		};
	}
	else { // otherwise, return a null
		return null;
	}
}

var port = 3001
http.listen(port, function (){
	console.log('listening on *:' + port)
});