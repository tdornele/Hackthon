var express  = require('express');
var fs       = require('fs');
var jsonfile = require('jsonfile');
var file     = 'dump (1).json'
var app      = express();
var n        = 100;
var cors     = require('cors');
app.use(cors());

app.get('/', function (req, res) {
	var ema = require('exponential-moving-average');
	var values;
	var times;

	var content;
	jsonfile.readFile(file, (err, data) => {
		if (err) {
			throw err;
		}
		content = data;
		values  = content.map((data) => {
			return data['aggr']['sum'] / data['aggr']['count']['$numberLong']
		})
		console.log('\nNumber of values: ' + values.length);
		times = content.map((data) => {
			return data['ts']['$date']
		})

		var emaValue = [...Array(n).keys()].map(() => null).concat(ema(values, n));

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
		var allEMS = highEMS.map((x, key) => {
			//console.log('x: ' + x, 'lems: ' + parseFloat(lowEMS[key], 'ems: ' + emsList[key]));
			return [parseFloat(x), parseFloat(lowEMS[key])]
		});

		var anomalies = [];
		for (var index in values) {
			//getAnomalies(values[index], emaValue[index], emsList[index]);
			//getAnomalies(values[index], emaValue[index],0.5)
			var thing = getAnomalies(values[index], lowEMS[index], highEMS[index], 0.5, index)
			if (thing !== null) {
				anomalies.push(thing);
			}
		}
		//console.log('number of anomalies: ' + anomalies.length);

		//var anomalies = values.map((x, key) => {
		//	return getAnomalies(x, lowEMS[key], highEMS[key], 1.1)
		//});

		res.send({
			time      : times,
			data      : values,
			ema       : emaValue,
			allEMS    : allEMS,
			anomalies : anomalies
		});
	})
})

app.listen(3000, function () {
	console.log('Server listening')
	//readingData()
})

function ems(emaValue, preEMS, value) {
	var w = 2 / (n + 1);

	if (preEMS === undefined) {
		return Math.sqrt(w * (Math.pow(emaValue, 2) + ((1 - w) * (Math.pow((value - emaValue), 2)))));
	}
	else {
		return Math.sqrt(w * (Math.pow(preEMS[preEMS.length() - 1], 2) + ((1 - w) * (Math.pow((value - emaValue), 2)))));
	}
}

//function getAnomalies(value, emaValue, emsList) {
//
//	var difference  = Math.abs(value - emaValue);
//	var sensitivity = n * emsList;
//
//	if (difference > sensitivity) {
//		//return "ALARM!";
//		console.log('\n\nALARM!!!!!! ' + amount);
//		// Testing to see what values show up
//		console.log('TEST!');
//		console.log('Value: ' + value);
//		console.log('emaValue: ' + emaValue);
//		console.log('Diff: ' + difference);
//		console.log('Sens: ' + sensitivity);
//		amount++;
//		}
//	}
function getAnomalies(value, lems, hems, tolerance, index) {
	//var firstLems = lems;
	//var firstHems = hems;
	lems *= tolerance;
	hems *= (1 + tolerance)
	if (value > hems || value < lems) {
		//console.log('\n\nFIRST LEMS: ' + firstLems + '           FIRST HEMS: ' + firstHems);
		//console.log('lems: ' + lems + '      hems: ' + hems + '       value: ' + value)
		return {
			x : index
			//title: '',
			//text: ''
		}
	}
	else
		return null;
}