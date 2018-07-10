var express  = require('express');
var fs       = require('fs');
var jsonfile = require('jsonfile');
var file     = 'data.json'
var app      = express();
var n        = 100;
var cors     = require('cors');
app.use(cors());

var amount = 0;

app.get('/', function (req, res) {
	var ema = require('exponential-moving-average');
	var values;

	var content;
	jsonfile.readFile(file, (err, data) => {
		if (err) {
			throw err;
		}
		content = data;
		values  = content.map((data) => {
			return data['aggr']['sum'] / data['aggr']['count']['$numberLong']
		})

		var firstList  = ema(values, n).map(x => x * 3);
		var secondList = ema(ema(values, n), n).map(x => x * 3);
		var thirdList  = ema(ema(ema(values, n), n), n);

		var emaValue = [...Array(100).keys()].map(() => null).concat(ema(values, n));

		var emsList = emaValue.map((x, key) => ems(x, emsList, values[key]));

		var highEMS = emaValue.map((x, key) => {
			if (x === null) {
				return null;
			}
			else {
				return x + emsList[key];
			}
		} );

		var lowEMS  = emaValue.map((x, key) => {
			if (x === null) {
				return null;
			}
			else {
				return x - emsList[key];
			}
		} );

		var allEMS  = highEMS.map((x, key) => {
			return [parseFloat(x), parseFloat(lowEMS[key])]
		});
		
		console.log("\nhigh" + highEMS);
		console.log("\nlow" + lowEMS);
		console.log("\nema" + emaValue);
		console.log("\nems" + emsList);
		
		
		for (var index in values) {
			getAnomalies(values[index], emaValue[index], emsList[index]);
			//getAnomalies(values[index], emaValue[index],0.5)
		}

		res.send({
			data   : values,
			ema    : emaValue,
			allEMS : allEMS
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
	
	console.log('\n\nEMA: ' + emaValue + '\nValue: ' + value)
}

function getAnomalies(value, emaValue, emsList) {

	var difference = Math.abs(value - emaValue);
	var sensitivity = n * emsList;

	if (difference > sensitivity) {
		//return "ALARM!";
		console.log('\n\nALARM!!!!!! ' + amount);
		// Testing to see what values show up
		console.log('TEST!');
		console.log('Value: ' + value);
		console.log('emaValue: ' + emaValue);
		console.log('Diff: ' + difference);
		console.log('Sens: ' + sensitivity);
		amount++;
	}
}