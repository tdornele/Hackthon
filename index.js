var express  = require('express');
var fs       = require('fs');
var jsonfile = require('jsonfile');
var file     = 'dump (1).json'
var app      = express();
var http     = require('http').Server(app);
var io       = require('socket.io')(http);
var n;
var cors     = require('cors');
let clients  = 0;

app.use(cors());

io.on('connection', function (socket) {
	console.log('client connected!')
	clients++;
	if (clients == 1) {
		dataRequired();
	}
	if (clients > 1) {
	}
});

function dataRequired() {
	var ema     = require('exponential-moving-average');
	let values;
	var times;
	let content = [];

	jsonfile.readFile(file, (err, data) => {
		if (err) {
			throw err;
		}

		const original = data;
		data           = [...original];

		let i        = 0;
		let interval = setInterval(() => {
			console.log(`clients: ${clients}`);
			if (data.length === 0) {
				clearInterval(interval);
				data = [...original];
			}

			let metric = data.pop();
			if (i++ < 100) {
				n = i;
			}
			else {
				n = 100;
			}

			content.push(metric);
			//console.log(data)
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

			let range    = (num) => [...Array(num).keys()].map(() => null);
			var emaValue = range(n).concat(ema(values, n));

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
				var thing = getAnomalies(values[index], lowEMS[index], highEMS[index], 0.5, index, times[index], emaValue[index], emsList[index])
				if (thing !== null) {
					anomalies.push(thing);
				}
			}
			let amountAnom = anomalies.length;
			console.log('number of anomalies: ' + amountAnom);
			io.emit('data', {
				data      : values[i],
				ema       : emaValue[i],
				allEMS    : allEMS[i],
				anomalies : anomalies[amountAnom - 1]
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

function getAnomalies(value, lems, hems, tolerance, index, time, emaValue, ems) {
	//lems *= tolerance;
	//hems *= (1 + tolerance)
	//if ( value > hems || value < lems ) {
	//	return {
	//		time: time,
	//		value: value
	//	}
	//}
	//else
	//	return null;
	let diff = value - emaValue;
	let sens = n * ems;
	if (diff < 0) {
		diff *= -1;
	}
	if (diff > sens) {
		return {
			time  : time,
			value : value
		}
	}
	else
		return null;
}

var port = 3001
http.listen(port, function () {
	console.log('listening on *:' + port)
});